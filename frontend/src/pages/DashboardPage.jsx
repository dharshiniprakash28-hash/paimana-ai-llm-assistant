import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  AlertOctagon,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Printer,
  Info,
  Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts';
import MetricCard from '../components/MetricCard';
import RiskBadge from '../components/RiskBadge';
import NationalSnapshot from '../components/NationalSnapshot';
import PrintReportHeader from '../components/PrintReportHeader';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';

const PIE_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

const PENDING = 'Pending';

/** Shorten long ministry names for chart axes without hard-coding a fixed list. */
function shortenMinistry(name) {
  if (!name) return '';
  return name
    .replace('Ministry of ', '')
    .replace('Department of ', '')
    .replace(/\s*\(.*\)\s*/, '')
    .slice(0, 14);
}

function formatNum(value) {
  if (value === null || value === undefined) return PENDING;
  return value.toLocaleString('en-IN');
}

export default function DashboardPage({ onSelectProject, onNavigateToWarnings }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { status: dataSource, version } = useDataSource();

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboardSummary();
      setData(res);
    } catch {
      setError(
        'Could not reach the PAIMANA-AI backend. Ensure the FastAPI server is running on port 8000.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the active data source changes.
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, version]);

  const handlePrint = () => window.print();

  const handleExportFlashReportCsv = () => {
    if (!data) return;
    const headers = [
      'Project ID',
      'Project Name',
      'Ministry',
      'Sector',
      'Implementing Agency',
      'Original Cost (Rs Cr)',
      'Revised Cost (Rs Cr)',
      'Cost Escalation (%)',
      'Schedule Delay (Months)',
      'Physical Progress (%)',
      'Risk Score',
      'Risk Level',
      'Primary Driver'
    ];
    const rows = (data.priority_projects || []).map(p => [
      `"${p.project_id || ''}"`,
      `"${(p.project_name || '').replace(/"/g, '""')}"`,
      `"${p.ministry || ''}"`,
      `"${p.sector || ''}"`,
      `"${p.implementing_agency || ''}"`,
      p.original_cost ?? '',
      p.revised_cost ?? '',
      p.cost_variance_pct ?? '',
      p.schedule_delay_months ?? '',
      p.actual_progress ?? '',
      p.risk?.overall_risk_score ?? '',
      `"${p.risk?.risk_level || ''}"`,
      `"${(p.risk?.primary_driver || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mospi_flash_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Loading portfolio metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-950/40 border border-rose-600/40 rounded-xl text-rose-300">
        <p className="font-semibold text-sm">{error || 'Unable to load dashboard data.'}</p>
        <button
          onClick={loadDashboardData}
          className="mt-3 px-4 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const {
    kpis,
    national_reference,
    application_dataset,
    risk_distribution,
    ministry_distribution,
    cost_variance_distribution,
    cost_variance_missing,
    schedule_delay_distribution,
    schedule_delay_missing,
    progress_comparison_sample,
    priority_projects,
    projects_trending_worse = [],
  } = data;

  const riskAvailable = kpis.risk_analysis_available;
  const totalCapital = ministry_distribution
    .map((m) => m.total_cost_cr)
    .filter((v) => v !== null && v !== undefined)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 pb-12" id="executive-report">
      {/* Print-only report header */}
      <PrintReportHeader dataSource={dataSource} nationalReference={national_reference} />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="text-gradient">National Infrastructure</span> Monitoring Command
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Predictive overrun intelligence across the active dataset:{' '}
            <span className={`font-semibold ${dataSource.is_synthetic ? 'text-amber-300' : 'text-emerald-300'}`}>
              {dataSource.label}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-xs font-semibold text-slate-300 transition-all cursor-pointer hover:border-slate-500 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            Refresh
          </button>
          <button
            onClick={handleExportFlashReportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-xs font-semibold text-slate-300 transition-all cursor-pointer shadow-sm hover:border-slate-500"
            title="Export MoSPI Executive Flash Report summary in CSV format"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export Flash CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-xs font-semibold text-indigo-300 transition-all cursor-pointer shadow-sm shadow-indigo-600/10 hover:shadow-indigo-600/20"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Export Report
          </button>
          {riskAvailable && (
            <button
              onClick={onNavigateToWarnings}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/50 text-xs font-bold text-rose-300 transition-all cursor-pointer shadow-sm shadow-rose-600/15 animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Early Warnings ({kpis.projects_requiring_attention})
            </button>
          )}
        </div>
      </div>

      {/* National reference vs application dataset */}
      <NationalSnapshot
        nationalReference={national_reference}
        applicationDataset={application_dataset}
      />

      {/* Risk-unavailable notice */}
      {!riskAvailable && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex items-start gap-3 text-xs text-slate-300 print-block">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-300 mb-1">Risk analysis pending</div>
            <p className="leading-relaxed text-slate-400">
              The active dataset does not contain the fields required to compute risk
              scores, so risk KPIs are not shown. No estimated values are substituted.
              Import a dataset containing original cost and revised cost to enable risk
              analysis.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print-block">
        <MetricCard
          title="Total Projects"
          value={formatNum(kpis.total_projects)}
          subtext={dataSource.is_synthetic ? 'Synthetic demo dataset' : 'Imported PAIMANA dataset'}
          icon={FolderKanban}
          color="blue"
        />
        <MetricCard
          title="Critical Risk"
          value={formatNum(kpis.critical_risk)}
          subtext={riskAvailable ? 'Score 81-100' : 'Risk analysis pending'}
          icon={AlertOctagon}
          color="rose"
        />
        <MetricCard
          title="High Risk"
          value={formatNum(kpis.high_risk)}
          subtext={riskAvailable ? 'Score 61-80' : 'Risk analysis pending'}
          icon={AlertTriangle}
          color="orange"
        />
        <MetricCard
          title="Cost Overrun Risk"
          value={formatNum(kpis.cost_risk)}
          subtext={riskAvailable ? 'Component risk >= 65%' : 'Risk analysis pending'}
          icon={TrendingUp}
          color="amber"
        />
        <MetricCard
          title="Schedule Delay Risk"
          value={formatNum(kpis.schedule_risk)}
          subtext={riskAvailable ? 'Component risk >= 65%' : 'Risk analysis pending'}
          icon={Clock}
          color="purple"
        />
        <MetricCard
          title="Requires Attention"
          value={formatNum(kpis.projects_requiring_attention)}
          subtext={riskAvailable ? 'Critical + High' : 'Risk analysis pending'}
          icon={AlertTriangle}
          color="rose"
          onClick={riskAvailable ? onNavigateToWarnings : undefined}
        />
      </div>

      {kpis.unscored_projects > 0 && riskAvailable && (
        <p className="text-[11px] text-slate-400 -mt-2">
          {kpis.unscored_projects} project(s) in this dataset lack the fields needed for a
          risk score and are excluded from the risk KPIs above.
        </p>
      )}

      {/* Priority Projects Table */}
      {priority_projects.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 print-block">
          <div className="p-4.5 border-b border-slate-700/60 bg-slate-900/40 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-500" />
                Priority Projects Requiring Executive Attention
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranked by composite risk across cost escalation, timeline deviation and
                milestone slippage
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Top 10</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Project ID &amp; Name</th>
                  <th className="p-3">Ministry</th>
                  <th className="p-3">Sector</th>
                  <th className="p-3 text-center">Overall Risk</th>
                  <th className="p-3">Primary Driver</th>
                  <th className="p-3 text-center">Cost Risk</th>
                  <th className="p-3 text-center">Schedule Risk</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {priority_projects.map((p) => (
                  <tr
                    key={p.project_id}
                    onClick={() => onSelectProject(p.project_id)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-3">
                      <div className="font-mono text-blue-400 font-bold">{p.project_id}</div>
                      <div className="text-slate-200 font-medium line-clamp-1 group-hover:text-blue-300">
                        {p.project_name}
                      </div>
                    </td>
                    <td className="p-3 text-slate-300 max-w-[180px] truncate" title={p.ministry}>
                      {shortenMinistry(p.ministry)}
                    </td>
                    <td className="p-3 text-slate-300">{p.sector}</td>
                    <td className="p-3 text-center">
                      <RiskBadge level={p.overall_risk_level} score={p.overall_risk_score} />
                    </td>
                    <td className="p-3 text-slate-300 max-w-[150px] truncate" title={p.primary_driver}>
                      {p.primary_driver || 'Not available'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-amber-400">
                        {p.cost_risk_pct !== null && p.cost_risk_pct !== undefined
                          ? `${p.cost_risk_pct}%`
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-purple-400">
                        {p.time_risk_pct !== null && p.time_risk_pct !== undefined
                          ? `${p.time_risk_pct}%`
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          (p.status || '').includes('Critical')
                            ? 'bg-rose-900/40 text-rose-300 border border-rose-800/50'
                            : (p.status || '').includes('Delayed')
                            ? 'bg-amber-900/40 text-amber-300 border border-amber-800/50'
                            : 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right no-print">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(p.project_id);
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Analyze</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Projects Trending Worse This Quarter (Early Warning Trend Signal) */}
      {projects_trending_worse && projects_trending_worse.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-amber-500/40 glow-amber print-block">
          <div className="p-4.5 border-b border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Projects Trending Worse This Quarter
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Early-warning trend detection: burn-rate acceleration and widening planned-vs-actual execution gap
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {projects_trending_worse.length} projects deteriorating
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Project ID &amp; Name</th>
                  <th className="p-3">Ministry</th>
                  <th className="p-3 text-center">Risk Score</th>
                  <th className="p-3">Early Warning Trend Signal</th>
                  <th className="p-3 text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {projects_trending_worse.map((p) => (
                  <tr
                    key={p.project_id}
                    onClick={() => onSelectProject(p.project_id)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{p.name}</div>
                      <div className="font-mono text-[11px] text-blue-400">{p.project_id}</div>
                    </td>
                    <td className="p-3 text-slate-300">{p.ministry}</td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-rose-400">
                        {p.risk_score !== null && p.risk_score !== undefined ? `${p.risk_score}` : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/50 mb-1">
                        DETERIORATING
                      </div>
                      <p className="text-[11px] text-slate-400">{p.trend?.explanation || 'Progress gap widening or burn rate accelerating'}</p>
                    </td>
                    <td className="p-3 text-right no-print">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(p.project_id);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Analyze</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risk distribution + ministry chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-block">
        <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60 flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Risk Distribution
            </h3>
            <p className="text-xs text-slate-400">Classified by composite 0-100 risk score</p>
          </div>
          {risk_distribution.length > 0 ? (
            <>
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={risk_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {risk_distribution.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#3b82f6'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                {risk_distribution.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-2 py-1 bg-slate-800/50 rounded"
                  >
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[item.name] }}
                      />
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400 text-center px-4">
              Risk analysis pending: the active dataset lacks the fields required to
              classify risk.
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60 lg:col-span-2 flex flex-col justify-between">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Projects by Ministry
              </h3>
              <p className="text-xs text-slate-400">Portfolio allocation across the active dataset</p>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {ministry_distribution.length} ministries
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ministry_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="ministry"
                  stroke="#64748b"
                  fontSize={9}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                  tickFormatter={shortenMinistry}
                />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Project Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-400 text-right pt-2 border-t border-slate-800">
            Total monitored capital (revised cost):{' '}
            <strong className="text-slate-200">
              {totalCapital > 0
                ? `Rs ${Math.round(totalCapital).toLocaleString('en-IN')} Cr`
                : 'Not available'}
            </strong>
          </div>
        </div>
      </div>

      {/* Cost variance + schedule delay distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-block">
        <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Cost Variance Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Projects by cost escalation bracket
            {cost_variance_missing > 0 && (
              <span className="text-amber-400">
                {' '}
                &bull; {cost_variance_missing} project(s) have no cost variance data
              </span>
            )}
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cost_variance_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Projects" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Schedule Delay Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Projects by timeline slippage bracket
            {schedule_delay_missing > 0 && (
              <span className="text-amber-400">
                {' '}
                &bull; {schedule_delay_missing} project(s) have no schedule data
              </span>
            )}
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schedule_delay_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Projects" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Planned vs actual progress */}
      {progress_comparison_sample.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60 print-block">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Planned vs Actual Physical Progress (Sample)
              </h3>
              <p className="text-xs text-slate-400">
                Execution gap across a cross-section of the active dataset
              </p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progress_comparison_sample} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="project_id" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  type="monotone"
                  dataKey="planned"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  name="Planned Progress (%)"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.4}
                  name="Actual Progress (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Screen-visible source footer */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed print-block">
        <strong className="text-slate-300">Data source:</strong> {dataSource.label}.{' '}
        {dataSource.disclaimer} National figures shown above are{' '}
        {national_reference?.label} quoted from {national_reference?.source}, and are not
        derived from this application&apos;s dataset.
      </div>
    </div>
  );
}
