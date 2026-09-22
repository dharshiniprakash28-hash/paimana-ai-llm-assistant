"""
PAIMANA-AI deterministic risk engine.

Two behaviours matter here:

1. GRACEFUL DEGRADATION.  Demo projects carry every field. Imported PAIMANA
   extracts often do not. When a risk component's inputs are missing the
   component is EXCLUDED from the composite rather than defaulted to zero, and
   the project's risk result records which components were unavailable. If too
   few components can be computed, no score is produced at all and the caller
   renders "Risk analysis pending".

2. DERIVED FINANCIAL IMPACT.  Alerts carry a financial impact figure only when
   it follows arithmetically from values present on the project. Every such
   figure is tagged `"derived": true` and carries the formula used, so it can
   never be mistaken for an official forecast. Where no legitimate basis
   exists, the impact is reported as unavailable.
"""

# Component weights. Renormalised over whichever components are computable.
COMPONENT_WEIGHTS = {
    "cost": 0.28,
    "schedule": 0.32,
    "progress": 0.22,
    "milestone": 0.18,
}

# A score is only emitted if computable components carry at least this much
# of the total weight. Below it, the result is "insufficient data".
MIN_WEIGHT_COVERAGE = 0.45

# The dataset fields each risk component needs. Used to tell the user exactly
# which inputs are absent when a project cannot be scored, instead of a generic
# "not enough data" message. Each entry lists acceptable alternatives: the
# component is computable if any one group is fully present.
COMPONENT_REQUIRED_FIELDS = {
    "cost": [
        ["cost_variance_pct"],
        ["cost_variance", "original_cost"],
        ["original_cost", "revised_cost"],
    ],
    "schedule": [
        ["schedule_delay_months"],
        ["progress_gap"],
        ["planned_progress", "actual_progress"],
    ],
    "progress": [
        ["progress_gap"],
        ["planned_progress", "actual_progress"],
    ],
    "milestone": [
        ["milestone_delays"],
        ["milestone_delay_ratio"],
    ],
}

RISK_UNAVAILABLE_MESSAGE = (
    "Risk prediction unavailable - required model inputs are missing."
)

RECOMMENDATION_DISCLAIMER = (
    "Recommended actions are prototype-generated monitoring suggestions produced by this "
    "application's rule engine. They are not official Government of India instructions, "
    "directions or approvals."
)


def _missing_fields_for(component, project):
    """
    Return the smallest set of absent fields that would make `component`
    computable, or [] if it is already computable.
    """
    options = COMPONENT_REQUIRED_FIELDS.get(component, [])
    best = None
    for group in options:
        absent = [f for f in group if _num(project.get(f)) is None]
        if not absent:
            return []
        if best is None or len(absent) < len(best):
            best = absent
    return best or []


def _num(value, default=None):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _fin(available, value=None, label=None, basis=None):
    """Build a financial-impact block."""
    if not available or value is None:
        return {
            "available": False,
            "value_cr": None,
            "display": "Not available",
            "label": label or "Financial impact",
            "basis": basis or "Required cost fields are not present in this dataset.",
            "derived": False,
        }
    return {
        "available": True,
        "value_cr": round(float(value), 2),
        "display": f"Rs {float(value):,.2f} Cr",
        "label": label or "Financial impact",
        "basis": basis,
        "derived": True,
        "qualifier": "Derived estimate",
    }


