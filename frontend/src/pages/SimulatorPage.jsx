import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Sparkles,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  HelpCircle,
  DollarSign,
  Layers,
  ShieldAlert
} from 'lucide-react';
import RiskGauge from '../components/RiskGauge';
import RiskBadge from '../components/RiskBadge';
import { api } from '../services/api';

export default function SimulatorPage({ initialProjectId = 'PRJ-101' }) {
  const [allProjects, setAllProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(initialProjectId);
  const [originalProject, setOriginalProject] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Form / Slider states
  const [originalCost, setOriginalCost] = useState(1000);
  const [revisedCost, setRevisedCost] = useState(1200);
  const [expenditure, setExpenditure] = useState(650);
  const [plannedProgress, setPlannedProgress] = useState(70);
  const [actualProgress, setActualProgress] = useState(45);
  const [milestoneCount, setMilestoneCount] = useState(10);
  const [milestoneDelays, setMilestoneDelays] = useState(4);
  const [scheduleDelayMonths, setScheduleDelayMonths] = useState(8);

  // Candidate variable sliders
  const [contractorRating, setContractorRating] = useState(3.0);
  const [landDelayDays, setLandDelayDays] = useState(45);
  const [materialEscalationPct, setMaterialEscalationPct] = useState(8.5);

  // Simulation Results
  const [simulationResult, setSimulationResult] = useState(null);

  const runSimulation = useCallback(async (customPayload = null) => {
    setSimulating(true);
    const payload = customPayload || {
      project_id: selectedId,
      original_cost: parseFloat(originalCost),
      revised_cost: parseFloat(revisedCost),
      expenditure: parseFloat(expenditure),
      planned_progress: parseFloat(plannedProgress),
      actual_progress: parseFloat(actualProgress),
      milestone_count: parseInt(milestoneCount),
      milestone_delays: parseInt(milestoneDelays),
      schedule_delay_months: parseInt(scheduleDelayMonths),
      candidate_variables: {
        contractor_rating: parseFloat(contractorRating),
        land_acquisition_delay_days: parseInt(landDelayDays),
        material_price_escalation_pct: parseFloat(materialEscalationPct),
      }
    };

    try {
      const res = await api.simulateRisk(payload);
      setSimulationResult(res);
    } catch (err) {
      console.warn('API simulation failed, computing client fallback:', err);
      // Client-side fallback calculation
      const costVar = payload.revised_cost - payload.original_cost;
      const costVarPct = (costVar / payload.original_cost) * 100;
      const progGap = payload.planned_progress - payload.actual_progress;
      const expRatio = payload.expenditure / payload.revised_cost;
      const msRatio = payload.milestone_delays / payload.milestone_count;

      const costRisk = Math.min(100, Math.max(5, (costVarPct * 1.8) + (Math.max(0, expRatio - payload.actual_progress / 100) * 60) + 10));
      const schedRisk = Math.min(100, Math.max(5, (payload.schedule_delay_months * 2.8) + (progGap * 1.5) + 8));
      const progRisk = Math.min(100, Math.max(5, progGap * 2.6 + 10));
      const msRisk = Math.min(100, Math.max(5, msRatio * 80 + payload.milestone_delays * 2.5 + 5));

      const composite = Math.round((costRisk * 0.28) + (schedRisk * 0.32) + (progRisk * 0.22) + (msRisk * 0.18));
      const origScore = originalProject ? originalProject.risk.overall_risk_score : 65;
      const diff = composite - origScore;

      let level = 'LOW';
      if (composite >= 81) level = 'CRITICAL';
      else if (composite >= 61) level = 'HIGH';
      else if (composite >= 31) level = 'MEDIUM';

      setSimulationResult({
        original_risk_score: origScore,
        original_risk_level: originalProject ? originalProject.risk.risk_level : 'MEDIUM',
        simulated_risk_score: composite,
        simulated_risk_level: level,
        cost_overrun_risk_pct: Math.round(costRisk),
        schedule_overrun_risk_pct: Math.round(schedRisk),
        progress_risk_pct: Math.round(progRisk),
        milestone_risk_pct: Math.round(msRisk),
        score_difference: diff,
        assessment: diff < -5 ? `Simulated interventions reduce risk score by ${Math.abs(diff)} points.` : diff > 5 ? `Simulated slippages escalate risk score by +${diff} points.` : 'Simulated variance maintains stable risk profile.',
        disclaimer: 'Prototype Simulation – Multi-factor calibration model estimate'
      });
    } finally {
      setSimulating(false);
    }
  }, [selectedId, originalCost, revisedCost, expenditure, plannedProgress, actualProgress, milestoneCount, milestoneDelays, scheduleDelayMonths, contractorRating, landDelayDays, materialEscalationPct, originalProject]);

  // Load project list for dropdown
  useEffect(() => {
    api.getProjects({ limit: 500, sort_by: 'risk_score', sort_order: 'desc' })
      .then((res) => {
        setAllProjects(res.items);
        setSelectedId((prev) => prev || (res.items.length > 0 ? res.items[0].project_id : null));
      })
      .catch((err) => console.error('Failed to load project list:', err));
  }, []);

  // When selected project changes, prefill fields
  useEffect(() => {
    if (!selectedId) return;
    api.getProjectById(selectedId)
      .then((proj) => {
        setOriginalProject(proj);
        setOriginalCost(proj.original_cost);
        setRevisedCost(proj.revised_cost);
        setExpenditure(proj.expenditure);
        setPlannedProgress(proj.planned_progress);
        setActualProgress(proj.actual_progress);
        setMilestoneCount(proj.milestone_count);
        setMilestoneDelays(proj.milestone_delays);
        setScheduleDelayMonths(proj.schedule_delay_months);

        const cand = proj.candidate_variables || {};
        setContractorRating(cand.contractor_rating || 3.2);
        setLandDelayDays(cand.land_acquisition_delay_days || 30);
        setMaterialEscalationPct(cand.material_price_escalation_pct || 7.0);

        // Run baseline simulation
        runSimulation({
          project_id: proj.project_id,
          original_cost: proj.original_cost,
          revised_cost: proj.revised_cost,
          expenditure: proj.expenditure,
          planned_progress: proj.planned_progress,
          actual_progress: proj.actual_progress,
          milestone_count: proj.milestone_count,
          milestone_delays: proj.milestone_delays,
          schedule_delay_months: proj.schedule_delay_months,
          candidate_variables: {
            contractor_rating: cand.contractor_rating || 3.2,
            land_acquisition_delay_days: cand.land_acquisition_delay_days || 30,
            material_price_escalation_pct: cand.material_price_escalation_pct || 7.0,
          }
        });
      })
      .catch((err) => console.error('Failed to load project for simulation:', err));
  }, [selectedId, runSimulation]);

  // Reset to original values
  const handleReset = () => {
    if (!originalProject) return;
    setOriginalCost(originalProject.original_cost);
    setRevisedCost(originalProject.revised_cost);
    setExpenditure(originalProject.expenditure);
    setPlannedProgress(originalProject.planned_progress);
    setActualProgress(originalProject.actual_progress);
    setMilestoneCount(originalProject.milestone_count);
    setMilestoneDelays(originalProject.milestone_delays);
    setScheduleDelayMonths(originalProject.schedule_delay_months);

    const cand = originalProject.candidate_variables || {};
    setContractorRating(cand.contractor_rating || 3.2);
    setLandDelayDays(cand.land_acquisition_delay_days || 30);
    setMaterialEscalationPct(cand.material_price_escalation_pct || 7.0);

    runSimulation();
  };

  // Quick preset scenarios
  const applyPreset = (type) => {
    if (!originalProject) return;

    let newRevised = revisedCost;
    let newExp = expenditure;
    let newActual = actualProgress;
    let newPlanned = plannedProgress;
    let newDelays = milestoneDelays;
    let newDelayMonths = scheduleDelayMonths;
    let newContractor = contractorRating;
    let newLandDelay = landDelayDays;
    let newMaterialPct = materialEscalationPct;

    if (type === 'mitigate_schedule') {
      newActual = Math.min(100, originalProject.planned_progress - 2);
      newDelays = Math.max(0, Math.floor(originalProject.milestone_delays / 2));
      newDelayMonths = Math.max(0, originalProject.schedule_delay_months - 4);
      newContractor = 4.5;
      newLandDelay = Math.max(0, Math.floor(newLandDelay / 2));
    } else if (type === 'cost_surge') {
      newRevised = Math.round(originalProject.revised_cost * 1.15);
      newExp = Math.round(originalProject.expenditure * 1.10);
      newMaterialPct = 15.0;
    } else if (type === 'monsoon_delay') {
      newDelayMonths = originalProject.schedule_delay_months + 2;
      newActual = Math.max(5, originalProject.actual_progress - 8);
      newDelays = Math.min(originalProject.milestone_count, originalProject.milestone_delays + 2);
      newLandDelay = (originalProject.candidate_variables?.land_acquisition_delay_days || 30) + 60;
    } else if (type === 'land_clearance') {
      newLandDelay = 0;
      newDelayMonths = Math.max(0, originalProject.schedule_delay_months - 3);
      newContractor = 4.0;
    } else if (type === 'worst_case') {
      newRevised = Math.round(originalProject.revised_cost * 1.35);
      newActual = Math.max(10, originalProject.actual_progress - 15);
      newDelays = Math.min(originalProject.milestone_count, originalProject.milestone_delays + 3);
      newDelayMonths = originalProject.schedule_delay_months + 8;
      newContractor = 1.8;
      newMaterialPct = 22.0;
      newLandDelay = 120;
    }

    setRevisedCost(newRevised);
    setExpenditure(newExp);
    setActualProgress(newActual);
    setMilestoneDelays(newDelays);
    setScheduleDelayMonths(newDelayMonths);
    setContractorRating(newContractor);
    setLandDelayDays(newLandDelay);
    setMaterialEscalationPct(newMaterialPct);

    runSimulation({
      project_id: selectedId,
      original_cost: parseFloat(originalCost),
      revised_cost: parseFloat(newRevised),
      expenditure: parseFloat(newExp),
      planned_progress: parseFloat(newPlanned),
      actual_progress: parseFloat(newActual),
      milestone_count: parseInt(milestoneCount),
      milestone_delays: parseInt(newDelays),
      schedule_delay_months: parseInt(newDelayMonths),
      candidate_variables: {
        contractor_rating: parseFloat(newContractor),
        land_acquisition_delay_days: parseInt(newLandDelay),
        material_price_escalation_pct: parseFloat(newMaterialPct),
      }
    });
  };

  const calculatedCostVariance = Math.round(revisedCost - originalCost);
  const calculatedCostVariancePct = originalCost > 0 ? ((calculatedCostVariance / originalCost) * 100).toFixed(1) : 0;
  const calculatedProgressGap = (plannedProgress - actualProgress).toFixed(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-6 h-6 text-indigo-400" />
              What-if Risk Simulator
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Prototype Simulation
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Test policy interventions, milestone acceleration, budget variances, and external shocks on project risk
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400">Base Project:</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {allProjects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id} – {p.project_name.slice(0, 35)}... ({p.risk.risk_level})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preset Scenarios Banner */}
      <div className="glass-panel border border-slate-700/60 rounded-2xl p-4.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white">Quick Simulation Scenarios:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPreset('mitigate_schedule')}
            className="px-3 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
            title="Fast-track progress, reduce delays, boost contractor rating"
          >
            ⚡ Milestone Fast-Track
          </button>
          <button
            onClick={() => applyPreset('cost_surge')}
            className="px-3 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/40 text-amber-300 text-xs font-semibold transition-all cursor-pointer"
            title="Simulate 15% material inflation and budget overrun"
          >
            📈 Steel & Cement Inflation (+15%)
          </button>
          <button
            onClick={() => applyPreset('monsoon_delay')}
            className="px-3 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-600/40 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
            title="Simulate 60 days severe weather / monsoon stoppage"
          >
            🌧️ Monsoon Delay (+60 Days)
          </button>
          <button
            onClick={() => applyPreset('land_clearance')}
            className="px-3 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 border border-blue-600/40 text-blue-300 text-xs font-semibold transition-all cursor-pointer"
            title="Clear land bottlenecks and right-of-way disputes"
          >
            🏞️ Land Clearance Resolution
          </button>
          <button
            onClick={() => applyPreset('worst_case')}
            className="px-3 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-600/40 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
            title="Compounding severe delay, cost escalation, and contractor dispute"
          >
            ⚠️ Compounding Shock
          </button>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="Reset to project baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Main Grid: Inputs (Left) vs Real-time Results (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Group 1: Physical Progress & Milestones */}
          <div className="glass-panel border border-slate-700/60 rounded-2xl p-5 shadow-2xl space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-blue-400" />
              1. Physical Progress & Milestone Sliders
            </h3>

            {/* Actual Progress Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs">
                <span className="text-slate-300 font-semibold">Actual Physical Progress</span>
                <span className="font-mono font-bold text-blue-400">{actualProgress}% (Planned: {plannedProgress}%)</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={actualProgress}
                onChange={(e) => setActualProgress(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0% Not Started</span>
                <span className={`font-semibold ${calculatedProgressGap > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  Gap: {calculatedProgressGap}%
                </span>
                <span>100% Commissioned</span>
              </div>
            </div>

            {/* Milestone Delays Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs">
                <span className="text-slate-300 font-semibold">Delayed / Slipping Milestones</span>
                <span className="font-mono font-bold text-amber-400">{milestoneDelays} of {milestoneCount} milestones</span>
              </div>
              <input
                type="range"
                min="0"
                max={milestoneCount}
                step="1"
                value={milestoneDelays}
                onChange={(e) => setMilestoneDelays(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0 Breached</span>
                <span>{((milestoneDelays / milestoneCount) * 100).toFixed(0)}% Breached Ratio</span>
                <span>{milestoneCount} All Breached</span>
              </div>
            </div>

            {/* Schedule Delay Months Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs">
                <span className="text-slate-300 font-semibold">Schedule Delay (Months Past Baseline)</span>
                <span className="font-mono font-bold text-rose-400">{scheduleDelayMonths} Months</span>
              </div>
              <input
                type="range"
                min="0"
                max="36"
                step="1"
                value={scheduleDelayMonths}
                onChange={(e) => setScheduleDelayMonths(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>On Time (0 mo)</span>
                <span>12 mo (1 year delay)</span>
                <span>36 mo (3 years delay)</span>
              </div>
            </div>
          </div>

          {/* Group 2: Financial & Expenditure Inputs */}
          <div className="glass-panel border border-slate-700/60 rounded-2xl p-5 shadow-2xl space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              2. Budget, Expenditure & Cost Overrun
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Original Cost (₹ Cr)
                </label>
                <input
                  type="number"
                  value={originalCost}
                  onChange={(e) => setOriginalCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Revised Cost (₹ Cr)
                </label>
                <input
                  type="number"
                  value={revisedCost}
                  onChange={(e) => setRevisedCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Actual Spend (₹ Cr)
                </label>
                <input
                  type="number"
                  value={expenditure}
                  onChange={(e) => setExpenditure(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Simulated Cost Variance: </span>
                <span className={`font-mono font-bold ${calculatedCostVariance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  +₹{calculatedCostVariance.toLocaleString()} Cr (+{calculatedCostVariancePct}%)
                </span>
              </div>
              <div>
                <span className="text-slate-400">Expenditure Ratio: </span>
                <span className="font-mono font-bold text-blue-400">
                  {revisedCost > 0 ? ((expenditure / revisedCost) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Group 3: Candidate Variable Adjustments */}
          <div className="glass-panel border border-slate-700/60 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                3. Candidate Variable Calibration
              </h3>
              <span className="text-[10px] text-purple-300 font-mono bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                Non-CUF Leading Indicators
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Contractor Rating</span>
                  <span className="font-mono font-bold text-purple-300">{contractorRating} / 5</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={contractorRating}
                  onChange={(e) => setContractorRating(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Land ROW Delay</span>
                  <span className="font-mono font-bold text-purple-300">{landDelayDays} Days</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="5"
                  value={landDelayDays}
                  onChange={(e) => setLandDelayDays(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Material Escalation</span>
                  <span className="font-mono font-bold text-purple-300">{materialEscalationPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={materialEscalationPct}
                  onChange={(e) => setMaterialEscalationPct(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Simulate Action Button */}
          <button
            onClick={() => runSimulation()}
            disabled={simulating}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{simulating ? 'Calculating Neural Risk Decomposition...' : 'Recalculate Simulated Risk Score'}</span>
          </button>
        </div>

        {/* Right Column: Comparative Risk Results */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel border border-indigo-500/40 rounded-2xl p-6 shadow-2xl space-y-6 glow-indigo relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  Simulation Impact Analysis
                </h3>
                <p className="text-xs text-slate-400">Comparative before vs after risk calibration</p>
              </div>
              <RiskBadge level={simulationResult?.simulated_risk_level || 'MEDIUM'} />
            </div>

            {/* Gauge Comparison */}
            <div className="grid grid-cols-2 gap-4 items-center justify-center text-center p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              {/* Original */}
              <div className="space-y-2 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baseline Score</span>
                <RiskGauge score={simulationResult?.original_risk_score || 70} size={130} />
                <span className="text-[11px] font-mono text-slate-400 font-semibold">
                  Status: {simulationResult?.original_risk_level || 'HIGH'}
                </span>
              </div>

              {/* Simulated */}
              <div className="space-y-2 flex flex-col items-center border-l border-slate-800 pl-4">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Simulated Score</span>
                <RiskGauge score={simulationResult?.simulated_risk_score || 55} size={130} />
                <div className="flex items-center gap-1 text-xs font-bold">
                  {simulationResult?.score_difference < 0 ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-mono">
                      <TrendingDown className="w-4 h-4" />
                      {simulationResult.score_difference} pts
                    </span>
                  ) : simulationResult?.score_difference > 0 ? (
                    <span className="text-rose-400 flex items-center gap-1 font-mono">
                      <TrendingUp className="w-4 h-4" />
                      +{simulationResult.score_difference} pts
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono">0 pts delta</span>
                  )}
                </div>
              </div>
            </div>

            {/* Component Decompositions */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Simulated Risk Decompositions
              </h4>

              {/* Cost Overrun Risk */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Cost Overrun Risk</span>
                  <span className="font-mono font-bold text-amber-400">
                    {simulationResult?.cost_overrun_risk_pct || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${simulationResult?.cost_overrun_risk_pct || 0}%` }}
                  />
                </div>
              </div>

              {/* Schedule Overrun Risk */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Schedule Overrun Risk</span>
                  <span className="font-mono font-bold text-rose-400">
                    {simulationResult?.schedule_overrun_risk_pct || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all"
                    style={{ width: `${simulationResult?.schedule_overrun_risk_pct || 0}%` }}
                  />
                </div>
              </div>

              {/* Progress Risk */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Progress Deficit Risk</span>
                  <span className="font-mono font-bold text-purple-400">
                    {simulationResult?.progress_risk_pct || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all"
                    style={{ width: `${simulationResult?.progress_risk_pct || 0}%` }}
                  />
                </div>
              </div>

              {/* Milestone Risk */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Milestone Breach Risk</span>
                  <span className="font-mono font-bold text-blue-400">
                    {simulationResult?.milestone_risk_pct || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${simulationResult?.milestone_risk_pct || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Assessment Box */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/50 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <CheckCircle className="w-4 h-4" />
                Intervention Synthesis
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {simulationResult?.assessment}
              </p>
            </div>

            {/* Mandatory Prototype Labeling */}
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-200 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Prototype Simulation Disclaimer:</strong> Values are computed via a multi-factor calibration simulation model. Not an official Government forecast or guarantee of project outcome.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
