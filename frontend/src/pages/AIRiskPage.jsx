import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Clock,
  AlertOctagon,
  CheckCircle,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import RiskGauge from '../components/RiskGauge';
import RiskBadge from '../components/RiskBadge';
import { api } from '../services/api';

export default function AIRiskPage({ initialProjectId = 'PRJ-101', onNavigateToSimulator }) {
  const [selectedId, setSelectedId] = useState(initialProjectId);
  const [allProjects, setAllProjects] = useState([]);
  const [projectData, setProjectData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load project list for dropdown selection
  useEffect(() => {
    api.getProjects({ limit: 500, sort_by: 'risk_score', sort_order: 'desc' })
      .then((res) => {
        setAllProjects(res.items);
        setSelectedId((prev) => prev || (res.items.length > 0 ? res.items[0].project_id : null));
      })
      .catch((err) => console.error('Failed to load project list:', err));
  }, []);

  // Load specific project details and risk
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      api.getProjectById(selectedId),
      api.getProjectRisk(selectedId)
    ])
      .then(([proj, risk]) => {
        setProjectData(proj);
        setRiskData(risk);
      })
      .catch((err) => console.error('Error fetching risk analysis:', err))
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (loading || !riskData || !projectData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-3">
        <Sparkles className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">Calculating SHAP Explainability and Risk Decompositions...</p>
      </div>
    );
  }

  // A project is only scored when the engine had enough real inputs. When it is
  // not, no component percentages, gauge or drivers are rendered at all - the
  // page states which inputs are missing instead of substituting values.
  const scored = riskData.score_available !== false;
  const missingFields = riskData.missing_fields || [];

  /** Component risk percentage, or null when the component was not computable. */
  const pct = (value) => (value === null || value === undefined ? null : value);

  /** Any project field, rendered as "Not available" when absent. */
  const fieldText = (value, suffix = '') =>
    value === null || value === undefined ? 'Not available' : `${value}${suffix}`;

  // Driver chart data (Horizontal bar chart)
  const driverChartData = (riskData.drivers || []).map((d) => ({
    name: d.driver,
    impact: d.impact_pct,
    severity: d.severity,
    value: d.value,
  }));

  const getDriverColor = (severity) => {
    if (severity === 'CRITICAL') return '#ef4444';
    if (severity === 'HIGH') return '#f97316';
    if (severity === 'MEDIUM') return '#eab308';
    return '#10b981';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            AI Risk Analysis & Explainability Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-factor predictive scoring & SHAP driver attribution for early mitigation
          </p>
        </div>

        {/* Project Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400">Select Project:</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
          >
            {allProjects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id} - {(p.project_name || 'Unnamed project').slice(0, 30)}... (
                {p.risk?.score_available === false || p.risk?.overall_risk_score === null
                  ? 'unscored'
                  : `${p.risk?.overall_risk_score} pts`}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Project Summary Pill */}
      <div className="p-5 rounded-2xl glass-panel border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-lg border border-blue-600/40">
              {projectData.project_id}
            </span>
            <span className="text-xs text-slate-300 font-semibold">{projectData.ministry}</span>
            <RiskBadge level={riskData.risk_level} score={riskData.overall_risk_score} />
          </div>
          <h3 className="text-base font-bold text-white">{projectData.project_name}</h3>
        </div>

        <button
          onClick={() => onNavigateToSimulator(projectData.project_id)}
          className="px-3.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer w-fit"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Launch What-if Risk Simulator</span>
        </button>
      </div>

      {/* Required model inputs absent: state that plainly, score nothing. */}
      {!scored && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-amber-600/40 space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4" />
            Risk prediction unavailable &mdash; required model inputs are missing.
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed max-w-3xl">
            This project comes from a dataset that does not carry the fields the risk engine
            needs. No score, component breakdown or driver attribution is shown for it, and the
            synthetic demo model is deliberately not applied as a substitute.
          </p>

          {missingFields.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Missing fields ({missingFields.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missingFields.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/50 text-amber-200 border border-amber-800/50"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {riskData.components_unavailable?.length > 0 && (
            <div className="text-[11px] text-slate-400">
              Risk components that could not be computed:{' '}
              <span className="font-mono text-slate-300">
                {riskData.components_unavailable.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Primary Risk Scores Row (Gauge + 4 Component Risk Cards) */}
      {/* Main Analysis Section (Gauge + Drivers) */}
      {scored && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Overall Risk Score Card (4 cols) */}
        <div className="lg:col-span-4 glass-panel border border-indigo-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-between glow-indigo relative overflow-hidden">
          <div className="text-center">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-800/50">
              Composite Risk Assessment
            </span>
            <h3 className="text-lg font-bold text-white mt-1">Overall Project Risk</h3>
          </div>

          <div className="my-4">
            <RiskGauge score={riskData.overall_risk_score} level={riskData.risk_level} size={200} />
          </div>

          <div className="w-full text-center text-xs text-slate-400 pt-3 border-t border-slate-800">
            Engine Model: <strong className="text-slate-200">Calibrated Multi-Factor Ensemble</strong>
          </div>
        </div>

        {/* 4 Component Risk Cards (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cost Overrun Risk */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cost Overrun Risk</span>
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-black font-mono text-amber-400">
                {pct(riskData.cost_overrun_risk_pct) === null
                  ? <span className="text-base text-slate-400">Not available</span>
                  : `${riskData.cost_overrun_risk_pct}%`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Variance:{' '}
                {projectData.cost_variance === null || projectData.cost_variance === undefined
                  ? 'Not available'
                  : `₹${projectData.cost_variance.toLocaleString()} Cr (${fieldText(projectData.cost_variance_pct, '%')})`}
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${riskData.cost_overrun_risk_pct || 0}%` }}
              />
            </div>
          </div>

          {/* Schedule Overrun Risk */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schedule Overrun Risk</span>
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-black font-mono text-purple-400">
                {pct(riskData.schedule_overrun_risk_pct) === null
                  ? <span className="text-base text-slate-400">Not available</span>
                  : `${riskData.schedule_overrun_risk_pct}%`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Recorded Delay: {fieldText(projectData.schedule_delay_months, ' months')}
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all"
                style={{ width: `${riskData.schedule_overrun_risk_pct || 0}%` }}
              />
            </div>
          </div>

          {/* Progress Risk */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progress Gap Risk</span>
              <AlertOctagon className="w-5 h-5 text-rose-400" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-black font-mono text-rose-400">
                {pct(riskData.progress_risk_pct) === null
                  ? <span className="text-base text-slate-400">Not available</span>
                  : `${riskData.progress_risk_pct}%`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Physical Execution Deficit: {fieldText(projectData.progress_gap, '%')}
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{ width: `${riskData.progress_risk_pct || 0}%` }}
              />
            </div>
          </div>

          {/* Milestone Risk */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestone Breach Risk</span>
              <CheckCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-black font-mono text-blue-400">
                {pct(riskData.milestone_risk_pct) === null
                  ? <span className="text-base text-slate-400">Not available</span>
                  : `${riskData.milestone_risk_pct}%`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Breached Milestones: {fieldText(projectData.milestone_delays)} of{' '}
                {fieldText(projectData.milestone_count)}
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${riskData.milestone_risk_pct || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Explainable AI Section: "Why is this project risky?" */}
      {scored && (
      <div className="glass-panel border border-slate-700/60 rounded-3xl p-7 shadow-2xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Explainable AI (XAI) Attribution
          </div>
          <h3 className="text-lg md:text-xl font-black text-white">
            Why is this project risky?
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Ranked risk drivers quantified by SHAP marginal impact contributions
          </p>
        </div>

        {/* Horizontal Bar Chart for Drivers */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={driverChartData}
              margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={11} unit="%" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                formatter={(val, name, item) => [`${val}% impact (${item.payload.value})`, 'Marginal Driver Weight']}
              />
              <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                {driverChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getDriverColor(entry.severity)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranked Driver Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {riskData.drivers.map((d, index) => (
            <div
              key={index}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">
                    #{index + 1} {d.driver}
                  </span>
                  <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                    d.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                    d.severity === 'HIGH' ? 'bg-orange-950 text-orange-300 border border-orange-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {d.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{d.value}</p>
              </div>
              <div className="text-right font-mono font-bold text-sm text-indigo-400">
                +{d.impact_pct}%
              </div>
            </div>
          ))}
        </div>

        {/* Recommended Attention Box */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-950/40 border border-indigo-500/30 space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 text-indigo-400" />
            Recommended Attention & Corrective Priority
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            "{riskData.recommended_attention}"
          </p>
          <p className="text-[10px] text-slate-400 italic">
            * Generated by prototype rule-synthesis engine for decision-support. Not an official Government order.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
