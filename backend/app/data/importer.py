"""
Real PAIMANA data import (CSV / XLSX).

Design rule, enforced throughout this module:
    A field that is absent from the uploaded file stays absent.

Nothing is defaulted, imputed, back-filled or borrowed from the synthetic demo
dataset. Downstream code checks `field_availability` and degrades gracefully
("Not available", "Risk analysis pending") rather than displaying a fabricated
value.
"""

import io
import math
import re
from datetime import datetime

import pandas as pd

# ---------------------------------------------------------------------------
# Column mapping. Each canonical field lists accepted header aliases, matched
# case-insensitively after stripping punctuation and whitespace.
# ---------------------------------------------------------------------------
COLUMN_ALIASES = {
    "project_id": ["project id", "projectid", "project code", "pid", "id", "project no", "project number"],
    "project_name": ["project name", "projectname", "name", "project title", "title", "project"],
    "ministry": ["ministry", "ministry name", "ministry/department", "ministry department", "department"],
    "sector": ["sector", "sector name", "sub sector", "subsector"],
    "implementing_agency": ["implementing agency", "agency", "executing agency", "implementing body", "psu"],
    "region": ["region", "zone", "state", "state/ut", "location"],
    "original_cost": ["original cost", "original approved cost", "approved cost", "sanctioned cost",
                      "original cost (rs cr)", "original cost in cr", "originalcost"],
    "revised_cost": ["revised cost", "latest approved cost", "current cost", "anticipated cost",
                     "revised cost (rs cr)", "revisedcost"],
    "expenditure": ["expenditure", "cumulative expenditure", "expenditure incurred", "exp",
                    "expenditure (rs cr)", "total expenditure"],
    "planned_progress": ["planned progress", "scheduled progress", "target progress", "planned physical progress"],
    "actual_progress": ["actual progress", "physical progress", "progress", "achieved progress",
                        "actual physical progress"],
    "planned_start_date": ["planned start date", "start date", "commencement date", "date of start"],
    "planned_completion_date": ["planned completion date", "original completion date",
                                "scheduled completion date", "original date of completion",
                                "original completion"],
    "expected_completion_date": ["expected completion date", "revised completion date",
                                 "anticipated completion date", "revised date of completion",
                                 "revised completion"],
    "status": ["status", "project status", "current status"],
    "milestone_count": ["milestone count", "total milestones", "milestones"],
    "milestones_completed": ["milestones completed", "completed milestones"],
    "milestone_delays": ["milestone delays", "delayed milestones", "milestones delayed"],
    "schedule_delay_months": ["schedule delay months", "delay months", "delay in months",
                              "time overrun months", "time overrun"],
    "report_month": ["report month", "month", "reporting month", "snapshot month", "period", "as on date", "as on month"],
    "reason_for_delay": ["reason for delay", "delay reason", "reasons for delay", "delay cause", "cause of delay"],
}

REQUIRED_FIELDS = ["project_id", "project_name"]

# Fields the deterministic risk engine needs before it will score a project.
RISK_REQUIRED_FIELDS = ["original_cost", "revised_cost"]
RISK_RECOMMENDED_FIELDS = [
    "expenditure", "planned_progress", "actual_progress", "schedule_delay_months",
]

DATE_FIELDS = [
    "planned_start_date", "planned_completion_date", "expected_completion_date",
]

NUMERIC_FIELDS = [
    "original_cost", "revised_cost", "expenditure", "planned_progress",
    "actual_progress", "milestone_count", "milestones_completed",
    "milestone_delays", "schedule_delay_months",
]


def _normalise_header(h):
    return re.sub(r"[^a-z0-9 ]", " ", str(h).strip().lower())


def _collapse(h):
    return re.sub(r"\s+", " ", _normalise_header(h)).strip()


def build_column_map(columns):
    """Map file headers -> canonical field names. Returns (mapping, unmapped)."""
    mapping = {}
    used = set()
    normalised = {col: _collapse(col) for col in columns}

    for field, aliases in COLUMN_ALIASES.items():
        for col, norm in normalised.items():
            if col in used:
                continue
            if norm in aliases or norm.replace(" ", "") in [a.replace(" ", "") for a in aliases]:
                mapping[field] = col
                used.add(col)
                break

    unmapped = [c for c in columns if c not in used]
    return mapping, unmapped


