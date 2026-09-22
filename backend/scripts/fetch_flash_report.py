"""
PAIMANA-AI: MoSPI Flash Report Offline Ingestion Utility.

This script parses a manually downloaded MoSPI Central Sector Projects Flash Report
(downloaded from the IPMD portal at https://ipm.mospi.gov.in as an XLSX or CSV file)
into the canonical CSV format expected by PAIMANA-AI's real-data importer.

IMPORTANT NOTE:
This is an offline/manual tool. The official MoSPI IPMD portal enforces Captcha and
blocks automated scraping. Users must download the Flash Report spreadsheet manually
from the portal and point this script to the downloaded file.

Usage:
    python fetch_flash_report.py --input path/to/flash_report.xlsx --output output_paimana.csv
"""

import argparse
import os
import sys
import re
from pathlib import Path
import pandas as pd


COLUMN_MAPPINGS = {
    "project_id": ["project id", "proj code", "pid", "id", "sl no", "sr no", "project number"],
    "project_name": ["project name", "name of project", "project", "title"],
    "ministry": ["ministry", "ministry / department", "ministry/dept", "dept"],
    "sector": ["sector", "sub sector"],
    "implementing_agency": ["implementing agency", "agency", "executing agency", "psu"],
    "original_cost": ["original cost", "sanctioned cost", "approved cost", "original cost (rs cr)"],
    "revised_cost": ["revised cost", "anticipated cost", "latest approved cost", "cost (revised)"],
    "expenditure": ["cumulative expenditure", "expenditure", "expenditure incurred", "expenditure (rs cr)"],
    "planned_progress": ["planned progress", "target progress", "scheduled progress"],
    "actual_progress": ["actual progress", "physical progress (%)", "progress (%)", "actual physical progress"],
    "planned_start_date": ["date of approval", "date of start", "sanction date", "commencement date"],
    "planned_completion_date": ["original date of commissioning", "original date of completion", "scheduled date"],
    "expected_completion_date": ["anticipated date of commissioning", "revised date of completion", "anticipated date"],
    "delay_months": ["delay with respect to original date (months)", "delay in months", "time overrun (months)"],
    "milestones_total": ["total milestones", "milestones"],
    "milestones_completed": ["milestones achieved", "completed milestones"],
}


def clean_col(c):
    return re.sub(r"[^a-z0-9 ]", " ", str(c).lower()).strip()


def parse_flash_report(input_file: str, output_file: str, report_month: str = "2026-04"):
    input_path = Path(input_file)
    if not input_path.exists():
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)

    print(f"Reading MoSPI Flash Report from: {input_path}")
    if input_path.suffix.lower() in [".xlsx", ".xls"]:
        df = pd.read_excel(input_path)
    else:
        df = pd.read_csv(input_path)

    print(f"Original shape: {df.shape[0]} rows, {df.shape[1]} columns")

    # Match columns
    norm_cols = {c: clean_col(c) for c in df.columns}
    col_map = {}
    for target, aliases in COLUMN_MAPPINGS.items():
        for orig, norm in norm_cols.items():
            if norm in aliases or any(a in norm for a in aliases):
                col_map[orig] = target
                break

    mapped_df = df.rename(columns=col_map)
    out = pd.DataFrame()

    # Ensure required columns
    if "project_id" in mapped_df.columns:
        out["project_id"] = mapped_df["project_id"].astype(str)
    else:
        out["project_id"] = [f"MOSPI-{i+1}" for i in range(len(mapped_df))]

    if "project_name" in mapped_df.columns:
        out["project_name"] = mapped_df["project_name"].astype(str)
    else:
        out["project_name"] = [f"Central Sector Project {i+1}" for i in range(len(mapped_df))]

    # Copy standard fields
    for field in [
        "ministry", "sector", "implementing_agency", "original_cost", "revised_cost",
        "expenditure", "planned_progress", "actual_progress", "planned_start_date",
        "planned_completion_date", "expected_completion_date"
    ]:
        if field in mapped_df.columns:
            out[field] = mapped_df[field]

    out["report_month"] = report_month
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)
    print(f"Successfully converted {len(out)} projects to canonical CSV: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse MoSPI IPMD Flash Report to PAIMANA-AI CSV")
    parser.add_argument("--input", "-i", required=True, help="Path to downloaded MoSPI Flash Report (.xlsx/.csv)")
    parser.add_argument("--output", "-o", default="mospi_flash_report_paimana.csv", help="Destination CSV path")
    parser.add_argument("--month", "-m", default="2026-04", help="Reporting month in YYYY-MM format")
    args = parser.parse_args()

    parse_flash_report(args.input, args.output, args.month)
