from fastapi import APIRouter
from app.data.repository import ProjectRepository

router = APIRouter(prefix="/analytics", tags=["Analytics & Benchmarking"])

@router.get("/ministries")
def get_ministry_analytics():
    repo = ProjectRepository()
    return repo.get_analytics_by_ministry()

@router.get("/sectors")
def get_sector_analytics():
    repo = ProjectRepository()
    return repo.get_analytics_by_sector()

@router.get("/regions")
def get_region_analytics():
    repo = ProjectRepository()
    return repo.get_analytics_by_region()


@router.get("/benchmarks")
def get_benchmarks():
    repo = ProjectRepository()
    ministries = repo.get_analytics_by_ministry()
    sectors = repo.get_analytics_by_sector()

    all_projects = repo.projects
    total_projects = len(all_projects)

    def avg(values):
        clean = [v for v in values if v is not None]
        return round(sum(clean) / len(clean), 1) if clean else None

    scored = [p for p in all_projects if p["risk"].get("score_available")]

    return {
        "global_benchmarks": {
            "total_projects": total_projects,
            "scored_projects": len(scored),
            "average_risk_score": avg([p["risk"].get("overall_risk_score") for p in scored]),
            "average_cost_variance_pct": avg([p.get("cost_variance_pct") for p in all_projects]),
            "average_schedule_delay_months": avg([p.get("schedule_delay_months") for p in all_projects]),
        },
        "ministry_rankings": ministries,
        "sector_rankings": sectors[:12],
        "region_rankings": repo.get_analytics_by_region(),
        "data_source": repo.data_source_status(),
    }


@router.get("/delay-taxonomy")
def get_delay_taxonomy():
    """
    Aggregates delay root causes according to the official MoSPI 8-Factor Statutory Taxonomy
    (from published IPMD Flash Reports on Central Sector Projects).
    """
    repo = ProjectRepository()
    all_projects = repo.projects

    MOSPI_TAXONOMY = [
        "Land acquisition delay",
        "Forest / environmental clearance delay",
        "Financing tie-up delay",
        "Contractor / tendering issues",
        "Law and order problems",
        "Geological surprises",
        "Utility shifting",
        "Lack of infrastructure linkages",
    ]

    # Map projects to category
    cat_data = {
        cat: {
            "category": cat,
            "count": 0,
            "cost_escalation_total": 0.0,
            "delay_months_total": 0.0,
            "sectors": {},
            "top_projects": [],
        }
        for cat in MOSPI_TAXONOMY
    }
    other_cat = {
        "category": "Other / Unclassified",
        "count": 0,
        "cost_escalation_total": 0.0,
        "delay_months_total": 0.0,
        "sectors": {},
        "top_projects": [],
    }

    delayed_projects_count = 0

    for p in all_projects:
        reason = p.get("reason_for_delay")
        if not reason or reason.strip().lower() == "none":
            continue

        delayed_projects_count += 1
        matched_cat = None
        for cat in MOSPI_TAXONOMY:
            if cat.lower() in reason.lower():
                matched_cat = cat
                break

        target = cat_data[matched_cat] if matched_cat else other_cat
        target["count"] += 1
        cv = p.get("cost_variance") or 0.0
        if cv > 0:
            target["cost_escalation_total"] += round(cv, 2)
        dm = p.get("schedule_delay_months") or 0.0
        if dm > 0:
            target["delay_months_total"] += round(dm, 1)

        sec = p.get("sector") or "General"
        target["sectors"][sec] = target["sectors"].get(sec, 0) + 1

        if len(target["top_projects"]) < 5:
            target["top_projects"].append({
                "project_id": p.get("project_id"),
                "project_name": p.get("project_name"),
                "cost_variance": p.get("cost_variance"),
                "schedule_delay_months": p.get("schedule_delay_months"),
                "sector": p.get("sector"),
            })

    results = []
    for cat in MOSPI_TAXONOMY:
        d = cat_data[cat]
        cnt = d["count"]
        results.append({
            "category": cat,
            "count": cnt,
            "percentage": round((cnt / delayed_projects_count * 100), 1) if delayed_projects_count else 0.0,
            "cost_escalation_total": round(d["cost_escalation_total"], 2),
            "avg_delay_months": round(d["delay_months_total"] / cnt, 1) if cnt else 0.0,
            "sectors": sorted([{"sector": k, "count": v} for k, v in d["sectors"].items()], key=lambda x: x["count"], reverse=True),
            "top_projects": d["top_projects"],
        })

    results.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_delayed_projects": delayed_projects_count,
        "taxonomy": results,
        "source": "Official MoSPI IPMD Flash Report Delay Classification Standards",
        "data_source": repo.data_source_status(),
    }