def _clean_number(value):
    """Parse a numeric cell. Returns None when genuinely absent - never 0."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        return float(value)
    text = str(value).strip()
    if text == "" or text.lower() in {"na", "n/a", "nan", "-", "--", "nil", "none", "not available"}:
        return None
    text = re.sub(r"[,\s]", "", text)
    text = re.sub(r"[^\d.\-]", "", text)
    if text in {"", "-", ".", "-."}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _clean_text(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() in {"na", "n/a", "nan", "none", "-"}:
        return None
    return text


def _clean_date(value):
    if value is None:
        return None
    if isinstance(value, (datetime, pd.Timestamp)):
        if pd.isna(value):
            return None
        return value.strftime("%Y-%m-%d")
    text = _clean_text(value)
    if text is None:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d",
                "%d-%b-%Y", "%d %b %Y", "%b-%y", "%Y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    try:
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
        if pd.isna(parsed):
            return None
        return parsed.strftime("%Y-%m-%d")
    except Exception:
        return None


def _months_between(start_iso, end_iso):
    if not start_iso or not end_iso:
        return None
    try:
        a = datetime.strptime(start_iso, "%Y-%m-%d")
        b = datetime.strptime(end_iso, "%Y-%m-%d")
    except ValueError:
        return None
    return round((b - a).days / 30.44, 1)


def parse_file(file_bytes, filename):
    """Read CSV or XLSX bytes into a DataFrame."""
    lower = (filename or "").lower()
    if lower.endswith(".csv") or lower.endswith(".txt"):
        for encoding in ("utf-8-sig", "utf-8", "latin-1"):
            try:
                return pd.read_csv(io.BytesIO(file_bytes), encoding=encoding, dtype=object)
            except UnicodeDecodeError:
                continue
            except Exception as exc:
                raise ValueError(f"Could not parse CSV file: {exc}")
        raise ValueError("Could not decode CSV file with utf-8 or latin-1.")
    if lower.endswith((".xlsx", ".xlsm", ".xls")):
        try:
            return pd.read_excel(io.BytesIO(file_bytes), dtype=object)
        except Exception as exc:
            raise ValueError(
                f"Could not parse Excel file: {exc}. Ensure openpyxl is installed."
            )
    raise ValueError("Unsupported file type. Upload a .csv, .xlsx or .xls file.")


def import_projects(file_bytes, filename):
    """
    Convert an uploaded PAIMANA extract into the application's project shape.

    Returns a dict with: projects, field_availability, column_map, warnings,
    row statistics and risk-readiness information.
    """
    df = parse_file(file_bytes, filename)
    if df is None or df.empty:
        raise ValueError("The uploaded file contains no data rows.")

    df.columns = [str(c) for c in df.columns]
    column_map, unmapped = build_column_map(list(df.columns))

    missing_required = [f for f in REQUIRED_FIELDS if f not in column_map]
    if missing_required:
        raise ValueError(
            "The file is missing required column(s): "
            + ", ".join(missing_required)
            + ". Expected a project identifier column and a project name column."
        )

    projects = []
    warnings = []
    has_month_col = "report_month" in column_map
    raw_records = []
    skipped_rows = 0
    duplicate_ids = 0

    for position, (_, row) in enumerate(df.iterrows(), start=2):
        record = {}

        for field, source_col in column_map.items():
            raw = row.get(source_col)
            if field in NUMERIC_FIELDS:
                record[field] = _clean_number(raw)
            elif field in DATE_FIELDS:
                record[field] = _clean_date(raw)
            else:
                record[field] = _clean_text(raw)

        project_id = record.get("project_id")
        if project_id is None:
            skipped_rows += 1
            continue
        project_id = str(project_id).strip()
        record["project_id"] = project_id

        if not record.get("project_name"):
            record["project_name"] = f"Project {project_id}"

        # ---- Derived fields, computed ONLY where the inputs actually exist ----
        oc, rc, exp = record.get("original_cost"), record.get("revised_cost"), record.get("expenditure")

        if oc is not None and rc is not None:
            record["cost_variance"] = round(rc - oc, 2)
            record["cost_variance_pct"] = round(((rc - oc) / oc) * 100, 2) if oc else None
        else:
            record["cost_variance"] = None
            record["cost_variance_pct"] = None

        if exp is not None and rc:
            record["expenditure_ratio"] = round(exp / rc, 3)
        elif exp is not None and oc:
            record["expenditure_ratio"] = round(exp / oc, 3)
        else:
            record["expenditure_ratio"] = None

        pp, ap = record.get("planned_progress"), record.get("actual_progress")
        record["progress_gap"] = round(pp - ap, 2) if (pp is not None and ap is not None) else None

        if record.get("schedule_delay_months") is None:
            record["schedule_delay_months"] = _months_between(
                record.get("planned_completion_date"),
                record.get("expected_completion_date"),
            )

        mc, md = record.get("milestone_count"), record.get("milestone_delays")
        record["milestone_delay_ratio"] = round(md / mc, 3) if (mc and md is not None) else None

        record["data_source_type"] = "REAL"
        record["data_source_label"] = f"Imported PAIMANA data - {filename}"
        record["candidate_variables"] = None

        raw_records.append(record)

    if not raw_records:
        raise ValueError("No rows with a usable project identifier were found in the file.")

    if has_month_col:
        from collections import defaultdict
        grouped = defaultdict(list)
        for r in raw_records:
            grouped[r["project_id"]].append(r)

        projects = []
        for pid, snaps in grouped.items():
            snaps_sorted = sorted([dict(s) for s in snaps], key=lambda s: str(s.get("report_month") or ""))
            latest = snaps_sorted[-1]
            root_proj = dict(latest)
            root_proj["history"] = [dict(s) for s in snaps_sorted]
            root_proj["has_history"] = len(snaps_sorted) > 1
            root_proj["history_months_count"] = len(snaps_sorted)
            if len(snaps_sorted) <= 1:
                root_proj["history_note"] = "Insufficient history for trend analysis"
            projects.append(root_proj)
    else:
        projects = []
        seen_ids = set()
        for pos, r in enumerate(raw_records, start=2):
            pid = r["project_id"]
            if pid in seen_ids:
                duplicate_ids += 1
                pid = f"{pid}__{pos}"
                r["project_id"] = pid
            seen_ids.add(pid)
            snap = dict(r)
            root_proj = dict(r)
            root_proj["history"] = [snap]
            root_proj["has_history"] = False
            root_proj["history_months_count"] = 1
            root_proj["history_note"] = "Insufficient history for trend analysis"
            projects.append(root_proj)

    if not projects:
        raise ValueError("No rows with a usable project identifier were found in the file.")

    # ---- Field availability: what fraction of rows actually carry each field ----
    total = len(projects)
    field_availability = {}
    all_fields = list(COLUMN_ALIASES.keys()) + [
        "cost_variance", "cost_variance_pct", "expenditure_ratio",
        "progress_gap", "milestone_delay_ratio",
    ]
    for field in all_fields:
        present = sum(1 for p in projects if p.get(field) is not None)
        field_availability[field] = {
            "present_rows": present,
            "total_rows": total,
            "coverage_pct": round(present / total * 100, 1) if total else 0.0,
            "mapped_from": column_map.get(field),
            "available": present > 0,
        }

    # ---- Risk readiness ----
    missing_for_risk = [
        f for f in RISK_REQUIRED_FIELDS if not field_availability.get(f, {}).get("available")
    ]
    risk_ready = len(missing_for_risk) == 0
    weak_fields = [
        f for f in RISK_RECOMMENDED_FIELDS if not field_availability.get(f, {}).get("available")
    ]

    if skipped_rows:
        warnings.append(f"{skipped_rows} row(s) skipped: no project identifier.")
    if duplicate_ids:
        warnings.append(f"{duplicate_ids} duplicate project ID(s) found; these were suffixed to keep them distinct.")
    if unmapped:
        warnings.append(
            f"{len(unmapped)} column(s) in the file were not recognised and were ignored: "
            + ", ".join(unmapped[:8]) + ("..." if len(unmapped) > 8 else "")
        )
    if not risk_ready:
        warnings.append(
            "Risk scoring is unavailable for this dataset: missing "
            + ", ".join(missing_for_risk)
            + ". The dashboard will show 'Risk analysis pending' instead of estimated values."
        )
    if risk_ready and weak_fields:
        warnings.append(
            "Partial risk scoring only. These fields are absent, so their risk components "
            "are excluded rather than estimated: " + ", ".join(weak_fields) + "."
        )

    return {
        "projects": projects,
        "field_availability": field_availability,
        "column_map": column_map,
        "unmapped_columns": unmapped,
        "warnings": warnings,
        "row_count": total,
        "skipped_rows": skipped_rows,
        "risk_ready": risk_ready,
        "missing_for_risk": missing_for_risk,
        "partially_missing_for_risk": weak_fields,
        "filename": filename,
        "imported_at": datetime.now().isoformat(timespec="seconds"),
    }
