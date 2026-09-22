"""
Data source endpoints.

Lets the client see, switch and populate the two strictly separate datasets:
DEMO (500 synthetic projects) and REAL (an imported PAIMANA CSV/XLSX extract).
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.national_stats import get_national_reference
from app.data.datasource import DataSourceManager
from app.data.importer import COLUMN_ALIASES, REQUIRED_FIELDS, import_projects
from app.data.repository import ProjectRepository

router = APIRouter(prefix="/datasource", tags=["Data Source"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


class ModeRequest(BaseModel):
    mode: str


@router.get("")
def get_status():
    return DataSourceManager().status()


@router.get("/national-reference")
def national_reference():
    """
    Macro reference statistics from problem statement SIH26103 (April 2026).
    These are national figures and are NOT derived from the loaded dataset.
    """
    return get_national_reference()


@router.get("/schema")
def expected_schema():
    """Column names the importer recognises, to help users prepare a file."""
    return {
        "required_fields": REQUIRED_FIELDS,
        "recognised_columns": {
            field: aliases for field, aliases in COLUMN_ALIASES.items()
        },
        "supported_formats": [".csv", ".xlsx", ".xls"],
        "note": (
            "Header matching is case-insensitive and ignores punctuation. Any column "
            "not recognised is ignored. Fields absent from the file remain absent - "
            "no value is imputed or copied from the demo dataset."
        ),
    }


@router.get("/sample-csv")
def download_sample_csv():
    """Download a standardized sample PAIMANA CSV extract to test the importer."""
    sample_path = Path(__file__).parent.parent / "data" / "sample_paimana_extract.csv"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="Sample CSV not found.")
    return FileResponse(
        path=str(sample_path),
        filename="paimana_sample_extract.csv",
        media_type="text/csv"
    )


@router.post("/mode")
def set_mode(req: ModeRequest):
    ds = DataSourceManager()
    try:
        status = ds.set_mode(req.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    ProjectRepository().refresh()
    return status


@router.post("/import")
async def import_dataset(file: UploadFile = File(...), activate: bool = True):
    """Import a real PAIMANA extract from CSV or XLSX."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
        )

    try:
        result = import_projects(contents, file.filename or "upload")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail=f"Import failed: {exc}")

    ds = DataSourceManager()
    status = ds.set_imported(result, activate=activate)
    ProjectRepository().refresh()

    return {
        "success": True,
        "imported_rows": result["row_count"],
        "skipped_rows": result["skipped_rows"],
        "column_map": result["column_map"],
        "unmapped_columns": result["unmapped_columns"],
        "field_availability": result["field_availability"],
        "warnings": result["warnings"],
        "risk_ready": result["risk_ready"],
        "missing_for_risk": result["missing_for_risk"],
        "partially_missing_for_risk": result["partially_missing_for_risk"],
        "data_source": status,
        "note": (
            "Fields absent from the uploaded file remain absent. No values, risk scores "
            "or candidate variables were copied from the synthetic demo dataset."
        ),
    }


@router.delete("/import")
def clear_import():
    """Discard the imported dataset and return to demo data."""
    status = DataSourceManager().clear_imported()
    ProjectRepository().refresh()
    return status
