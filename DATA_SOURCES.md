# PAIMANA-AI Data Sources & Field Dictionary

This document details the data lineage, reference benchmarks, and field classification for **PAIMANA-AI**, built for Smart India Hackathon problem statement **SIH26103** (Ministry of Statistics and Programme Implementation - MoSPI).

---

## 1. Grounding in Official MoSPI Statistics

Synthetic demonstration data is calibrated directly against published monthly **Flash Reports on Central Sector Projects** released by the **Infrastructure and Project Monitoring Division (IPMD)** of MoSPI (`ipm.mospi.gov.in`):

| National Benchmark Metric | MoSPI Flash Report Reference Range | PAIMANA-AI Generator Calibration |
|---|---|---|
| **Total Monitored Portfolio** | 1,800 – 1,981 projects (costing ₹150 Cr and above) | 500 demo projects (scaled sample; 1,981 national reference) |
| **Cost Overrun Rate** | ~23.0% – 27.5% of projects report cost escalation | Calibrated baseline target: ~25.0% |
| **Schedule Delay Rate** | ~30.0% – 45.0% of projects report completion delays | Calibrated baseline target: ~38.0% |
| **Sector Concentration** | Transport & Logistics (Road Transport & Highways, Railways, Ports, Aviation) represents ~65%–70% of projects and expenditure | Transport sectors weighted ~65% in generator |

### Verbatim Delay Taxonomy (MoSPI Flash Report Standards)
The generator draws delay reasons verbatim from the 8 official delay categories reported to IPMD:
1. **Land acquisition delay** — Right of way bottlenecks and compensation settlements.
2. **Forest / environmental clearance delay** — Stage-I/II clearances, eco-sensitive zone clearances.
3. **Financing tie-up delay** — State share contributions, multilateral loan covenants.
4. **Contractor / tendering issues** — Slow EPC mobilization, retendering, contract disputes.
5. **Law and order problems** — Local protests, security clearance restrictions.
6. **Geological surprises** — Difficult terrain, seismic faults, tunnel water ingress.
7. **Utility shifting** — Electrical transmission lines, water pipelines, telecommunications cables.
8. **Lack of infrastructure linkages** — Dedicated power feeds, approach rail sidings or roads.

---

## 2. Field Classification: CUF vs. Candidate vs. Derived

In addressing SIH26103 dimension *(c)* ("to what extent is predictive performance attributable to existing CUF fields vs. additional candidate variables"), PAIMANA-AI distinguishes three categories of fields:

### (A) Canonical CUF Fields (Core Utility Framework)
These fields exist in standard MoSPI / PAIMANA monitoring returns and are expected in live extracts:
- `project_id`: Unique alphanumeric project code (e.g. `PRJ-101`, `RLY-001`).
- `project_name`: Descriptive name of the infrastructure scheme.
- `ministry`: Nodal Central Ministry or Department.
- `sector`: Infrastructure sector/subsector classification.
- `implementing_agency`: Executing PSU or departmental agency (e.g. NHAI, RVNL, NTPC).
- `region`: Geographic zone / State / UT.
- `original_cost`: Sanctioned / Cabinet-approved cost in ₹ Crore.
- `revised_cost`: Latest approved / anticipated completion cost in ₹ Crore.
- `expenditure`: Cumulative actual expenditure incurred to date in ₹ Crore.
- `planned_progress`: Target physical progress percentage (0.0% to 100.0%).
- `actual_progress`: Realised physical progress percentage (0.0% to 100.0%).
- `planned_start_date`: Date of scheduled work commencement (`YYYY-MM-DD`).
- `planned_completion_date`: Original scheduled completion target (`YYYY-MM-DD`).
- `expected_completion_date`: Revised or anticipated completion target (`YYYY-MM-DD`).
- `milestone_count`: Total defined physical / engineering milestones.
- `milestones_completed`: Milestones achieved to date.
- `milestone_delays`: Count of milestones overdue or delayed.
- `status`: Current execution status (`In Progress`, `Delayed`, `Ahead of Schedule`, `Completed`).

### (B) Proposed Candidate Variables (Experimental Extensions)
These leading indicators do **not** exist in the public PAIMANA dataset today. They represent candidate fields that PAIMANA-AI evaluates to measure predictive uplift when capturing early risk signals:
- `contractor_rating`: Prior performance / qualification index of primary contractor (1.0 to 5.0).
- `land_acquisition_status`: Qualitative land availability milestone status (e.g. `Completed`, `Partial (80%)`, `Pending Clearance (45%)`, `Severe Bottleneck (20%)`).
- `land_acquisition_delay_days`: Days of schedule overrun specifically tied to land parcel handover.
- `environmental_clearance`: Stage of statutory ecological clearance (`Granted`, `Under Review`, `Pending In-Principle`, `Delayed`).
- `tender_contract_issues`: Binary flag (0 or 1) indicating active dispute, arbitration, or retendering.
- `weather_disruption_days`: Days of extreme weather / flood disruption exceeding normal seasonal allowance.
- `material_price_escalation_pct`: Weighted construction input inflation (cement, steel, bitumen).
- `labour_availability_index`: Peak vs available skilled labour ratio (0.0 to 1.0).
- `funding_payment_delay_days`: Average delay in milestone invoice settlement by the project authority.

### (C) Derived / Computed Variables
These fields are strictly computed arithmetically at runtime from available primary inputs and are labeled as "Derived estimates":
- `cost_variance`: `revised_cost - original_cost` (₹ Crore).
- `cost_variance_pct`: `((revised_cost - original_cost) / original_cost) * 100` (%).
- `progress_gap`: `planned_progress - actual_progress` (percentage points).
- `expenditure_ratio`: `expenditure / revised_cost`.
- `schedule_delay_months`: Difference between `expected_completion_date` and `planned_completion_date` (in months).
- `milestone_delay_ratio`: `milestone_delays / milestone_count`.
- `early_warning_trend`: Rolling-window trajectory indicator evaluating month-over-month expenditure burn rate vs actual physical progress slope over 3+ consecutive reporting months.

---

## 3. Monthly Panel Structure

Rather than single static snapshots, PAIMANA-AI models infrastructure monitoring as a longitudinal **monthly panel dataset** across 18–36 consecutive months.

```
Project (Static Root):
  ├── project_id, project_name, ministry, sector, implementing_agency, region
  ├── original_cost, planned_start_date, planned_completion_date, milestone_count
  └── history: Array of ProjectMonthlySnapshot
        ├── report_month ("YYYY-MM")
        ├── revised_cost, expenditure_cumulative
        ├── planned_progress_pct, actual_progress_pct
        ├── milestones_completed, milestone_delays
        ├── expected_completion_date, schedule_delay_months
        ├── reason_for_delay (MoSPI categorical cause + specific note)
        └── candidate_variables (contractor_rating, land_delay, env_clearance...)
```

When importing real data, if only a single reporting month is provided, the system gracefully degrades to snapshot-only analysis with explicit notice: *"Insufficient history for trend analysis"*.
