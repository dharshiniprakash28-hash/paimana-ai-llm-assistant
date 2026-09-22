from fastapi import APIRouter
from app.data.repository import ProjectRepository
from app.core.national_stats import get_national_reference

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary():
    repo = ProjectRepository()
    return repo.get_dashboard_summary()


@router.get("/national-reference")
def national_reference():
    """
    National PAIMANA macro statistics quoted from problem statement SIH26103
    (April 2026). Not derived from the dataset loaded in this application.
    """
    return get_national_reference()
