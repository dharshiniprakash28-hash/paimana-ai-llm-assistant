"""
Project repository.

Reads from whichever dataset the DataSourceManager has active, enriches each
project with a risk result, and serves filtered / aggregated views.

All aggregations are None-safe: an imported PAIMANA extract may be missing any
given field, and a missing value is excluded from an average rather than being
counted as zero. Where a KPI cannot be computed at all, the repository reports
that explicitly instead of returning a misleading number.
"""

from typing import List, Dict, Any, Optional

from app.core.national_stats import get_national_reference
from app.data.datasource import DataSourceManager, MODE_REAL
from app.ml.engine import calculate_project_risk
from app.ml.evaluation import predict_single_project


def calculate_trend_signal(history: list) -> dict:
    """
    Evaluate longitudinal monthly snapshots to flag approaching risks (leading
    early warnings) before a project's current state crosses into Critical.
    """
    if not history or len(history) < 3:
        return {
            "available": False,
            "trending_worse": False,
            "signal": "STABLE",
            "trend_type": "INSUFFICIENT_HISTORY",
            "severity": "STABLE",
            "message": "Insufficient history for trend analysis (minimum 3 monthly snapshots required).",
            "explanation": "Insufficient history for trend analysis (minimum 3 monthly snapshots required).",
            "consecutive_worsening_months": 0,
            "quarterly_progress_gap_change": 0.0,
            "quarterly_cost_variance_change": 0.0,
        }

    recent = history[-4:]
    gaps = []
    for h in recent:
        if h.get("progress_gap") is not None:
            gaps.append(float(h["progress_gap"]))
        elif h.get("planned_progress") is not None and h.get("actual_progress") is not None:
            gaps.append(float(h["planned_progress"]) - float(h["actual_progress"]))

    costs = [float(h["cost_variance_pct"]) for h in recent if h.get("cost_variance_pct") is not None]
    actuals = [float(h["actual_progress"]) for h in recent if h.get("actual_progress") is not None]
    expenditures = [float(h["expenditure"]) for h in recent if h.get("expenditure") is not None]
    burn_rates = [float(h["burn_rate"]) for h in recent if h.get("burn_rate") is not None]

    gap_widening = False
    if len(gaps) >= 3:
        diffs = [gaps[i] - gaps[i - 1] for i in range(1, len(gaps))]
        if all(d > 0 for d in diffs[-2:]):
            gap_widening = True

    burn_worsening = False
    if len(burn_rates) >= 3:
        if burn_rates[-1] > burn_rates[-2] > burn_rates[-3]:
            burn_worsening = True
    elif len(actuals) >= 3 and len(expenditures) >= 3:
        burn_ratios = []
        for i in range(1, len(actuals)):
            prog_diff = max(0.1, actuals[i] - actuals[i - 1])
            exp_diff = max(0.0, expenditures[i] - expenditures[i - 1])
            burn_ratios.append(exp_diff / prog_diff)
        if len(burn_ratios) >= 2 and burn_ratios[-1] > burn_ratios[-2]:
            burn_worsening = True

    stalled = False
    if len(actuals) >= 3 and len(expenditures) >= 3:
        total_prog = actuals[-1] - actuals[-3]
        total_exp = expenditures[-1] - expenditures[-3]
        if total_prog < 0.8 and total_exp > 15.0:
            stalled = True

    q_gap_change = round(gaps[-1] - gaps[0], 1) if len(gaps) >= 2 else 0.0
    q_cost_change = round(costs[-1] - costs[0], 1) if len(costs) >= 2 else 0.0

    trending_worse = gap_widening or burn_worsening or stalled or (q_gap_change >= 3.5)

    if gap_widening or (q_gap_change >= 4.0):
        trend_type = "PROGRESS_GAP_WIDENING"
        severity = "HIGH_TREND_RISK"
        msg = f"Early Warning: Physical progress gap widened by +{q_gap_change}% over recent reporting periods."
    elif burn_worsening:
        trend_type = "BURN_RATE_DIVERGENCE"
        severity = "MODERATE_TREND_RISK"
        msg = "Early Warning: Expenditure burn-rate per unit of physical progress accelerated over recent months."
    elif stalled:
        trend_type = "PHYSICAL_PROGRESS_STALL"
        severity = "HIGH_TREND_RISK"
        msg = "Early Warning: Physical progress has stalled (<0.8%) over recent months despite ongoing expenditures."
    else:
        trend_type = "STABLE"
        severity = "STABLE"
        msg = "Project execution trajectory is stable over recent reporting periods."

    signal = "DETERIORATING" if trending_worse else "STABLE"

    return {
        "available": True,
        "signal": signal,
        "explanation": msg,
        "trending_worse": trending_worse,
        "trend_type": trend_type,
        "severity": severity,
        "message": msg,
        "consecutive_worsening_months": 3 if trending_worse else 0,
        "quarterly_progress_gap_change": q_gap_change,
        "quarterly_cost_variance_change": q_cost_change,
    }


