from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.data.repository import ProjectRepository

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("")
def list_projects(
    search: Optional[str] = Query(None, description="Search term for project name, ID, agency"),
    ministry: Optional[str] = Query(None, description="Filter by ministry"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    region: Optional[str] = Query(None, description="Filter by region"),
    risk_level: Optional[str] = Query(None, description="Filter by risk category: LOW, MEDIUM, HIGH, CRITICAL"),
    status: Optional[str] = Query(None, description="Filter by status"),
    sort_by: Optional[str] = Query("risk_score", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=500)
):
    repo = ProjectRepository()
    return repo.get_all(
        search=search,
        ministry=ministry,
        sector=sector,
        region=region,
        risk_level=risk_level,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit
    )

@router.get("/filters")
def get_filter_options():
    repo = ProjectRepository()
    projects = repo.projects

    def distinct(field):
        return sorted({p[field] for p in projects if p.get(field)})

    return {
        "ministries": ["All"] + distinct("ministry"),
        "sectors": ["All"] + distinct("sector"),
        "regions": ["All"] + distinct("region"),
        "risk_levels": ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"],
        "statuses": ["All"] + distinct("status"),
        "data_source": repo.data_source_status(),
    }

@router.get("/alerts")
def list_all_alerts(
    severity: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=500),
):
    repo = ProjectRepository()
    return repo.get_alerts(severity=severity, page=page, limit=limit)

@router.get("/{project_id}/history")
def get_project_history(project_id: str):
    repo = ProjectRepository()
    project = repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    history = project.get("history") or []
    return {
        "project_id": project.get("project_id"),
        "project_name": project.get("project_name"),
        "total_months": len(history),
        "history": history,
    }

@router.get("/{project_id}")
def get_project_details(project_id: str):
    repo = ProjectRepository()
    project = repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project

@router.get("/{project_id}/risk")
def get_project_risk(project_id: str):
    repo = ProjectRepository()
    project = repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project["risk"]

@router.get("/{project_id}/alerts")
def get_project_alerts(project_id: str):
    repo = ProjectRepository()
    project = repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project["risk"].get("alerts", [])
