"""
PAIMANA-AI synthetic demo dataset generator.

IMPORTANT: Everything produced by this module is SYNTHETIC DEMONSTRATION DATA.
It is not official PAIMANA data and must always be labelled as such in the UI.

Design note (SIH26103):
The generator models a longitudinal MONTHLY PANEL dataset (18–36 consecutive
monthly snapshots per project) rather than a single static snapshot.
The generator draws a latent "execution persona" per project first, then emits
BOTH:
  * leading indicators  -> knowable early in the lifecycle (contractor rating,
                           land acquisition, clearances, material inflation...)
  * lagging outcomes    -> cost variance, schedule delay, progress gap, evolving
                           gradually over time across reporting months.
The ML evaluation pipeline predicts the lagging outcome from the leading
indicators only, so the comparison between the conventional statistical
baseline and the ML model is a genuine learning problem rather than a
tautology. Outcome "drift" is injected so leading indicators are informative
but not deterministic.
"""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

try:
    from app.data.generator_config import (
        SECTOR_WEIGHTINGS,
        MOSPI_DELAY_TAXONOMY,
        DEFAULT_PANEL_MONTHS,
        PANEL_START_YEAR,
        PANEL_START_MONTH,
    )
except ImportError:
    from generator_config import (
        SECTOR_WEIGHTINGS,
        MOSPI_DELAY_TAXONOMY,
        DEFAULT_PANEL_MONTHS,
        PANEL_START_YEAR,
        PANEL_START_MONTH,
    )

DEFAULT_PROJECT_COUNT = 500
RANDOM_SEED = 42

DATA_SOURCE_LABEL = (
    "DEMO / SYNTHETIC DATA (SIH26103 Prototype - Not official PAIMANA data)"
)

# ---------------------------------------------------------------------------
# Central Government infrastructure ministries / departments.
# ---------------------------------------------------------------------------
MINISTRIES = [
    {
        "ministry": "Ministry of Road Transport and Highways (MoRTH)",
        "sectors": ["Expressways", "National Highways", "Economic Corridors", "Coastal Roads"],
        "agencies": ["NHAI", "NHIDCL", "MoRTH Highway Division"],
        "cost_range": (600, 16000),
        "duration_range": (24, 60),
    },
    {
        "ministry": "Ministry of Railways",
        "sectors": ["Dedicated Freight Corridors", "High-Speed Rail", "Track Doubling", "Station Redevelopment"],
        "agencies": ["RVNL", "IRCON", "DFCCIL", "NHSRCL", "CRIS"],
        "cost_range": (800, 22000),
        "duration_range": (30, 72),
    },
    {
        "ministry": "Ministry of Power",
        "sectors": ["Ultra Mega Solar Parks", "Transmission Grids", "Hydroelectric Projects", "Thermal Modernization"],
        "agencies": ["PGCIL", "NTPC", "NHPC", "SJVN", "SECI"],
        "cost_range": (400, 15000),
        "duration_range": (24, 66),
    },
    {
        "ministry": "Ministry of Housing and Urban Affairs (MoHUA)",
        "sectors": ["Metro Rail Systems", "Smart City Infrastructure", "Regional Rapid Transit (RRTS)", "Urban Water Supply"],
        "agencies": ["DMRC", "NCRTC", "State Metro Corporations", "CPWD", "Smart City SPV"],
        "cost_range": (500, 18000),
        "duration_range": (30, 72),
    },
    {
        "ministry": "Ministry of Ports, Shipping and Waterways",
        "sectors": ["Deepwater Container Terminals", "Inland Waterways", "Sagarmala Connectivity", "Port Modernization"],
        "agencies": ["JNPA", "V.O. Chidambaranar Port Authority", "IWAI", "Cochin Shipyard"],
        "cost_range": (300, 9000),
        "duration_range": (24, 54),
    },
    {
        "ministry": "Ministry of Jal Shakti",
        "sectors": ["River Interlinking", "Clean Ganga (NMCG)", "National Hydrology", "Multipurpose Irrigation"],
        "agencies": ["NWDA", "NMCG", "WAPCOS", "State Irrigation Depts"],
        "cost_range": (250, 12000),
        "duration_range": (30, 72),
    },
    {
        "ministry": "Ministry of Petroleum and Natural Gas",
        "sectors": ["Cross-Country Pipelines", "Strategic Petroleum Reserves", "City Gas Distribution", "Refinery Expansion"],
        "agencies": ["GAIL", "IOCL", "BPCL", "ISPRL", "HPCL"],
        "cost_range": (400, 20000),
        "duration_range": (24, 60),
    },
    {
        "ministry": "Ministry of Coal",
        "sectors": ["Coal Mine Development", "Coal Evacuation Infrastructure", "Coal Washeries"],
        "agencies": ["Coal India Limited", "NLC India", "SCCL", "CMPDI"],
        "cost_range": (200, 8000),
        "duration_range": (18, 54),
    },
    {
        "ministry": "Ministry of Steel",
        "sectors": ["Integrated Steel Plants", "Steel Capacity Expansion", "Raw Material Logistics"],
        "agencies": ["SAIL", "RINL", "NMDC", "MECON"],
        "cost_range": (500, 14000),
        "duration_range": (24, 60),
    },
    {
        "ministry": "Ministry of New and Renewable Energy",
        "sectors": ["Solar Park Development", "Offshore Wind", "Green Hydrogen Infrastructure"],
        "agencies": ["SECI", "IREDA", "NIWE", "NISE"],
        "cost_range": (200, 11000),
        "duration_range": (18, 48),
    },
    {
        "ministry": "Ministry of Civil Aviation",
        "sectors": ["Greenfield Airports", "Airport Terminal Expansion", "Air Navigation Systems"],
        "agencies": ["AAI", "AAICLAS", "Airport SPVs"],
        "cost_range": (250, 10000),
        "duration_range": (24, 54),
    },
    {
        "ministry": "Ministry of Heavy Industries",
        "sectors": ["Capital Goods Capacity", "EV Manufacturing Infrastructure", "Machine Tools Modernization"],
        "agencies": ["BHEL", "HMT", "Heavy Engineering Corporation"],
        "cost_range": (150, 6000),
        "duration_range": (18, 48),
    },
    {
        "ministry": "Department of Telecommunications",
        "sectors": ["National Optical Fibre Backbone", "Rural Connectivity (BharatNet)"],
        "agencies": ["BSNL", "BBNL", "TCIL", "C-DOT"],
        "cost_range": (150, 9000),
        "duration_range": (18, 48),
    },
]