def calculate_project_risk(project: dict) -> dict:
    """
    Compute component risks, a composite 0-100 score, ranked explainability
    drivers, early warnings and recommended attention.

    Returns a dict that always contains `score_available`. When that is False,
    `overall_risk_score` is None and the UI must show "Risk analysis pending".
    """
    p_id = project.get("project_id", "PRJ-TEMP")
    p_name = project.get("project_name", f"Project {p_id}")
    p_min = project.get("ministry") or "Not available"
    p_ms_count = _num(project.get("milestone_count"))

    original_cost = _num(project.get("original_cost"))
    revised_cost = _num(project.get("revised_cost"))
    expenditure = _num(project.get("expenditure"))

    cost_var_pct = _num(project.get("cost_variance_pct"))
    cost_variance = _num(project.get("cost_variance"))
    if cost_variance is None and original_cost is not None and revised_cost is not None:
        cost_variance = revised_cost - original_cost
    if cost_var_pct is None and cost_variance is not None and original_cost:
        cost_var_pct = (cost_variance / original_cost) * 100

    exp_ratio = _num(project.get("expenditure_ratio"))
    if exp_ratio is None and expenditure is not None and revised_cost:
        exp_ratio = expenditure / revised_cost

    actual_progress = _num(project.get("actual_progress"))
    planned_progress = _num(project.get("planned_progress"))
    prog_gap = _num(project.get("progress_gap"))
    if prog_gap is None and planned_progress is not None and actual_progress is not None:
        prog_gap = planned_progress - actual_progress

    sched_delay = _num(project.get("schedule_delay_months"))
    ms_delays = _num(project.get("milestone_delays"))
    ms_delay_ratio = _num(project.get("milestone_delay_ratio"))
    if ms_delay_ratio is None and ms_delays is not None and p_ms_count:
        ms_delay_ratio = ms_delays / p_ms_count

    components = {}
    unavailable = []

    # ---- Component 1: cost overrun risk ----
    if cost_var_pct is not None:
        mismatch = 0.0
        if exp_ratio is not None and actual_progress is not None:
            mismatch = max(0.0, exp_ratio - (actual_progress / 100.0))
        raw = (cost_var_pct * 1.8) + (mismatch * 60.0)
        components["cost"] = round(min(100.0, max(5.0, raw + 10.0)), 1)
    else:
        unavailable.append("cost")

    # ---- Component 2: schedule overrun risk ----
    if sched_delay is not None or prog_gap is not None:
        raw = ((sched_delay or 0.0) * 2.8) + ((prog_gap or 0.0) * 1.5)
        components["schedule"] = round(min(100.0, max(5.0, raw + 8.0)), 1)
    else:
        unavailable.append("schedule")

    # ---- Component 3: progress gap risk ----
    if prog_gap is not None:
        components["progress"] = round(min(100.0, max(5.0, (prog_gap * 2.6) + 10.0)), 1)
    else:
        unavailable.append("progress")

    # ---- Component 4: milestone slippage risk ----
    if ms_delay_ratio is not None or ms_delays is not None:
        raw = ((ms_delay_ratio or 0.0) * 80.0) + ((ms_delays or 0.0) * 2.5)
        components["milestone"] = round(min(100.0, max(5.0, raw + 5.0)), 1)
    else:
        unavailable.append("milestone")

    # ---- Which dataset fields are absent, by component ----
    # Reported so the UI can name the missing inputs rather than showing a
    # generic failure. Only components that could NOT be computed are listed.
    missing_by_component = {}
    for comp in unavailable:
        absent = _missing_fields_for(comp, project)
        if absent:
            missing_by_component[comp] = absent

    missing_fields = sorted({f for fields in missing_by_component.values() for f in fields})

    # ---- Candidate-variable adjustment (synthetic demo data only) ----
    candidate_penalty = 0.0
    cand = project.get("candidate_variables") or {}
    if cand:
        contractor = _num(cand.get("contractor_rating"), 3.5)
        if contractor is not None and contractor < 2.5:
            candidate_penalty += (2.5 - contractor) * 6.0
        land_days = _num(cand.get("land_acquisition_delay_days"), 0.0)
        if land_days and land_days > 90:
            candidate_penalty += min(15.0, (land_days - 90) / 25.0)

    # ---- Composite score over available components only ----
    available_weight = sum(COMPONENT_WEIGHTS[k] for k in components)
    score_available = available_weight >= MIN_WEIGHT_COVERAGE

    if score_available:
        composite = sum(components[k] * COMPONENT_WEIGHTS[k] for k in components) / available_weight
        composite += candidate_penalty * 0.2
        overall_score = int(round(min(100.0, max(0.0, composite))))
        if overall_score >= 81:
            risk_level, risk_color = "CRITICAL", "red"
        elif overall_score >= 61:
            risk_level, risk_color = "HIGH", "orange"
        elif overall_score >= 31:
            risk_level, risk_color = "MEDIUM", "yellow"
        else:
            risk_level, risk_color = "LOW", "green"
    else:
        overall_score = None
        risk_level, risk_color = "UNSCORED", "slate"

    # ---- Explainability drivers ----
    drivers = []
    if prog_gap is not None and prog_gap > 8.0:
        drivers.append({
            "driver": "Progress Gap",
            "impact_pct": round(min(35.0, prog_gap * 1.1), 1),
            "value": f"{round(prog_gap, 1)}% behind planned schedule",
            "severity": "CRITICAL" if prog_gap > 20 else "HIGH",
        })
    if sched_delay is not None and sched_delay > 4:
        drivers.append({
            "driver": "Schedule Delay",
            "impact_pct": round(min(30.0, sched_delay * 1.4), 1),
            "value": f"{round(sched_delay, 1)} months past baseline completion date",
            "severity": "CRITICAL" if sched_delay > 12 else "HIGH",
        })
    if cost_var_pct is not None and cost_var_pct > 8.0:
        cv_txt = f"Rs {cost_variance:,.2f} Cr" if cost_variance is not None else "value not available"
        drivers.append({
            "driver": "Cost Escalation",
            "impact_pct": round(min(28.0, cost_var_pct * 1.2), 1),
            "value": f"+{cv_txt} ({round(cost_var_pct, 1)}% variance)",
            "severity": "CRITICAL" if cost_var_pct > 25 else "HIGH",
        })
    if ms_delay_ratio is not None and ms_delay_ratio > 0.25:
        drivers.append({
            "driver": "Milestone Slippage",
            "impact_pct": round(min(25.0, ms_delay_ratio * 30.0), 1),
            "value": f"{int(ms_delays or 0)} of {int(p_ms_count or 0)} key milestones breached",
            "severity": "HIGH" if ms_delay_ratio > 0.4 else "MEDIUM",
        })
    if exp_ratio is not None and actual_progress is not None:
        mismatch = max(0.0, exp_ratio - (actual_progress / 100.0))
        if mismatch > 0.12:
            drivers.append({
                "driver": "Expenditure Discrepancy",
                "impact_pct": round(min(20.0, mismatch * 45.0), 1),
                "value": (f"Funds drawn ({int(exp_ratio * 100)}%) outpaces physical "
                          f"progress ({int(actual_progress)}%)"),
                "severity": "MEDIUM",
            })

    if cand:
        land_days = _num(cand.get("land_acquisition_delay_days"), 0.0)
        if land_days and land_days > 120:
            drivers.append({
                "driver": "Land Acquisition Bottleneck (Candidate Var)",
                "impact_pct": 14.5,
                "value": f"{int(land_days)} days in right-of-way clearance",
                "severity": "HIGH",
            })
        contractor = _num(cand.get("contractor_rating"), 5.0)
        if contractor is not None and contractor < 2.5:
            drivers.append({
                "driver": "Contractor Performance Rating (Candidate Var)",
                "impact_pct": 12.0,
                "value": f"Vendor quality index is {contractor}/5.0",
                "severity": "HIGH",
            })

    drivers.sort(key=lambda x: x["impact_pct"], reverse=True)
    if not drivers:
        if score_available:
            drivers.append({
                "driver": "Consistent Performance",
                "impact_pct": 10.0,
                "value": "Physical and financial milestones tracking close to planned baseline",
                "severity": "LOW",
            })
        else:
            drivers.append({
                "driver": "Insufficient data for driver attribution",
                "impact_pct": 0.0,
                "value": "The available dataset does not contain the fields required to rank risk drivers.",
                "severity": "UNKNOWN",
            })

    primary_driver = drivers[0]["driver"] if drivers else "Not available"

    # ---- Recommended attention ----
    if not score_available:
        named = ", ".join(missing_fields) if missing_fields else "cost, schedule and progress fields"
        rec_attention = (
            f"{RISK_UNAVAILABLE_MESSAGE} The dataset loaded for this project does not contain "
            f"the following inputs: {named}. No score is estimated and no synthetic substitute "
            f"is applied."
        )
    elif risk_level == "CRITICAL":
        rec_attention = (
            f"Project requires urgent multi-agency review. The leading driver is "
            f"{drivers[0]['driver'].lower()} ({drivers[0]['value']}). Recommended Action: convene an "
            f"empowered committee for right-of-way resolution, contractor capability audit and "
            f"milestone baseline re-alignment."
        )
    elif risk_level == "HIGH":
        agency = project.get("implementing_agency") or "the implementing agency"
        rec_attention = (
            f"Project requires prioritised executive monitoring. Elevated risk stems primarily from "
            f"{drivers[0]['driver'].lower()}. Recommended Action: issue an early corrective notice to "
            f"{agency} and enforce bi-weekly milestone compliance reporting."
        )
    elif risk_level == "MEDIUM":
        rec_attention = (
            "Moderate schedule or expenditure variance detected. Recommended Action: conduct the "
            "standard monthly review and monitor critical-path milestones to prevent slippage into "
            "high-risk thresholds."
        )
    else:
        rec_attention = (
            "Project progress is tracking close to plan and expenditure is aligned with physical "
            "execution. Recommended Action: maintain routine periodic monitoring."
        )

    # ---- Financial impact building blocks ----
    unexecuted_balance = None
    if revised_cost is not None and expenditure is not None:
        unexecuted_balance = max(0.0, revised_cost - expenditure)

    progress_shortfall_value = None
    if prog_gap is not None and prog_gap > 0 and revised_cost is not None:
        progress_shortfall_value = (prog_gap / 100.0) * revised_cost

    confidence_note = (
        "Deterministic rule-based engine. Component coverage "
        f"{int(available_weight * 100)}% of the full weighting."
    )

    # ---- Early warning alerts ----
    alerts = []

    def _alert(suffix, risk_type, severity, reason, action, financial):
        alerts.append({
            "alert_id": f"ALT-{p_id}-{suffix}",
            "project_id": p_id,
            "project_name": p_name,
            "ministry": p_min,
            "risk_type": risk_type,
            "severity": severity,
            "reason": reason,
            "recommended_action": action,
            "recommendation_disclaimer": RECOMMENDATION_DISCLAIMER,
            "risk_score": overall_score,
            "risk_level": risk_level,
            "primary_driver": primary_driver,
            "financial_impact": financial,
            "confidence": confidence_note,
            "model_availability": "Rule-based engine (available)" if score_available
                                  else RISK_UNAVAILABLE_MESSAGE,
            "missing_fields": missing_fields,
        })

    cost_risk = components.get("cost")
    if cost_risk is not None and cost_risk >= 65.0:
        _alert(
            "COST", "Cost Overrun Risk",
            "CRITICAL" if cost_risk >= 80 else "HIGH",
            (f"Cost variance of {round(cost_var_pct, 1)}% exceeds the monitoring threshold"
             + (f" with an expenditure ratio of {exp_ratio:.2f}." if exp_ratio is not None else ".")),
            "Freeze unbudgeted contingency drawdown and audit contractor billings.",
            _fin(cost_variance is not None and cost_variance > 0, cost_variance,
                 "Projected additional cost",
                 "Derived estimate = Revised Cost - Original Cost (approved cost revision recorded to date)."),
        )

    sched_risk = components.get("schedule")
    if sched_risk is not None and sched_risk >= 65.0:
        _alert(
            "SCHED", "Schedule Overrun Risk",
            "CRITICAL" if sched_risk >= 80 else "HIGH",
            (f"Recorded delay of {round(sched_delay, 1)} months beyond the planned completion date."
             if sched_delay is not None else
             "Physical progress is materially behind the planned baseline."),
            "Deploy an expedited site inspection and assess shift doubling on the critical path.",
            _fin(unexecuted_balance is not None, unexecuted_balance,
                 "Unexecuted balance exposed to delay",
                 "Derived estimate = Revised Cost - Expenditure. This is the value of work not yet "
                 "executed and therefore exposed to further delay; it is not a forecast of extra cost."),
        )

    if ms_delay_ratio is not None and ms_delay_ratio >= 0.35:
        _alert(
            "MS", "Milestone Delay Detected",
            "HIGH" if ms_delay_ratio >= 0.5 else "MEDIUM",
            f"{int(ms_delays or 0)} of {int(p_ms_count or 0)} critical milestone deadlines missed.",
            "Engage the project director to resolve contractual or utility-relocation blockers.",
            _fin(False, None, "Financial impact",
                 "Milestone slippage alone has no documented arithmetic basis for a cost figure in this dataset."),
        )

    if prog_gap is not None and prog_gap >= 15.0:
        _alert(
            "PROG", "Significant Progress Gap",
            "CRITICAL" if prog_gap >= 25 else "HIGH",
            f"Physical execution gap widened to {round(prog_gap, 1)}% between planned and actual work.",
            "Establish a joint taskforce to inspect mobilisation of machinery and manpower.",
            _fin(progress_shortfall_value is not None, progress_shortfall_value,
                 "Value of physical work shortfall",
                 "Derived estimate = Progress Gap % x Revised Cost. Represents the value of planned "
                 "work not yet delivered; it is not a forecast of additional expenditure."),
        )

    if overall_score is not None and overall_score >= 81:
        _alert(
            "CRIT", "Critical Project Risk", "CRITICAL",
            f"Composite risk score reached {overall_score}/100 across cost, time and milestone dimensions.",
            "Escalate the project dossier to the Ministry Project Monitoring Group (PMG).",
            _fin(cost_variance is not None and cost_variance > 0, cost_variance,
                 "Recorded cost escalation to date",
                 "Derived estimate = Revised Cost - Original Cost."),
        )

    return {
        "project_id": project.get("project_id"),
        "score_available": score_available,
        "overall_risk_score": overall_score,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "cost_overrun_risk_pct": components.get("cost"),
        "schedule_overrun_risk_pct": components.get("schedule"),
        "progress_risk_pct": components.get("progress"),
        "milestone_risk_pct": components.get("milestone"),
        "components_available": list(components.keys()),
        "components_unavailable": unavailable,
        "missing_fields": missing_fields,
        "missing_fields_by_component": missing_by_component,
        "weight_coverage": round(available_weight, 3),
        "drivers": drivers,
        "primary_driver": primary_driver,
        "recommended_attention": rec_attention,
        "alerts": alerts,
        "calculation_type": "Deterministic rule-based engine (SIH26103 prototype)",
        "recommendation_disclaimer": RECOMMENDATION_DISCLAIMER,
        "unavailable_message": None if score_available else RISK_UNAVAILABLE_MESSAGE,
    }
