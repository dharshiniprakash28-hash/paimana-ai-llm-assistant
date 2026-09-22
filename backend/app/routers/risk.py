from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.models.schemas import SimulationRequest, SimulationResponse
from app.ml.engine import calculate_project_risk
from app.data.repository import ProjectRepository

router = APIRouter(prefix="/risk", tags=["Risk & Simulation"])

@router.post("/predict")
def predict_risk(project_data: Dict[str, Any]):
    return calculate_project_risk(project_data)

@router.post("/simulate", response_model=SimulationResponse)
def simulate_risk(sim_req: SimulationRequest):
    repo = ProjectRepository()
    orig_risk_score = None
    orig_risk_level = None

    proj_name = "Simulated Project"
    proj_ministry = "Infrastructure"

    original_proj = repo.get_by_id(sim_req.project_id) if sim_req.project_id else None
    if original_proj:
        orig_risk_score = original_proj.get("risk", {}).get("overall_risk_score")
        orig_risk_level = original_proj.get("risk", {}).get("risk_level")
        proj_name = original_proj.get("project_name", "Simulated Project")
        proj_ministry = original_proj.get("ministry", "Infrastructure")

    # Start with base project values or defaults
    original_cost = (
        original_proj.get("original_cost") if original_proj else 1000.0
    )
    revised_cost = (
        original_proj.get("revised_cost") if original_proj else 1000.0
    )
    expenditure = (
        original_proj.get("expenditure") if original_proj else 500.0
    )
    planned_progress = (
        original_proj.get("planned_progress") if original_proj else 75.0
    )
    actual_progress = (
        original_proj.get("actual_progress") if original_proj else 50.0
    )
    milestone_count = (
        original_proj.get("milestone_count") if original_proj else 10
    )
    milestone_delays = (
        original_proj.get("milestone_delays") if original_proj else 0
    )
    schedule_delay_months = (
        original_proj.get("schedule_delay_months") if original_proj else 0
    )
    cand_vars = dict(original_proj.get("candidate_variables") or {}) if original_proj else {}

    # Apply overrides dictionary if present
    overrides = sim_req.overrides or {}
    for k, v in overrides.items():
        if k == "original_cost" and v is not None:
            original_cost = float(v)
        elif k == "revised_cost" and v is not None:
            revised_cost = float(v)
        elif k == "expenditure" and v is not None:
            expenditure = float(v)
        elif k == "planned_progress" and v is not None:
            planned_progress = float(v)
        elif k == "actual_progress" and v is not None:
            actual_progress = float(v)
        elif k == "milestone_count" and v is not None:
            milestone_count = int(v)
        elif k == "milestone_delays" and v is not None:
            milestone_delays = int(v)
        elif k == "schedule_delay_months" and v is not None:
            schedule_delay_months = int(v)
        elif k == "candidate_variables" and isinstance(v, dict):
            cand_vars.update(v)
        elif k in cand_vars:
            cand_vars[k] = v

    # Explicit top-level fields override if provided
    if sim_req.original_cost is not None:
        original_cost = float(sim_req.original_cost)
    if sim_req.revised_cost is not None:
        revised_cost = float(sim_req.revised_cost)
    if sim_req.expenditure is not None:
        expenditure = float(sim_req.expenditure)
    if sim_req.planned_progress is not None:
        planned_progress = float(sim_req.planned_progress)
    if sim_req.actual_progress is not None:
        actual_progress = float(sim_req.actual_progress)
    if sim_req.milestone_count is not None:
        milestone_count = int(sim_req.milestone_count)
    if sim_req.milestone_delays is not None:
        milestone_delays = int(sim_req.milestone_delays)
    if sim_req.schedule_delay_months is not None:
        schedule_delay_months = int(sim_req.schedule_delay_months)
    if sim_req.candidate_variables:
        cand_vars.update(sim_req.candidate_variables)

    original_cost = float(original_cost or 0.0)
    revised_cost = float(revised_cost or 0.0)
    expenditure = float(expenditure or 0.0)
    planned_progress = float(planned_progress or 0.0)
    actual_progress = float(actual_progress or 0.0)
    milestone_count = int(milestone_count or 1)
    milestone_delays = int(milestone_delays or 0)
    schedule_delay_months = int(schedule_delay_months or 0)

    cost_var = revised_cost - original_cost
    cost_var_pct = (cost_var / original_cost * 100) if original_cost > 0 else 0.0
    prog_gap = planned_progress - actual_progress
    exp_ratio = (expenditure / revised_cost) if revised_cost > 0 else 0.0
    ms_delay_ratio = (milestone_delays / milestone_count) if milestone_count > 0 else 0.0

    mock_project = {
        "project_id": sim_req.project_id or "SIM-TEMP",
        "project_name": proj_name,
        "ministry": proj_ministry,
        "original_cost": original_cost,
        "revised_cost": revised_cost,
        "cost_variance": round(cost_var, 2),
        "cost_variance_pct": round(cost_var_pct, 1),
        "expenditure": expenditure,
        "expenditure_ratio": round(exp_ratio, 3),
        "planned_progress": planned_progress,
        "actual_progress": actual_progress,
        "progress_gap": round(prog_gap, 1),
        "schedule_delay_months": schedule_delay_months,
        "milestone_count": milestone_count,
        "milestones_completed": max(0, milestone_count - milestone_delays),
        "milestone_delays": milestone_delays,
        "milestone_delay_ratio": round(ms_delay_ratio, 3),
        "candidate_variables": cand_vars,
    }

    sim_result = calculate_project_risk(mock_project)
    sim_score = sim_result["overall_risk_score"]

    if sim_score is None:
        return SimulationResponse(
            original_risk_score=orig_risk_score,
            original_risk_level=orig_risk_level,
            simulated_risk_score=None,
            simulated_risk_level="UNSCORED",
            cost_overrun_risk_pct=sim_result.get("cost_overrun_risk_pct") or 0.0,
            schedule_overrun_risk_pct=sim_result.get("schedule_overrun_risk_pct") or 0.0,
            progress_risk_pct=sim_result.get("progress_risk_pct") or 0.0,
            milestone_risk_pct=sim_result.get("milestone_risk_pct") or 0.0,
            score_difference=0,
            assessment="Insufficient data for prediction. The simulated inputs do not cover enough risk components to produce a score.",
            disclaimer="Prototype simulation - derived estimate, not an official forecast.",
        )

    diff = (sim_score - orig_risk_score) if orig_risk_score is not None else 0

    if diff < -10:
        assessment = f"Significant risk mitigation achieved: score reduced by {abs(diff)} points ({orig_risk_level} → {sim_result['risk_level']})."
    elif diff > 10:
        assessment = f"Risk escalation alert: simulated parameters worsen overall score by +{diff} points ({orig_risk_level} → {sim_result['risk_level']})."
    else:
        assessment = f"Minor variance: score shifted by {diff:+d} points. Current simulated level is {sim_result['risk_level']}."

    return SimulationResponse(
        original_risk_score=orig_risk_score,
        original_risk_level=orig_risk_level,
        simulated_risk_score=sim_score,
        simulated_risk_level=sim_result["risk_level"],
        cost_overrun_risk_pct=sim_result["cost_overrun_risk_pct"],
        schedule_overrun_risk_pct=sim_result["schedule_overrun_risk_pct"],
        progress_risk_pct=sim_result["progress_risk_pct"],
        milestone_risk_pct=sim_result["milestone_risk_pct"],
        score_difference=diff,
        assessment=assessment,
        disclaimer="Prototype simulation - derived estimate, not an official forecast."
    )