def _avg(values):
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return round(sum(clean) / len(clean), 1)


def _total(values):
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return round(sum(clean), 2)


class ProjectRepository:
    """Thin, cache-backed view over the active data source."""

    _cache_key = None
    _projects_with_risk: List[Dict[str, Any]] = []
    _alerts: List[Dict[str, Any]] = []

    def __init__(self):
        self.ds = DataSourceManager()
        self._ensure_fresh()

    # ------------------------------------------------------------------
    def _current_key(self):
        projects = self.ds.get_active_projects()
        meta = self.ds.status().get("import_meta") or {}
        return (self.ds.mode, len(projects), meta.get("imported_at"))

    def _ensure_fresh(self):
        key = self._current_key()
        if key == ProjectRepository._cache_key and ProjectRepository._projects_with_risk:
            return
        self._rebuild()
        ProjectRepository._cache_key = key

    def _rebuild(self):
        projects = self.ds.get_active_projects()
        enriched, alerts = [], []
        for p in projects:
            risk = calculate_project_risk(p)
            ml_pred = predict_single_project(p, projects)
            trend = calculate_trend_signal(p.get("history") or [])
            enriched.append({
                **p,
                "risk": risk,
                "ml_prediction": ml_pred,
                "early_warning_trend": trend,
            })
            alerts.extend(risk.get("alerts", []))
        ProjectRepository._projects_with_risk = enriched
        ProjectRepository._alerts = alerts

    def refresh(self):
        """Force a rebuild, e.g. immediately after a data source switch."""
        self._rebuild()
        ProjectRepository._cache_key = self._current_key()

    @property
    def projects(self):
        return ProjectRepository._projects_with_risk

    def data_source_status(self):
        return self.ds.status()

    # ------------------------------------------------------------------
    def get_all(self,
                search: Optional[str] = None,
                ministry: Optional[str] = None,
                sector: Optional[str] = None,
                region: Optional[str] = None,
                risk_level: Optional[str] = None,
                status: Optional[str] = None,
                sort_by: Optional[str] = "risk_score",
                sort_order: Optional[str] = "desc",
                page: int = 1,
                limit: int = 10) -> Dict[str, Any]:

        filtered = self.projects

        if search:
            q = search.lower().strip()

            def matches(p):
                for field in ("project_name", "project_id", "implementing_agency", "sector", "ministry"):
                    val = p.get(field)
                    if val and q in str(val).lower():
                        return True
                return False

            filtered = [p for p in filtered if matches(p)]

        def eq_filter(items, field, value):
            if not value or value == "All":
                return items
            return [p for p in items if (p.get(field) or "") == value]

        filtered = eq_filter(filtered, "ministry", ministry)
        filtered = eq_filter(filtered, "sector", sector)
        filtered = eq_filter(filtered, "region", region)
        filtered = eq_filter(filtered, "status", status)

        if risk_level and risk_level != "All":
            filtered = [
                p for p in filtered
                if (p["risk"].get("risk_level") or "").upper() == risk_level.upper()
            ]

        reverse = (sort_order or "desc").lower() == "desc"
        sort_fields = {
            "risk_score": lambda x: x["risk"].get("overall_risk_score"),
            "cost_variance": lambda x: x.get("cost_variance"),
            "schedule_delay": lambda x: x.get("schedule_delay_months"),
            "original_cost": lambda x: x.get("original_cost"),
            "progress_gap": lambda x: x.get("progress_gap"),
            "project_id": lambda x: x.get("project_id") or "",
        }
        if sort_by in sort_fields:
            getter = sort_fields[sort_by]
            if sort_by == "project_id":
                filtered = sorted(filtered, key=getter, reverse=reverse)
            else:
                # Missing values sort last in both directions.
                filtered = sorted(
                    filtered,
                    key=lambda x: (getter(x) is None, -(getter(x) or 0) if reverse else (getter(x) or 0)),
                )

        total_count = len(filtered)
        start_idx = (page - 1) * limit
        return {
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
            "items": filtered[start_idx:start_idx + limit],
            "data_source": self.ds.status(),
        }

    def get_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        target = (project_id or "").upper()
        for p in self.projects:
            if str(p.get("project_id", "")).upper() == target:
                return p
        return None

    def get_alerts(
        self,
        severity: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        alerts = ProjectRepository._alerts
        if severity and severity != "All":
            alerts = [a for a in alerts if (a.get("severity") or "").upper() == severity.upper()]

        if page is not None or limit is not None:
            p = page or 1
            l = limit or 10
            total_count = len(alerts)
            start_idx = (p - 1) * l
            return {
                "total": total_count,
                "page": p,
                "limit": l,
                "total_pages": (total_count + l - 1) // l if l > 0 else 1,
                "items": alerts[start_idx:start_idx + l],
                "data_source": self.ds.status(),
            }
        return alerts

    # ------------------------------------------------------------------
    def get_dashboard_summary(self) -> Dict[str, Any]:
        projects = self.projects
        ds_status = self.ds.status()
        is_real = self.ds.mode == MODE_REAL

        total = len(projects)
        scored = [p for p in projects if p["risk"].get("score_available")]
        unscored_count = total - len(scored)
        risk_available = len(scored) > 0

        def level_count(level):
            return sum(1 for p in scored if p["risk"].get("risk_level") == level)

        critical = level_count("CRITICAL")
        high = level_count("HIGH")
        medium = level_count("MEDIUM")
        low = level_count("LOW")

        cost_risk_count = sum(
            1 for p in scored
            if (p["risk"].get("cost_overrun_risk_pct") or 0) >= 65
        )
        sched_risk_count = sum(
            1 for p in scored
            if (p["risk"].get("schedule_overrun_risk_pct") or 0) >= 65
        )

        pending = "Risk analysis pending"
        kpis = {
            "total_projects": total,
            "critical_risk": critical if risk_available else None,
            "high_risk": high if risk_available else None,
            "cost_risk": cost_risk_count if risk_available else None,
            "schedule_risk": sched_risk_count if risk_available else None,
            "projects_requiring_attention": (critical + high) if risk_available else None,
            "risk_analysis_available": risk_available,
            "unscored_projects": unscored_count,
            "risk_unavailable_message": None if risk_available else pending,
        }

        risk_dist = [
            {"name": "Critical", "count": critical, "color": "#ef4444"},
            {"name": "High", "count": high, "color": "#f97316"},
            {"name": "Medium", "count": medium, "color": "#eab308"},
            {"name": "Low", "count": low, "color": "#22c55e"},
        ] if risk_available else []

        # ---- Ministry / sector breakdowns ----
        ministry_counts, ministry_cost = {}, {}
        for p in projects:
            m = p.get("ministry") or "Not specified"
            ministry_counts[m] = ministry_counts.get(m, 0) + 1
            rc = p.get("revised_cost")
            if rc is not None:
                ministry_cost[m] = ministry_cost.get(m, 0.0) + rc

        ministry_chart = [
            {
                "ministry": k,
                "count": v,
                "total_cost_cr": round(ministry_cost[k], 2) if k in ministry_cost else None,
            }
            for k, v in sorted(ministry_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        sector_counts = {}
        for p in projects:
            s = p.get("sector") or "Not specified"
            sector_counts[s] = sector_counts.get(s, 0) + 1
        sector_chart = [
            {"sector": k, "count": v}
            for k, v in sorted(sector_counts.items(), key=lambda x: x[1], reverse=True)[:12]
        ]

        # ---- Priority projects ----
        priority_list = []
        if risk_available:
            priority = sorted(
                scored, key=lambda x: x["risk"]["overall_risk_score"], reverse=True
            )[:10]
            priority_list = [
                {
                    "project_id": p.get("project_id"),
                    "project_name": p.get("project_name"),
                    "ministry": p.get("ministry") or "Not available",
                    "sector": p.get("sector") or "Not available",
                    "overall_risk_score": p["risk"]["overall_risk_score"],
                    "overall_risk_level": p["risk"]["risk_level"],
                    "cost_risk_pct": p["risk"].get("cost_overrun_risk_pct"),
                    "time_risk_pct": p["risk"].get("schedule_overrun_risk_pct"),
                    "primary_driver": p["risk"].get("primary_driver"),
                    "status": p.get("status") or "Not available",
                    "revised_cost": p.get("revised_cost"),
                    "schedule_delay_months": p.get("schedule_delay_months"),
                }
                for p in priority
            ]

        # ---- Projects Trending Worse (Quarterly Early-Warning Detection) ----
        trending_worse = [
            {
                "project_id": p.get("project_id"),
                "project_name": p.get("project_name"),
                "ministry": p.get("ministry") or "Not available",
                "sector": p.get("sector") or "Not available",
                "overall_risk_score": p.get("risk", {}).get("overall_risk_score"),
                "overall_risk_level": p.get("risk", {}).get("risk_level"),
                "ml_risk_probability": (p.get("ml_prediction") or {}).get("ml_risk_probability"),
                "trend_type": (p.get("early_warning_trend") or {}).get("trend_type"),
                "trend_severity": (p.get("early_warning_trend") or {}).get("severity"),
                "trend_message": (p.get("early_warning_trend") or {}).get("message"),
                "quarterly_progress_gap_change": (p.get("early_warning_trend") or {}).get("quarterly_progress_gap_change"),
                "progress_gap": p.get("progress_gap"),
                "cost_variance_pct": p.get("cost_variance_pct"),
                "revised_cost": p.get("revised_cost"),
                "actual_progress": p.get("actual_progress"),
            }
            for p in projects
            if (p.get("early_warning_trend") or {}).get("trending_worse")
        ]
        trending_worse.sort(key=lambda x: x.get("quarterly_progress_gap_change") or 0.0, reverse=True)
        kpis["projects_trending_worse_count"] = len(trending_worse)

        # ---- Distributions ----
        cost_ranges = {"0-5%": 0, "5-15%": 0, "15-30%": 0, ">30%": 0}
        cv_missing = 0
        for p in projects:
            cv = p.get("cost_variance_pct")
            if cv is None:
                cv_missing += 1
                continue
            if cv <= 5:
                cost_ranges["0-5%"] += 1
            elif cv <= 15:
                cost_ranges["5-15%"] += 1
            elif cv <= 30:
                cost_ranges["15-30%"] += 1
            else:
                cost_ranges[">30%"] += 1

        sched_ranges = {"0-3 mo": 0, "4-8 mo": 0, "9-16 mo": 0, ">16 mo": 0}
        sd_missing = 0
        for p in projects:
            sd = p.get("schedule_delay_months")
            if sd is None:
                sd_missing += 1
                continue
            if sd <= 3:
                sched_ranges["0-3 mo"] += 1
            elif sd <= 8:
                sched_ranges["4-8 mo"] += 1
            elif sd <= 16:
                sched_ranges["9-16 mo"] += 1
            else:
                sched_ranges[">16 mo"] += 1

        progress_sample = [
            {
                "project_id": p.get("project_id"),
                "name": (p.get("project_name") or "")[:20] + "...",
                "planned": p.get("planned_progress"),
                "actual": p.get("actual_progress"),
                "gap": p.get("progress_gap"),
            }
            for p in projects[:12]
            if p.get("planned_progress") is not None and p.get("actual_progress") is not None
        ]

        # ---- Application dataset totals (kept distinct from national figures) ----
        application_dataset = {
            "label": ds_status["label"],
            "mode": ds_status["mode"],
            "is_synthetic": ds_status["is_synthetic"],
            "projects": total,
            "ministries": len({p.get("ministry") for p in projects if p.get("ministry")}),
            "sectors": len({p.get("sector") for p in projects if p.get("sector")}),
            "total_original_cost_cr": _total([p.get("original_cost") for p in projects]),
            "total_revised_cost_cr": _total([p.get("revised_cost") for p in projects]),
            "total_expenditure_cr": _total([p.get("expenditure") for p in projects]),
            "disclaimer": ds_status["disclaimer"],
        }

        return {
            "kpis": kpis,
            "national_reference": get_national_reference(),
            "application_dataset": application_dataset,
            "data_source": ds_status,
            "risk_distribution": risk_dist,
            "ministry_distribution": ministry_chart,
            "sector_distribution": sector_chart,
            "cost_variance_distribution": [{"range": k, "count": v} for k, v in cost_ranges.items()],
            "cost_variance_missing": cv_missing,
            "schedule_delay_distribution": [{"range": k, "count": v} for k, v in sched_ranges.items()],
            "schedule_delay_missing": sd_missing,
            "progress_comparison_sample": progress_sample,
            "priority_projects": priority_list,
            "projects_trending_worse": trending_worse[:12],
            "disclaimer": ds_status["disclaimer"],
            "generated_at_note": (
                "National reference statistics are quoted from SIH problem statement SIH26103 "
                "(April 2026) and are not derived from the dataset loaded in this application."
            ),
        }

    # ------------------------------------------------------------------
    def _group_analytics(self, key_field, label):
        groups = {}
        for p in self.projects:
            k = p.get(key_field) or "Not specified"
            g = groups.setdefault(k, {
                "count": 0, "original": [], "revised": [], "scores": [],
                "cost_var": [], "delays": [], "critical": 0, "high": 0,
            })
            g["count"] += 1
            g["original"].append(p.get("original_cost"))
            g["revised"].append(p.get("revised_cost"))
            g["cost_var"].append(p.get("cost_variance_pct"))
            g["delays"].append(p.get("schedule_delay_months"))
            risk = p["risk"]
            if risk.get("score_available"):
                g["scores"].append(risk.get("overall_risk_score"))
                if risk.get("risk_level") == "CRITICAL":
                    g["critical"] += 1
                elif risk.get("risk_level") == "HIGH":
                    g["high"] += 1

        results = []
        for k, g in groups.items():
            results.append({
                label: k,
                "count": g["count"],
                "total_budget_cr": _total(g["revised"]),
                "total_cost_cr": _total(g["revised"]),
                "total_original_cost_cr": _total(g["original"]),
                "avg_risk_score": _avg(g["scores"]),
                "avg_cost_variance_pct": _avg(g["cost_var"]),
                "avg_schedule_delay_months": _avg(g["delays"]),
                "critical_projects": g["critical"],
                "high_risk_projects": g["high"],
                "risk_available": len(g["scores"]) > 0,
            })
        return sorted(results, key=lambda x: (x["avg_risk_score"] is None, -(x["avg_risk_score"] or 0)))

    def get_analytics_by_ministry(self) -> List[Dict[str, Any]]:
        return self._group_analytics("ministry", "ministry")

    def get_analytics_by_sector(self) -> List[Dict[str, Any]]:
        return self._group_analytics("sector", "sector")

    def get_analytics_by_region(self) -> List[Dict[str, Any]]:
        return self._group_analytics("region", "region")
