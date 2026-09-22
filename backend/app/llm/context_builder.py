"""
Context builder for the PAIMANA-AI LLM assistant.

The assistant never answers from the model's own world knowledge about Indian
infrastructure projects. Every answer must be grounded in the JSON context this
module assembles from the ACTIVE dataset.

Two shapes of context are produced:

  * project context     - a single selected project, with its derived metrics,
                          risk result, drivers and alerts.
  * portfolio context   - aggregated statistics across the active dataset, plus
                          the most relevant projects for the question asked.

Fields that are genuinely absent are emitted as the string "Not available" so
the model sees the gap explicitly rather than inferring a plausible value.
"""

import re

from app.core.national_stats import get_national_reference

NOT_AVAILABLE = "Not available"

MAX_RELEVANT_PROJECTS = 12


def _v(value):
    """Render a value for the model, making absence explicit."""
    if value is None or value == "":
        return NOT_AVAILABLE
    return value


def build_project_context(project):
    """Structured context for one project."""
    if not project:
        return None

    risk = project.get("risk") or {}
    cand = project.get("candidate_variables") or {}

    context = {
        "project_id": _v(project.get("project_id")),
        "project_name": _v(project.get("project_name")),
        "ministry": _v(project.get("ministry")),
        "sector": _v(project.get("sector")),
        "implementing_agency": _v(project.get("implementing_agency")),
        "region": _v(project.get("region")),
        "status": _v(project.get("status")),

        "financials_rs_crore": {
            "original_cost": _v(project.get("original_cost")),
            "revised_cost": _v(project.get("revised_cost")),
            "expenditure": _v(project.get("expenditure")),
            "cost_variance": _v(project.get("cost_variance")),
            "cost_variance_pct": _v(project.get("cost_variance_pct")),
            "expenditure_ratio": _v(project.get("expenditure_ratio")),
        },

        "schedule": {
            "planned_start_date": _v(project.get("planned_start_date")),
            "original_completion_date": _v(project.get("planned_completion_date")),
            "revised_or_expected_completion_date": _v(project.get("expected_completion_date")),
            "planned_duration_months": _v(project.get("planned_duration_months")),
            "schedule_delay_months": _v(project.get("schedule_delay_months")),
        },

        "progress": {
            "planned_progress_pct": _v(project.get("planned_progress")),
            "actual_progress_pct": _v(project.get("actual_progress")),
            "progress_gap_pct": _v(project.get("progress_gap")),
        },

        "milestones": {
            "milestone_count": _v(project.get("milestone_count")),
            "milestones_completed": _v(project.get("milestones_completed")),
            "milestone_delays": _v(project.get("milestone_delays")),
            "milestone_delay_ratio": _v(project.get("milestone_delay_ratio")),
        },

        "paimana_ai_risk_analysis": {
            "note": "Derived by PAIMANA-AI. Not an official Government prediction.",
            "score_available": risk.get("score_available", False),
            "overall_risk_score": _v(risk.get("overall_risk_score")),
            "risk_level": _v(risk.get("risk_level")),
            "cost_overrun_risk_pct": _v(risk.get("cost_overrun_risk_pct")),
            "schedule_overrun_risk_pct": _v(risk.get("schedule_overrun_risk_pct")),
            "progress_risk_pct": _v(risk.get("progress_risk_pct")),
            "milestone_risk_pct": _v(risk.get("milestone_risk_pct")),
            "primary_driver": _v(risk.get("primary_driver")),
            "risk_drivers": [
                {
                    "driver": d.get("driver"),
                    "severity": d.get("severity"),
                    "value": d.get("value"),
                    "impact_pct": d.get("impact_pct"),
                }
                for d in (risk.get("drivers") or [])
            ] or NOT_AVAILABLE,
            "components_unavailable": risk.get("components_unavailable") or [],
            "recommended_attention": _v(risk.get("recommended_attention")),
        },

        "early_warning_alerts": [
            {
                "risk_type": a.get("risk_type"),
                "severity": a.get("severity"),
                "reason": a.get("reason"),
                "recommended_action": a.get("recommended_action"),
                "financial_impact": (
                    {
                        "value_rs_crore": a["financial_impact"].get("value_cr"),
                        "label": a["financial_impact"].get("label"),
                        "basis": a["financial_impact"].get("basis"),
                        "qualifier": "Derived estimate, not an official forecast",
                    }
                    if a.get("financial_impact", {}).get("available") else NOT_AVAILABLE
                ),
            }
            for a in (risk.get("alerts") or [])
        ] or NOT_AVAILABLE,
    }

    if cand:
        context["candidate_variables_experimental"] = {
            "note": (
                "Experimental schema-extension fields. Present in synthetic demo data only; "
                "these are NOT fields currently captured in official PAIMANA returns."
            ),
            **{k: _v(v) for k, v in cand.items()},
        }
    else:
        context["candidate_variables_experimental"] = NOT_AVAILABLE

    return context


