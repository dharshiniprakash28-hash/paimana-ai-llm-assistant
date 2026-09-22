"""
AI Project Assistant.

Two endpoints:

  POST /assistant/chat    Free-form natural language. Routes to Gemini when
                          GEMINI_API_KEY is configured, otherwise transparently
                          falls back to the local rule-based assistant.

  POST /assistant/query   The original rule-based endpoint, preserved so any
                          existing client keeps working.

The Gemini API key lives only in the backend environment. It is never included
in a response body.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.data.repository import ProjectRepository
from app.llm import gemini_client, ollama_client
from app.llm.context_builder import build_context, extract_project_id
from app.models.schemas import AssistantQueryRequest, AssistantQueryResponse

router = APIRouter(prefix="/assistant", tags=["AI Project Assistant"])

SUGGESTED_QUERIES = [
    "Which sectors have the highest cost variance?",
    "Which projects require attention?",
    "How many projects are delayed?",
    "What are the main risk drivers?",
    "What information is missing for risk prediction?",
]


class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]] = []
    project_context: Optional[Dict[str, Any]] = None
    mode: str
    mode_label: str
    llm_enabled: bool
    notice: Optional[str] = None
    suggested_queries: List[str] = SUGGESTED_QUERIES
    disclaimer: str = (
        "PAIMANA-AI derived analysis. Not an official Government of India prediction."
    )


# ---------------------------------------------------------------------------
# Local rule-based assistant (fallback, and the original /assistant/query)
# ---------------------------------------------------------------------------

def local_answer(repo: ProjectRepository, question: str, project_id: Optional[str] = None):
    """Deterministic keyword assistant. Returns (answer_text, relevant_projects)."""
    q = (question or "").lower().strip()
    projects = repo.projects
    ds = repo.data_source_status()
    source_note = (
        "\n\n*Source: Demo data - synthetic, for demonstration purposes only.*"
        if ds["is_synthetic"] else
        "\n\n*Source: Imported PAIMANA data. Risk figures are PAIMANA-AI derived analysis.*"
    )

    def fmt(value, suffix="", prefix=""):
        return f"{prefix}{value}{suffix}" if value is not None else "Not available"

    # --- Specific project ---
    target_id = project_id or extract_project_id(
        question, [p.get("project_id") for p in projects]
    )
    if target_id:
        proj = repo.get_by_id(target_id)
        if proj:
            risk = proj["risk"]
            if risk.get("score_available"):
                drivers = "\n".join(
                    f"- **{d['driver']}** ({d['severity']}): {d['value']}"
                    for d in risk["drivers"][:4]
                )
                risk_block = (
                    f"- **Overall Risk Score:** {risk['overall_risk_score']}/100 "
                    f"(**{risk['risk_level']}**)\n"
                    f"- **Cost Overrun Risk:** {fmt(risk.get('cost_overrun_risk_pct'), '%')}\n"
                    f"- **Schedule Overrun Risk:** {fmt(risk.get('schedule_overrun_risk_pct'), '%')}\n"
                )
            else:
                drivers = "- Risk analysis pending: required fields are not present in this dataset."
                risk_block = "- **Risk Score:** Risk analysis pending (insufficient data)\n"

            answer = (
                f"**{proj.get('project_id')} - {proj.get('project_name')}**\n\n"
                f"- **Ministry / Sector:** {fmt(proj.get('ministry'))} | {fmt(proj.get('sector'))}\n"
                f"{risk_block}"
                f"- **Schedule Delay:** {fmt(proj.get('schedule_delay_months'), ' months')}\n"
                f"- **Cost Variance:** {fmt(proj.get('cost_variance_pct'), '%')}\n"
                f"- **Progress Gap:** {fmt(proj.get('progress_gap'), '%')}\n\n"
                f"**Risk drivers identified by the rule-based engine:**\n{drivers}\n\n"
                f"**Recommended attention:**\n{risk.get('recommended_attention')}"
                f"{source_note}"
            )
            return answer, [proj]
        return (
            f"The available dataset does not contain a project with identifier "
            f"`{target_id}`.{source_note}"
        ), []

    scored = [p for p in projects if p["risk"].get("score_available")]

    # --- Risk ranking ---
    if any(w in q for w in ("high risk", "critical", "highest risk", "require attention",
                            "requires attention", "attention")):
        if not scored:
            return (
                "Risk analysis pending. The active dataset does not contain the fields "
                "required to compute risk scores, so projects cannot be ranked by risk."
                + source_note
            ), []
        top = sorted(scored, key=lambda x: x["risk"]["overall_risk_score"], reverse=True)[:5]
        bullets = "\n".join(
            f"- **{p['project_id']}**: risk **{p['risk']['overall_risk_score']}/100** "
            f"({p['risk']['risk_level']}), delay {fmt(p.get('schedule_delay_months'), ' mo')}, "
            f"cost variance {fmt(p.get('cost_variance_pct'), '%')}"
            for p in top
        )
        crit = sum(1 for p in scored if p["risk"]["risk_level"] == "CRITICAL")
        high = sum(1 for p in scored if p["risk"]["risk_level"] == "HIGH")
        return (
            f"**{crit} Critical** and **{high} High** risk projects in the active dataset "
            f"({len(scored)} of {len(projects)} projects scored).\n\n"
            f"**Highest risk projects:**\n{bullets}{source_note}"
        ), top

    # --- Sector ---
    if "sector" in q:
        sectors = [s for s in repo.get_analytics_by_sector() if s.get("avg_cost_variance_pct") is not None]
        if not sectors:
            return ("The available dataset does not contain cost variance data by sector."
                    + source_note), []
        if "cost" in q or "variance" in q or "overrun" in q:
            sectors = sorted(sectors, key=lambda s: s["avg_cost_variance_pct"], reverse=True)
            bullets = "\n".join(
                f"- **{s['sector']}**: average cost variance **{s['avg_cost_variance_pct']}%** "
                f"across {s['count']} project(s)"
                for s in sectors[:6]
            )
            return (f"**Sectors by average cost variance:**\n{bullets}{source_note}"), []
        bullets = "\n".join(
            f"- **{s['sector']}**: avg risk {fmt(s.get('avg_risk_score'))}/100, "
            f"{s['count']} project(s), {s['critical_projects']} critical"
            for s in sectors[:6]
        )
        return (f"**Sectors by average risk score:**\n{bullets}{source_note}"), []

    # --- Ministry ---
    if "ministry" in q or "ministries" in q:
        mins = repo.get_analytics_by_ministry()[:6]
        bullets = "\n".join(
            f"- **{m['ministry']}**: {m['count']} project(s), avg risk {fmt(m.get('avg_risk_score'))}, "
            f"avg cost variance {fmt(m.get('avg_cost_variance_pct'), '%')}"
            for m in mins
        )
        return (f"**Ministry breakdown of the active dataset:**\n{bullets}{source_note}"), []

    # --- Delays ---
    if any(w in q for w in ("delay", "delayed", "schedule", "behind", "late")):
        with_delay = [p for p in projects if p.get("schedule_delay_months") is not None]
        if not with_delay:
            return ("The available dataset does not contain schedule delay information."
                    + source_note), []
        delayed6 = [p for p in with_delay if p["schedule_delay_months"] >= 6]
        top = sorted(with_delay, key=lambda p: p["schedule_delay_months"], reverse=True)[:5]
        bullets = "\n".join(
            f"- **{p['project_id']}**: {p['schedule_delay_months']} months delay, "
            f"progress gap {fmt(p.get('progress_gap'), '%')}"
            for p in top
        )
        return (
            f"**{len(delayed6)} of {len(with_delay)}** projects with recorded schedule data are "
            f"delayed by 6 months or more.\n\n**Most delayed projects:**\n{bullets}{source_note}"
        ), top

    # --- Cost ---
    if any(w in q for w in ("cost", "variance", "budget", "overrun", "escalat", "expensive")):
        with_cv = [p for p in projects if p.get("cost_variance_pct") is not None]
        if not with_cv:
            return ("The available dataset does not contain cost variance information."
                    + source_note), []
        top = sorted(with_cv, key=lambda p: p["cost_variance_pct"], reverse=True)[:5]
        bullets = "\n".join(
            f"- **{p['project_id']}**: +{p['cost_variance_pct']}% "
            f"({fmt(p.get('cost_variance'), ' Cr', 'Rs ')}), revised cost "
            f"{fmt(p.get('revised_cost'), ' Cr', 'Rs ')}"
            for p in top
        )
        return (f"**Projects with the highest cost escalation:**\n{bullets}{source_note}"), top

    # --- Missing data ---
    if any(w in q for w in ("missing", "unavailable", "not available", "what information")):
        unscored = [p for p in projects if not p["risk"].get("score_available")]
        meta = (ds.get("import_meta") or {})
        lines = [
            f"- Projects in active dataset: **{len(projects)}**",
            f"- Projects with a computable risk score: **{len(scored)}**",
            f"- Projects where risk analysis is pending: **{len(unscored)}**",
        ]
        if meta.get("missing_for_risk"):
            lines.append(f"- Fields missing that block risk scoring: **{', '.join(meta['missing_for_risk'])}**")
        if meta.get("partially_missing_for_risk"):
            lines.append(
                f"- Fields absent, so their risk component is excluded: "
                f"**{', '.join(meta['partially_missing_for_risk'])}**"
            )
        return ("**Data availability for risk prediction:**\n" + "\n".join(lines) + source_note), []

    # --- Default overview ---
    summary = repo.get_dashboard_summary()["kpis"]
    if summary.get("risk_analysis_available"):
        risk_lines = (
            f"- Critical risk: **{summary['critical_risk']}**\n"
            f"- High risk: **{summary['high_risk']}**\n"
            f"- Elevated cost overrun risk: **{summary['cost_risk']}**\n"
            f"- Elevated schedule overrun risk: **{summary['schedule_risk']}**\n"
        )
    else:
        risk_lines = "- Risk analysis pending: the active dataset lacks the required fields.\n"

    return (
        f"**PAIMANA-AI overview - {ds['label']}**\n\n"
        f"- Projects in active dataset: **{summary['total_projects']}**\n"
        f"{risk_lines}\n"
        f"Ask about a specific project (e.g. *'Why is PRJ-101 high risk?'*), sector cost "
        f"variance, delays, or what information is missing for risk prediction."
        f"{source_note}"
    ), []


def _build_sources(repo, project, relevant):
    ds = repo.data_source_status()
    sources = [{
        "type": "dataset",
        "label": ds["label"],
        "mode": ds["mode"],
        "project_count": ds["active_project_count"],
        "is_synthetic": ds["is_synthetic"],
    }]
    if project:
        sources.append({
            "type": "project",
            "project_id": project.get("project_id"),
            "project_name": project.get("project_name"),
        })
    for p in (relevant or [])[:8]:
        if project and p.get("project_id") == project.get("project_id"):
            continue
        sources.append({
            "type": "project",
            "project_id": p.get("project_id"),
            "project_name": p.get("project_name"),
        })
    return sources


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
def assistant_status():
    """Reports whether Gemini or Ollama is configured. Never returns keys."""
    gem_status = gemini_client.get_status()
    if gem_status.get("llm_enabled"):
        return {**gem_status, "active_provider": "GEMINI"}

    ollama_status = ollama_client.get_status()
    if ollama_status.get("llm_enabled"):
        return {
            "llm_enabled": True,
            "provider": "OLLAMA",
            "active_provider": "OLLAMA",
            "model": ollama_status.get("model"),
            "message": f"Ollama local LLM active ({ollama_status.get('model')})",
            "notice": ollama_status.get("notice"),
        }

    return {
        **gem_status,
        "active_provider": "LOCAL_FALLBACK",
        "ollama_available": False,
    }


@router.post("/chat", response_model=ChatResponse)
def assistant_chat(req: ChatRequest):
    repo = ProjectRepository()
    gem_status = gemini_client.get_status()
    ollama_status = ollama_client.get_status()

    context, project = build_context(repo, req.message, req.project_id)
    project_context = context.get("selected_project")
    if not isinstance(project_context, dict):
        project_context = None

    # Priority 1: Gemini if configured
    if gem_status.get("llm_enabled"):
        answer, meta = gemini_client.generate_answer(req.message, context)
        if answer:
            relevant = context["portfolio"].get("relevant_projects", [])
            return ChatResponse(
                answer=answer,
                sources=_build_sources(repo, project, [
                    {"project_id": r.get("project_id"), "project_name": r.get("project_name")}
                    for r in relevant
                ]),
                project_context=project_context,
                mode="GEMINI",
                mode_label=f"AI Assistant - Gemini ({gem_status.get('model', '2.5-flash')})",
                llm_enabled=True,
                notice=None,
            )

    # Priority 2: Ollama local LLM (sovereign / offline air-gapped demo)
    if ollama_status.get("llm_enabled"):
        answer, meta = ollama_client.generate_answer(req.message, context)
        if answer:
            relevant = context["portfolio"].get("relevant_projects", [])
            return ChatResponse(
                answer=answer,
                sources=_build_sources(repo, project, [
                    {"project_id": r.get("project_id"), "project_name": r.get("project_name")}
                    for r in relevant
                ]),
                project_context=project_context,
                mode="OLLAMA",
                mode_label=f"AI Assistant - Ollama ({meta.get('model', 'Llama 3')})",
                llm_enabled=True,
                notice="Sovereign / air-gapped local LLM inference via Ollama.",
            )

    # Priority 3: Transparent rule-based fallback
    text, relevant = local_answer(repo, req.message, req.project_id)
    return ChatResponse(
        answer=text,
        sources=_build_sources(repo, project, relevant),
        project_context=project_context,
        mode="FALLBACK",
        mode_label="AI Assistant - Local Fallback",
        llm_enabled=False,
        notice=gem_status.get("message", "Local assistant active"),
    )


@router.post("/query", response_model=AssistantQueryResponse)
def handle_assistant_query(req: AssistantQueryRequest):
    """Original rule-based endpoint, preserved for backward compatibility."""
    repo = ProjectRepository()
    answer, relevant = local_answer(repo, req.question, req.project_id)
    return AssistantQueryResponse(
        answer=answer,
        suggested_queries=SUGGESTED_QUERIES,
        relevant_projects=relevant or None,
    )