REGIONS = ["North", "South", "East", "West", "Central", "North-East"]

PROJECT_NAME_PATTERNS = [
    "{region} Phase-{phase} {sector} Expansion",
    "{location} to {dest} {sector} Corridor",
    "{location} Multi-Modal {sector} Hub",
    "National {sector} Mission - Package {phase}",
    "{location} Integrated {sector} Development",
    "{location} {sector} Upgradation Phase-{phase}",
]

LOCATIONS = [
    ("Delhi", "Amritsar"), ("Mumbai", "Ahmedabad"), ("Varanasi", "Kolkata"),
    ("Bengaluru", "Chennai"), ("Hyderabad", "Vijayawada"), ("Guwahati", "Silchar"),
    ("Bhopal", "Indore"), ("Jaipur", "Jodhpur"), ("Kochi", "Coimbatore"),
    ("Patna", "Ranchi"), ("Chandigarh", "Shimla"), ("Bhubaneswar", "Puri"),
    ("Nagpur", "Raipur"), ("Visakhapatnam", "Kakinada"), ("Pune", "Nashik"),
    ("Lucknow", "Kanpur"), ("Dhanbad", "Asansol"), ("Surat", "Vadodara"),
    ("Madurai", "Tuticorin"), ("Itanagar", "Dibrugarh"),
]

# Risk persona distribution
PERSONA_WEIGHTS = [("critical", 0.10), ("high", 0.20), ("medium", 0.38), ("low", 0.32)]

# Leading-indicator profiles per persona
PERSONA_PROFILE = {
    "critical": {
        "contractor_rating": (1.2, 3.0),
        "land_delay_days": (140, 450),
        "weather_days": (25, 90),
        "material_inflation": (12.0, 32.0),
        "labour_index": (0.38, 0.70),
        "funding_delay": (45, 180),
        "tender_issue_p": 0.75,
        "env_choices": ["Delayed", "Pending In-Principle", "Under Review"],
        "land_status": ["Severe Bottleneck (20%)", "Pending Clearance (45%)"],
    },
    "high": {
        "contractor_rating": (2.0, 3.6),
        "land_delay_days": (70, 230),
        "weather_days": (15, 55),
        "material_inflation": (8.0, 23.0),
        "labour_index": (0.55, 0.82),
        "funding_delay": (20, 95),
        "tender_issue_p": 0.40,
        "env_choices": ["Pending In-Principle", "Under Review", "Granted"],
        "land_status": ["Pending Clearance (45%)", "Partial (80%)"],
    },
    "medium": {
        "contractor_rating": (2.8, 4.4),
        "land_delay_days": (10, 110),
        "weather_days": (5, 35),
        "material_inflation": (4.0, 15.0),
        "labour_index": (0.70, 0.92),
        "funding_delay": (0, 50),
        "tender_issue_p": 0.15,
        "env_choices": ["Granted", "Under Review"],
        "land_status": ["Partial (80%)", "Completed"],
    },
    "low": {
        "contractor_rating": (3.6, 5.0),
        "land_delay_days": (0, 45),
        "weather_days": (0, 20),
        "material_inflation": (1.0, 9.0),
        "labour_index": (0.82, 0.99),
        "funding_delay": (0, 20),
        "tender_issue_p": 0.04,
        "env_choices": ["Granted"],
        "land_status": ["Completed", "Partial (80%)"],
    },
}