def _project_digest(p):
    risk = p.get("risk") or {}
    return {
        "project_id": p.get("project_id"),
        "project_name": p.get("project_name"),
        "ministry": _v(p.get("ministry")),
        "sector": _v(p.get("sector")),
        "region": _v(p.get("region")),
        "status": _v(p.get("status")),
        "original_cost_cr": _v(p.get("original_cost")),
        "revised_cost_cr": _v(p.get("revised_cost")),
        "expenditure_cr": _v(p.get("expenditure")),
        "cost_variance_pct": _v(p.get("cost_variance_pct")),
        "schedule_delay_months": _v(p.get("schedule_delay_months")),
        "progress_gap_pct": _v(p.get("progress_gap")),
        "risk_score": _v(risk.get("overall_risk_score")),
        "risk_level": _v(risk.get("risk_level")),
        "primary_driver": _v(risk.get("primary_driver")),
    }


def _avg(values):
    clean = [v for v in values if v is not None]
    return round(sum(clean) / len(clean), 2) if clean else None


def select_relevant_projects(question, projects, limit=MAX_RELEVANT_PROJECTS):
    """
    Pick the projects most likely to be needed to answer the question.
    Intentionally simple and transparent: keyword-driven ranking over the
    active dataset. The LLM does the reasoning, this only decides what it sees.
    """
    q = (question or "").lower()
    scored = [p for p in projects if (p.get("risk") or {}).get("score_available")]

    def by(field, reverse=True, source=None):
        pool = source if source is not None else projects
        vals = [p for p in pool if p.get(field) is not None]
        return sorted(vals, key=lambda p: p[field], reverse=reverse)[:limit]

    if any(w in q for w in ("delay", "delayed", "schedule", "behind", "late", "timeline")):
        return by("schedule_delay_months")
    if any(w in q for w in ("cost", "overrun", "variance", "escalat", "budget", "expensive")):
        return by("cost_variance_pct")
    if any(w in q for w in ("expenditure", "spend", "spent", "disburse", "utilisation", "utilization")):
        return by("expenditure")
    if any(w in q for w in ("progress", "physical", "execution")):
        return by("progress_gap")
    if scored:
        return sorted(
            scored, key=lambda p: p["risk"]["overall_risk_score"], reverse=True
        )[:limit]
    return projects[:limit]


