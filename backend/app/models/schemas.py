from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class CandidateVariables(BaseModel):
    """Experimental schema-extension fields. Present in synthetic demo data only."""
    contractor_rating: Optional[float] = None
    land_acquisition_status: Optional[str] = None
    land_acquisition_delay_days: Optional[int] = None
    environmental_clearance: Optional[str] = None
    tender_contract_issues: Optional[int] = None
    weather_disruption_days: Optional[int] = None
    material_price_escalation_pct: Optional[float] = None
    labour_availability_index: Optional[float] = None
    funding_payment_delay_days: Optional[int] = None

class ProjectBase(BaseModel):
    """
    A project record. Only the identifiers are mandatory: an imported PAIMANA
    extract may legitimately omit any other field, and a missing field stays
    missing rather than being defaulted.
    """
    project_id: str
    project_name: str
    ministry: Optional[str] = None
    sector: Optional[str] = None
    implementing_agency: Optional[str] = None
    region: Optional[str] = None
    original_cost: Optional[float] = None
    revised_cost: Optional[float] = None
    cost_variance: Optional[float] = None
    cost_variance_pct: Optional[float] = None
    expenditure: Optional[float] = None
    expenditure_ratio: Optional[float] = None
    planned_progress: Optional[float] = None
    actual_progress: Optional[float] = None
    progress_gap: Optional[float] = None
    planned_start_date: Optional[str] = None
    planned_completion_date: Optional[str] = None
    expected_completion_date: Optional[str] = None
    planned_duration_months: Optional[int] = None
    schedule_delay_months: Optional[float] = None
    milestone_count: Optional[int] = None
    milestones_completed: Optional[int] = None
    milestone_delays: Optional[int] = None
    milestone_delay_ratio: Optional[float] = None
    status: Optional[str] = None
    candidate_variables: Optional[CandidateVariables] = None
    data_source_label: Optional[str] = None
    data_source_type: Optional[str] = None


class RiskDriver(BaseModel):
    driver: str
    impact_pct: float
    value: str
    severity: str

class FinancialImpact(BaseModel):
    available: bool
    value_cr: Optional[float] = None
    display: str = "Not available"
    label: Optional[str] = None
    basis: Optional[str] = None
    derived: bool = False
    qualifier: Optional[str] = None


class AlertItem(BaseModel):
    alert_id: str
    project_id: str
    project_name: str
    ministry: Optional[str] = None
    risk_type: str
    severity: str
    reason: str
    recommended_action: str
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    primary_driver: Optional[str] = None
    financial_impact: Optional[FinancialImpact] = None
    confidence: Optional[str] = None
    model_availability: Optional[str] = None

class RiskAnalysisResponse(BaseModel):
    project_id: str
    score_available: bool = True
    overall_risk_score: Optional[int] = None
    risk_level: str
    risk_color: str
    cost_overrun_risk_pct: Optional[float] = None
    schedule_overrun_risk_pct: Optional[float] = None
    progress_risk_pct: Optional[float] = None
    milestone_risk_pct: Optional[float] = None
    components_available: List[str] = []
    components_unavailable: List[str] = []
    drivers: List[RiskDriver]
    primary_driver: Optional[str] = None
    recommended_attention: str
    alerts: List[AlertItem]
    calculation_type: str
    unavailable_message: Optional[str] = None

class SimulationRequest(BaseModel):
    project_id: Optional[str] = None
    overrides: Optional[Dict[str, Any]] = None
    actual_progress: Optional[float] = None
    planned_progress: Optional[float] = 75.0
    expenditure: Optional[float] = None
    revised_cost: Optional[float] = None
    original_cost: Optional[float] = None
    milestone_delays: Optional[int] = None
    milestone_count: Optional[int] = 10
    schedule_delay_months: Optional[int] = None
    candidate_variables: Optional[Dict[str, Any]] = None

class SimulationResponse(BaseModel):
    original_risk_score: Optional[int] = None
    original_risk_level: Optional[str] = None
    simulated_risk_score: Optional[int] = None
    simulated_risk_level: str
    cost_overrun_risk_pct: float
    schedule_overrun_risk_pct: float
    progress_risk_pct: float
    milestone_risk_pct: float
    score_difference: int
    assessment: str
    disclaimer: str = "Prototype Simulation - Generated via Multi-Factor Calibration Engine"

class AssistantQueryRequest(BaseModel):
    question: str
    project_id: Optional[str] = None

class AssistantQueryResponse(BaseModel):
    answer: str
    suggested_queries: List[str]
    relevant_projects: Optional[List[Dict[str, Any]]] = None
    disclaimer: str = (
        "PAIMANA-AI derived analysis, grounded in the active dataset. "
        "Not an official Government of India prediction."
    )
