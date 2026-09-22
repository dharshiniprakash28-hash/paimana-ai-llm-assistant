import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  TrendingUp,
  Sparkles,
  Layers,
  MapPin,
  Clock,
  Briefcase,
  Play
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import RiskBadge from '../components/RiskBadge';
import { api } from '../services/api';

export default function ProjectDetailPage({ projectId, onBack, onNavigateToAiRisk, onNavigateToSimulator }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.getProjectById(projectId)
      .then((data) => setProject(data))
      .catch((err) => console.error('Failed to load project details:', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading Project Dossier {projectId}...</p>
      </div>
    );
  }

  // Generate synthetic timeline milestones data
  const milestoneData = [
    { name: 'Feasibility & DPR', status: 'Completed', date: '2023-Q1', pct: 100 },
    { name: 'Tendering & Award', status: 'Completed', date: '2023-Q3', pct: 100 },
    { name: 'Land & ROW Clearances', status: project.actual_progress > 40 ? 'Completed' : 'Pending', date: '2024-Q1', pct: Math.min(100, Math.round(project.actual_progress * 1.3)) },
    { name: 'Civil Construction', status: project.actual_progress > 70 ? 'Completed' : 'In Progress', date: '2024-Q4', pct: Math.round(project.actual_progress) },
    { name: 'Systems & Commissioning', status: 'Pending', date: project.expected_completion_date, pct: Math.max(0, Math.round(project.actual_progress - 30)) },
  ];

  // Cost comparison chart data
  const costTrendData = [
    { phase: 'Original Estimate', amount: project.original_cost },
    { phase: 'Current Revised', amount: project.revised_cost },
    { phase: 'Actual Expenditure', amount: project.expenditure },
  ];

  // Monthly panel trajectory data from 18-36 month history
  const historyChartData = (project.history && project.history.length > 0)
    ? project.history.map((h) => ({
        month: (h.report_month || '').slice(2), // e.g. "23-01"
        planned: h.planned_progress,
        actual: h.actual_progress,
        cost_variance: h.cost_variance_pct,
        delay_months: h.schedule_delay_months,
      }))
    : [
        { month: 'Start', planned: 0, actual: 0, cost_variance: 0, delay_months: 0 },
        { month: 'Current', planned: project.planned_progress, actual: project.actual_progress, cost_variance: project.cost_variance_pct, delay_months: project.schedule_delay_months },
      ];

  const trend = project.early_warning_trend;

  return (
    <div className="space-y-6 pb-12">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Project Explorer</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToSimulator(project.project_id)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-blue-400" />
            <span>Simulate What-if</span>
          </button>

          {/* Prominent AI Risk Analysis Button */}
          <button
            onClick={() => onNavigateToAiRisk(project.project_id)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer transform hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>AI Risk Analysis & SHAP Drivers</span>
          </button>
        </div>
      </div>

      {/* Project Overview Hero Card */}
      <div className="glass-panel rounded-3xl p-7 shadow-2xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm font-bold text-blue-400 bg-blue-950/60 px-3 py-1 rounded-lg border border-blue-600/40">
                {project.project_id}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {project.implementing_agency}
              </span>
              <RiskBadge level={project.risk?.risk_level} score={project.risk?.overall_risk_score} />
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                (project.status || '').includes('Critical') ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                (project.status || '').includes('Delayed') ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {project.status}
              </span>

              {trend && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  trend.signal === 'DETERIORATING'
                    ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                    : trend.signal === 'IMPROVING'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    : 'bg-blue-950 text-blue-300 border border-blue-600'
                }`}>
                  Trend: {trend.signal}
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {project.project_name}
            </h2>

            <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap pt-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                {project.ministry}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-slate-500" />
                Sector: {project.sector}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-500" />
                Region: {project.region}
              </span>
            </div>
          </div>

          {/* Quick Risk Score Gauge preview */}
          <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 self-start">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk Score</p>
              <div className="text-2xl font-mono font-bold text-white">
                {project.risk?.overall_risk_score} <span className="text-xs text-slate-400">/ 100</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Cost Risk: <strong className="text-amber-400">{project.risk?.cost_overrun_risk_pct}%</strong>
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold font-mono text-sm border ${
              project.risk?.overall_risk_score >= 81 ? 'bg-rose-950 text-rose-300 border-rose-600' :
              project.risk?.overall_risk_score >= 61 ? 'bg-orange-950 text-orange-300 border-orange-600' :
              project.risk?.overall_risk_score >= 31 ? 'bg-amber-950 text-amber-300 border-amber-600' :
              'bg-emerald-950 text-emerald-300 border-emerald-600'
            }`}>
              {project.risk?.risk_level ? project.risk.risk_level[0] : 'M'}
            </div>
          </div>
        </div>

        {/* Early warning trend explanation banner */}
        {trend && trend.explanation && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-4">
            <div>
              <strong className="text-amber-300">Early Warning Signal ({trend.signal}):</strong> {trend.explanation}
            </div>
            {trend.recent_progress_gap_delta !== undefined && (
              <span className="font-mono text-[11px] text-amber-400 shrink-0">
                ΔGap: {trend.recent_progress_gap_delta > 0 ? `+${trend.recent_progress_gap_delta}%` : `${trend.recent_progress_gap_delta}%`}
              </span>
            )}
          </div>
        )}

        {/* 4 Essential Metric Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Original Cost</span>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              ₹{project.original_cost.toLocaleString()} Cr
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Revised Cost</span>
            <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
              ₹{project.revised_cost.toLocaleString()} Cr
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                (+{project.cost_variance_pct}%)
              </span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Actual Expenditure</span>
            <div className="text-base font-bold font-mono text-blue-400 mt-0.5">
              ₹{project.expenditure.toLocaleString()} Cr
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                ({Math.round(project.expenditure_ratio * 100)}%)
              </span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Schedule Delay</span>
            <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
              {project.schedule_delay_months} Months
            </div>
          </div>
        </div>
      </div>

      {/* Option A: ML Delay Risk Probability & Local SHAP Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ML Prediction Card */}
        <div className="glass-panel rounded-2xl border border-indigo-500/40 p-6 shadow-2xl flex flex-col justify-between glow-indigo relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                ML Delay Risk Prediction
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                Option A
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-mono font-black text-indigo-300">
                {project.ml_prediction?.predicted_risk_pct ?? Math.round(project.risk?.overall_risk_score ?? 60)}%
              </span>
              <span className="text-xs text-slate-400">delay probability</span>
            </div>
            <div className="text-xs text-slate-300 space-y-2 pt-3 border-t border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Rule-Engine Baseline:</span>
                <span className="font-mono font-bold text-white">{project.risk?.overall_risk_score} / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Model Architecture:</span>
                <span className="font-mono text-slate-300 text-[11px]">{project.ml_prediction?.model_name || 'GradientBoosting'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ML Delay Class:</span>
                <span className={`font-semibold ${project.ml_prediction?.predicted_delay_class === 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {project.ml_prediction?.predicted_delay_class === 1 ? 'Critical Delay (>6m)' : 'On-Track'}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 pt-2 border-t border-slate-800/80 leading-relaxed">
            Rule engine is the always-available score. ML probability predicts likelihood of critical delay based on historical patterns.
          </p>
        </div>

        {/* Local SHAP Drivers */}
        <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Project-Specific Risk Drivers (SHAP Local Attribution)
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Top feature attributions driving this project&apos;s risk estimation
          </p>
          <div className="space-y-2">
            {(project.ml_prediction?.local_shap_drivers || []).length > 0 ? (
              project.ml_prediction.local_shap_drivers.map((driver, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${driver.direction === 'increases_risk' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className="font-semibold text-slate-200 capitalize">{driver.feature.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-slate-400">{driver.description}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    driver.direction === 'increases_risk'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                  }`}>
                    {driver.shap_value > 0 ? `+${driver.shap_value.toFixed(3)}` : driver.shap_value.toFixed(3)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 p-4 text-center bg-slate-950/40 rounded-lg">
                Calculated across schedule delay, progress gap, expenditure ratio, and cost escalation.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Month Trajectory & Milestones Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Panel Trajectory Visual Card */}
        <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Monthly Historical Trajectory ({historyChartData.length} Snapshots)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Gap: <strong className={project.progress_gap > 10 ? 'text-rose-400' : 'text-slate-300'}>{project.progress_gap}%</strong>
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Evolution of planned vs actual progress, cost variance %, and schedule delay months over time.
          </p>

          {/* S-Curve & Trajectory Multi-Line Chart */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px', borderRadius: '8px' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={2} name="Planned (%)" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} name="Actual (%)" dot={false} />
                <Line type="monotone" dataKey="cost_variance" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" name="Cost Var (%)" dot={false} />
                <Line type="monotone" dataKey="delay_months" stroke="#a855f7" strokeWidth={1.5} name="Delay (Mo)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Milestone & Schedule Timeline */}
        <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Key Project Milestones & Critical Path
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {project.milestones_completed} / {project.milestone_count} Completed
            </span>
          </div>

          <div className="space-y-3 my-2">
            {milestoneData.map((m, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${m.pct === 100 ? 'bg-emerald-400' : m.pct > 0 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-slate-200">{m.name}</div>
                    <div className="text-[10px] text-slate-400">{m.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    m.pct === 100 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/40' :
                    m.pct > 0 ? 'bg-blue-950/80 text-blue-300 border border-blue-700/40' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {m.pct}% Complete
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>
              <span className="text-[10px] text-slate-400 block">Baseline Completion</span>
              <strong className="font-mono text-white">{project.planned_completion_date}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Current Expected Date</span>
              <strong className="font-mono text-rose-400">{project.expected_completion_date}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Trend & Candidate Variables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend Bar Chart */}
        <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            Financial Budget vs Expenditure Evolution
          </h3>
          <p className="text-xs text-slate-400 mb-4">Comparison of initial allocation, revised budget, and drawn funds</p>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="phase" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(val) => `₹${val.toLocaleString()} Cr`}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="₹ Crores" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Candidate Extended Variables Preview */}
        <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Candidate CUF Variable Profiling
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/40">
              Experimental Variables
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Candidate parameters evaluated in the advanced predictive pipeline (Model B)
          </p>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Contractor Rating</span>
              <strong className="text-white font-mono">{project.candidate_variables?.contractor_rating || '3.5'} / 5.0</strong>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Land Acquisition Delay</span>
              <strong className="text-amber-400 font-mono">{project.candidate_variables?.land_acquisition_delay_days || 0} Days</strong>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Environmental Clearance</span>
              <strong className="text-slate-200">{project.candidate_variables?.environmental_clearance || 'Granted'}</strong>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Material Escalation</span>
              <strong className="text-rose-400 font-mono">+{project.candidate_variables?.material_price_escalation_pct || 10}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