def build_portfolio_context(repo, question=None):
    """Aggregated statistics across the active dataset."""
    projects = repo.projects
    ds = repo.data_source_status()

    scored = [p for p in projects if (p.get("risk") or {}).get("score_available")]

    level_counts = {}
    for p in scored:
        lvl = p["risk"].get("risk_level")
        level_counts[lvl] = level_counts.get(lvl, 0) + 1

    ministries = repo.get_analytics_by_ministry()
    sectors = repo.get_analytics_by_sector()

    return {
        "active_data_source": {
            "mode": ds["mode"],
            "label": ds["label"],
            "is_synthetic": ds["is_synthetic"],
            "disclaimer": ds["disclaimer"],
            "project_count": ds["active_project_count"],
        },
        "portfolio_totals": {
            "projects": len(projects),
            "projects_with_risk_score": len(scored),
            "projects_without_risk_score": len(projects) - len(scored),
            "distinct_ministries": len({p.get("ministry") for p in projects if p.get("ministry")}),
            "distinct_sectors": len({p.get("sector") for p in projects if p.get("sector")}),
            "total_original_cost_cr": _avg([]) if not projects else round(
                sum(p["original_cost"] for p in projects if p.get("original_cost") is not None), 2
            ),
            "total_revised_cost_cr": round(
                sum(p["revised_cost"] for p in projects if p.get("revised_cost") is not None), 2
            ) if projects else NOT_AVAILABLE,
            "total_expenditure_cr": round(
                sum(p["expenditure"] for p in projects if p.get("expenditure") is not None), 2
            ) if projects else NOT_AVAILABLE,
            "avg_cost_variance_pct": _v(_avg([p.get("cost_variance_pct") for p in projects])),
            "avg_schedule_delay_months": _v(_avg([p.get("schedule_delay_months") for p in projects])),
            "projects_delayed_over_6_months": sum(
                1 for p in projects
                if p.get("schedule_delay_months") is not None and p["schedule_delay_months"] >= 6
            ),
            "projects_cost_variance_over_10_pct": sum(
                1 for p in projects
                if p.get("cost_variance_pct") is not None and p["cost_variance_pct"] >= 10
            ),
        },
        "risk_level_counts": level_counts or NOT_AVAILABLE,
        "ministry_analytics": ministries[:15],
        "sector_analytics": sectors[:20],
        "relevant_projects": [
            _project_digest(p) for p in select_relevant_projects(question, projects)
        ],
        "national_paimana_reference": get_national_reference(),
    }


def extract_project_id(text, known_ids=None):
    """
    Find a project identifier mentioned in free text.

    Imported PAIMANA extracts use whatever identifier scheme the source file
    carries (RLY-001, NHA-003, ...), not the demo dataset's PRJ- prefix, so
    matching only PRJ- would silently fail to resolve a project the officer
    named on real data. When the caller supplies the identifiers actually
    present in the active dataset, those are matched first.
    """
    if not text:
        return None

    if known_ids:
        # Longest first, so "PRJ-1011" is not shadowed by "PRJ-101".
        for pid in sorted({str(k) for k in known_ids if k}, key=len, reverse=True):
            if re.search(rf"(?<![A-Za-z0-9]){re.escape(pid)}(?![A-Za-z0-9])", text,
                         flags=re.IGNORECASE):
                return pid
        # Tolerate separator drift, e.g. "RLY 001" for "RLY-001".
        loose = re.sub(r"[-_\s]+", "", text).upper()
        for pid in sorted({str(k) for k in known_ids if k}, key=len, reverse=True):
            if re.sub(r"[-_\s]+", "", pid).upper() in loose:
                return pid

    match = re.search(r"\b(prj[-_\s]?\d+)\b", text, flags=re.IGNORECASE)
    if match:
        return re.sub(r"[-_\s]+", "-", match.group(1).upper())
    return None


def build_context(repo, question, project_id=None):
    """
    Assemble the full grounding context for a question.
    Returns (context_dict, resolved_project_or_None).
    """
    known_ids = [p.get("project_id") for p in repo.projects]
    resolved_id = project_id or extract_project_id(question, known_ids)
    project = repo.get_by_id(resolved_id) if resolved_id else None

    context = {
        "portfolio": build_portfolio_context(repo, question),
        "selected_project": build_project_context(project) if project else NOT_AVAILABLE,
    }
    if resolved_id and not project:
        context["lookup_note"] = (
            f"A project identifier '{resolved_id}' was mentioned but no such project exists "
            f"in the active dataset."
        )
    return context, project