# Outcome profiles per persona (the lagging variables the model must predict)
PERSONA_OUTCOME = {
    "critical": {
        "cost_factor": (1.22, 1.70),
        "progress_gap": (18.0, 42.0),
        "delay_months": (13, 36),
        "milestone_done_frac": (0.05, 0.45),
        "milestone_delay_frac": (0.40, 1.00),
        "status": ["Critical Delay", "Delayed"],
    },
    "high": {
        "cost_factor": (1.09, 1.30),
        "progress_gap": (10.0, 24.0),
        "delay_months": (7, 18),
        "milestone_done_frac": (0.20, 0.62),
        "milestone_delay_frac": (0.25, 0.60),
        "status": ["Delayed"],
    },
    "medium": {
        "cost_factor": (0.99, 1.13),
        "progress_gap": (2.0, 13.0),
        "delay_months": (1, 9),
        "milestone_done_frac": (0.30, 0.78),
        "milestone_delay_frac": (0.05, 0.32),
        "status": ["In Progress"],
    },
    "low": {
        "cost_factor": (0.97, 1.04),
        "progress_gap": (-7.0, 3.0),
        "delay_months": (0, 2),
        "milestone_done_frac": (0.45, 1.00),
        "milestone_delay_frac": (0.00, 0.12),
        "status": ["In Progress", "Ahead of Schedule"],
    },
}

OUTCOME_DRIFT_PROBABILITY = 0.22
PERSONA_ORDER = ["low", "medium", "high", "critical"]


def _u(rng, bounds, ndigits=2):
    return round(rng.uniform(bounds[0], bounds[1]), ndigits)


def _drift_persona(rng, persona):
    if rng.random() >= OUTCOME_DRIFT_PROBABILITY:
        return persona
    idx = PERSONA_ORDER.index(persona)
    step = rng.choice([-1, 1])
    return PERSONA_ORDER[max(0, min(len(PERSONA_ORDER) - 1, idx + step))]


def generate_reporting_months(start_year=PANEL_START_YEAR, start_month=PANEL_START_MONTH, count=DEFAULT_PANEL_MONTHS):
    months = []
    y, m = start_year, start_month
    for _ in range(count):
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def generate_synthetic_projects(count=DEFAULT_PROJECT_COUNT, seed=RANDOM_SEED, panel_months=DEFAULT_PANEL_MONTHS):
    rng = random.Random(seed)
    projects = []
    base_date = datetime(2023, 1, 1)

    personas = [p for p, _ in PERSONA_WEIGHTS]
    persona_w = [w for _, w in PERSONA_WEIGHTS]

    # Weighted ministries calibration
    min_weights = [SECTOR_WEIGHTINGS.get(m["ministry"], 0.05) for m in MINISTRIES]
    reporting_months = generate_reporting_months(count=panel_months)

    for i in range(1, count + 1):
        min_info = rng.choices(MINISTRIES, weights=min_weights)[0]
        ministry = min_info["ministry"]
        sector = rng.choice(min_info["sectors"])
        agency = rng.choice(min_info["agencies"])
        region = rng.choice(REGIONS)

        loc_pair = rng.choice(LOCATIONS)
        phase = rng.choice(["I", "II", "III", "IV", "V"])
        pattern = rng.choice(PROJECT_NAME_PATTERNS)
        project_name = pattern.format(
            region=region, sector=sector, phase=phase,
            location=loc_pair[0], dest=loc_pair[1],
        )

        project_id = f"PRJ-{100 + i}"

        # ---------------- latent execution persona ----------------
        persona = rng.choices(personas, weights=persona_w)[0]
        lead = PERSONA_PROFILE[persona]

        # ---------------- planning-stage (static) attributes ----------------
        original_cost = round(rng.uniform(*min_info["cost_range"]), 2)
        planned_duration_months = rng.randint(*min_info["duration_range"])

        planned_start = base_date + timedelta(days=rng.randint(-900, 200))
        planned_completion = planned_start + timedelta(days=planned_duration_months * 30)

        contractor_rating = _u(rng, lead["contractor_rating"], 1)
        land_delay_days = rng.randint(*[int(v) for v in lead["land_delay_days"]])
        weather_days = rng.randint(*[int(v) for v in lead["weather_days"]])
        material_inflation = _u(rng, lead["material_inflation"], 1)
        labour_index = _u(rng, lead["labour_index"], 2)
        funding_delay = rng.randint(*[int(v) for v in lead["funding_delay"]])
        tender_issues = 1 if rng.random() < lead["tender_issue_p"] else 0
        env_clearance = rng.choice(lead["env_choices"])
        land_acquisition_status = rng.choice(lead["land_status"])

        milestone_total = rng.randint(5, 20)

        # ---------------- realised final outcome targets ----------------
        realised = _drift_persona(rng, persona)
        out = PERSONA_OUTCOME[realised]

        final_cost_factor = rng.uniform(*out["cost_factor"])
        final_progress_gap = rng.uniform(*out["progress_gap"])
        final_delay_months = rng.randint(*[int(v) for v in out["delay_months"]])
        final_milestones_done = max(0, min(milestone_total, int(round(
            milestone_total * rng.uniform(*out["milestone_done_frac"])))))
        final_milestone_delays = max(0, min(milestone_total, int(round(
            milestone_total * rng.uniform(*out["milestone_delay_frac"])))))
        final_status = rng.choice(out["status"])
        final_planned_progress = round(rng.uniform(30.0, 96.0), 1)

        # Pre-assign sticky delay categories across 4-month windows
        sticky_delay_cats = [
            rng.choice(MOSPI_DELAY_TAXONOMY)
            for _ in range((panel_months // 4) + 2)
        ]

        # ---------------- Monthly Panel Evolution ----------------
        snapshots = []
        for m_idx, r_month in enumerate(reporting_months):
            t_frac = (m_idx + 1) / panel_months

            # Planned progress curve (starts earlier in the project lifecycle)
            # Projects at month 1 have started execution
            start_plan = max(5.0, final_planned_progress * 0.25)
            m_plan_progress = round(start_plan + (final_planned_progress - start_plan) * (t_frac ** 0.95), 1)

            # Actual progress: divergence emerges gradually across months for troubled projects
            # Healthy projects stay close to plan; critical projects fall behind exponentially
            gap_growth = (t_frac ** 1.6)
            m_gap = round(final_progress_gap * gap_growth + rng.uniform(-0.4, 0.4), 1)
            m_actual_progress = max(2.0, min(100.0, round(m_plan_progress - m_gap, 1)))
            m_progress_gap = round(m_plan_progress - m_actual_progress, 1)

            # Revised cost: cost escalation accumulates over time as issues compound
            escalation_growth = (t_frac ** 1.4)
            m_cost_factor = 1.0 + (final_cost_factor - 1.0) * escalation_growth
            m_revised_cost = round(original_cost * m_cost_factor, 2)
            m_cost_variance = round(m_revised_cost - original_cost, 2)
            m_cost_variance_pct = round((m_cost_variance / original_cost) * 100, 1)

            # Cumulative expenditure follows actual physical progress with slight variance
            exp_mult = (m_actual_progress / 100.0) * rng.uniform(0.92, 1.16)
            m_expenditure = round(min(m_revised_cost * 1.05, m_revised_cost * exp_mult), 2)
            m_expenditure_ratio = round(m_expenditure / m_revised_cost, 3) if m_revised_cost else 0.0

            # Schedule delay months accumulate gradually
            m_delay_months = max(0, int(round(final_delay_months * (t_frac ** 1.35))))
            m_expected_completion = planned_completion + timedelta(days=m_delay_months * 30)

            # Milestones
            m_ms_done = max(0, min(milestone_total, int(round(final_milestones_done * (t_frac ** 0.9)))))
            m_ms_delayed = max(0, min(milestone_total, int(round(final_milestone_delays * (t_frac ** 1.3)))))
            m_ms_delay_ratio = round(m_ms_delayed / milestone_total, 3)

            # Reason for delay: sticky categorical cause when delayed
            m_reason = None
            if m_delay_months > 0 or m_progress_gap >= 4.0 or persona in ("critical", "high"):
                cat_info = sticky_delay_cats[m_idx // 4]
                m_reason = f"{cat_info['category']}: {cat_info['description']}"

            # Candidate leading variables with minor monthly temporal variation
            m_contractor_rating = max(1.0, min(5.0, round(contractor_rating + rng.uniform(-0.1, 0.1), 1)))
            m_weather_days = max(0, int(weather_days * t_frac + rng.randint(-2, 2)))
            m_cand_vars = {
                "contractor_rating": m_contractor_rating,
                "land_acquisition_status": land_acquisition_status,
                "land_acquisition_delay_days": int(land_delay_days * t_frac),
                "environmental_clearance": env_clearance,
                "tender_contract_issues": tender_issues,
                "weather_disruption_days": m_weather_days,
                "material_price_escalation_pct": material_inflation,
                "labour_availability_index": labour_index,
                "funding_payment_delay_days": funding_delay,
            }

            snapshots.append({
                "project_id": project_id,
                "report_month": r_month,
                "revised_cost": m_revised_cost,
                "cost_variance": m_cost_variance,
                "cost_variance_pct": m_cost_variance_pct,
                "expenditure": m_expenditure,
                "expenditure_cumulative": m_expenditure,
                "expenditure_ratio": m_expenditure_ratio,
                "planned_progress": m_plan_progress,
                "planned_progress_pct": m_plan_progress,
                "actual_progress": m_actual_progress,
                "actual_progress_pct": m_actual_progress,
                "progress_gap": m_progress_gap,
                "schedule_delay_months": m_delay_months,
                "expected_completion_date": m_expected_completion.strftime("%Y-%m-%d"),
                "milestone_count": milestone_total,
                "milestones_completed": m_ms_done,
                "milestone_delays": m_ms_delayed,
                "milestone_delay_ratio": m_ms_delay_ratio,
                "reason_for_delay": m_reason,
                "candidate_variables": m_cand_vars,
            })

        # Latest snapshot defines current active state (top-level properties)
        latest = snapshots[-1]
        cur_status = final_status
        if cur_status == "Ahead of Schedule" and latest["progress_gap"] > 0:
            cur_status = "In Progress"

        is_high_risk = 1 if (latest["cost_variance_pct"] >= 10.0 or
                             latest["schedule_delay_months"] >= 6 or
                             latest["progress_gap"] >= 10.0) else 0

        projects.append({
            "project_id": project_id,
            "project_name": project_name,
            "ministry": ministry,
            "sector": sector,
            "implementing_agency": agency,
            "region": region,
            "original_cost": original_cost,
            "revised_cost": latest["revised_cost"],
            "cost_variance": latest["cost_variance"],
            "cost_variance_pct": latest["cost_variance_pct"],
            "expenditure": latest["expenditure"],
            "expenditure_ratio": latest["expenditure_ratio"],
            "planned_progress": latest["planned_progress"],
            "actual_progress": latest["actual_progress"],
            "progress_gap": latest["progress_gap"],
            "planned_start_date": planned_start.strftime("%Y-%m-%d"),
            "planned_completion_date": planned_completion.strftime("%Y-%m-%d"),
            "expected_completion_date": latest["expected_completion_date"],
            "planned_duration_months": planned_duration_months,
            "schedule_delay_months": latest["schedule_delay_months"],
            "milestone_count": milestone_total,
            "milestones_completed": latest["milestones_completed"],
            "milestone_delays": latest["milestone_delays"],
            "milestone_delay_ratio": latest["milestone_delay_ratio"],
            "status": cur_status,
            "is_high_risk_target": is_high_risk,
            "candidate_variables": latest["candidate_variables"],
            "reason_for_delay": latest["reason_for_delay"],
            "history": snapshots,
            "has_history": True,
            "history_months_count": len(snapshots),
            "data_source_label": DATA_SOURCE_LABEL,
            "data_source_type": "DEMO",
        })

    return projects


def save_generated_projects(filepath=None, count=DEFAULT_PROJECT_COUNT, panel_months=DEFAULT_PANEL_MONTHS):
    if filepath is None:
        filepath = Path(__file__).parent / "projects_demo.json"
    else:
        filepath = Path(filepath)

    data = generate_synthetic_projects(count=count, panel_months=panel_months)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Generated {len(data)} synthetic projects (each with {panel_months} monthly snapshots) saved to {filepath}")
    return data


if __name__ == "__main__":
    save_generated_projects()
