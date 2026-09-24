import {
  BarChart3,
  Compass,
  AlertTriangle,
  Layers,
  TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';
import { crore, pct, cell, shortenMinistry, NOT_AVAILABLE } from '../utils/format';

export default function AnalyticsPage() {
  const [ministries, setMinistries] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [benchmarks, setBenchmarks] = useState(null);
  const [delayTaxonomy, setDelayTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('ministries'); // 'ministries', 'sectors', or 'taxonomy'
  const { version } = useDataSource();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getMinistryAnalytics(),
      api.getSectorAnalytics(),
      api.getBenchmarks(),
      api.getDelayTaxonomy(),
    ])
      .then(([min, sec, bench, tax]) => {
        setMinistries(min);
        setSectors(sec);
        setBenchmarks(bench);
        setDelayTaxonomy(tax);
      })
      .catch((err) => console.error('Failed to load analytics:', err))
      .finally(() => setLoading(false));
  }, [version]);

  if (loading || !benchmarks || !benchmarks.global_benchmarks) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Aggregating Cross-Ministry & Sector Benchmarks...</p>
      </div>
    );
  }

  const global = benchmarks.global_benchmarks || {};

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Infrastructure Risk Analytics & Benchmarking
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-portfolio comparative intelligence, sector variance, and ministerial risk indexation
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('ministries')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'ministries'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            By Ministry ({ministries.length})
          </button>
          <button
            onClick={() => setViewMode('sectors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'sectors'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            By Sector ({sectors.length})
          </button>
          <button
            onClick={() => setViewMode('taxonomy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'taxonomy'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400 hover:text-amber-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            MoSPI Bottlenecks (8 Factors)
          </button>
        </div>
      </div>

      {/* Global Benchmarks KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl border border-slate-700/60 p-5 shadow-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            National Mean Risk Score
          </span>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {global.average_risk_score ?? 'Pending'}{' '}
            <span className="text-xs text-slate-400 font-normal">
              {global.average_risk_score === null || global.average_risk_score === undefined
                ? ''
                : '/ 100'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            Threshold baseline across active projects
          </span>
        </div>

        <div className="glass-panel rounded-2xl border border-slate-700/60 p-5 shadow-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Mean Cost Escalation
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {global.average_cost_variance_pct !== null && global.average_cost_variance_pct !== undefined
              ? `+${global.average_cost_variance_pct}%`
              : 'Pending'}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            Over original approved budget
          </span>
        </div>

        <div className="glass-panel rounded-2xl border border-slate-700/60 p-5 shadow-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Mean Schedule Slippage
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {global.average_schedule_delay_months !== null && global.average_schedule_delay_months !== undefined
              ? `${global.average_schedule_delay_months} Mo`
              : 'Pending'}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            Timeline past original COD
          </span>
        </div>

        <div className="glass-panel rounded-2xl border border-slate-700/60 p-5 shadow-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {viewMode === 'taxonomy' ? 'Total Delayed Projects' : 'Monitored Central Entities'}
          </span>
          <div className="text-2xl font-black font-mono text-blue-400 mt-1">
            {viewMode === 'taxonomy'
              ? `${delayTaxonomy?.total_delayed_projects || 0} Projects`
              : '7 Ministries'}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            {viewMode === 'taxonomy' ? 'Active delay root causes' : '18 Infrastructure Sectors'}
          </span>
        </div>
      </div>

      {viewMode === 'taxonomy' ? (
        /* MoSPI 8-Factor Bottlenecks View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Delayed Projects by MoSPI Statutory Delay Factor
              </h3>
              <p className="text-xs text-slate-400 mb-4">Official 8-factor classification reported to MoSPI IPMD</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={delayTaxonomy?.taxonomy || []}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" fontSize={10} />
                    <YAxis
                      dataKey="category"
                      type="category"
                      stroke="#94a3b8"
                      fontSize={10}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Projects Affected" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Cumulative Cost Escalation by Root Cause (₹ Cr)
              </h3>
              <p className="text-xs text-slate-400 mb-4">Aggregated budget overrun attributable to specific delay factor</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={delayTaxonomy?.taxonomy || []}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v}`} />
                    <YAxis
                      dataKey="category"
                      type="category"
                      stroke="#94a3b8"
                      fontSize={10}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                      formatter={(val) => [`₹${val.toLocaleString()} Cr`, 'Cost Escalation']}
                    />
                    <Bar dataKey="cost_escalation_total" fill="#ef4444" radius={[0, 4, 4, 0]} name="Cost Escalation (₹ Cr)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MoSPI Statutory Matrix Table */}
          <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60">
            <div className="p-4.5 border-b border-slate-700/60 bg-slate-900/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                MoSPI 8-Factor Statutory Bottleneck Matrix
              </h3>
              <span className="text-xs font-mono text-amber-400/90 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">
                IPMD Flash Report Standards
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Statutory Delay Cause</th>
                    <th className="p-3.5 text-center">Share of Delayed Projects</th>
                    <th className="p-3.5 text-center">Projects</th>
                    <th className="p-3.5 text-right">Cost Overrun (₹ Cr)</th>
                    <th className="p-3.5 text-center">Avg Delay</th>
                    <th className="p-3.5">Primary Affected Sectors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(delayTaxonomy?.taxonomy || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {row.category}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2 max-w-[140px] mx-auto">
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-amber-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, row.percentage)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-300 w-10 text-right">
                            {row.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-amber-300">
                        {row.count}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-rose-300">
                        {crore(row.cost_escalation_total)}
                      </td>
                      <td className="p-3.5 text-center font-mono text-purple-300">
                        {row.avg_delay_months} mo
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(row.sectors || []).slice(0, 3).map((sec, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300"
                            >
                              {sec.sector}: <strong className="text-white">{sec.count}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Original Ministries / Sectors View */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Risk Score by Entity */}
            <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Average Risk Score by {viewMode === 'ministries' ? 'Ministry' : 'Sector'}
              </h3>
              <p className="text-xs text-slate-400 mb-4">Ranked from highest systemic vulnerability</p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={viewMode === 'ministries' ? ministries : sectors.slice(0, 8)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 35 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey={viewMode === 'ministries' ? 'ministry' : 'sector'}
                      stroke="#64748b"
                      fontSize={10}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      tickFormatter={(val) => val.replace('Ministry of ', '').slice(0, 12)}
                    />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    <Bar dataKey="avg_risk_score" fill="#ef4444" radius={[4, 4, 0, 0]} name="Avg Risk Score (0-100)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost Variance vs Schedule Delay Comparison */}
            <div className="glass-panel rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Cost Escalation (%) vs Schedule Delay (Months)
              </h3>
              <p className="text-xs text-slate-400 mb-4">Dual metric impact comparison</p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={viewMode === 'ministries' ? ministries : sectors.slice(0, 8)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 35 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey={viewMode === 'ministries' ? 'ministry' : 'sector'}
                      stroke="#64748b"
                      fontSize={10}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      tickFormatter={(val) => val.replace('Ministry of ', '').slice(0, 12)}
                    />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    <Legend verticalAlign="top" height={32} />
                    <Bar dataKey="avg_cost_variance_pct" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Cost Escalation (%)" />
                    <Bar dataKey="avg_schedule_delay_months" fill="#a855f7" radius={[4, 4, 0, 0]} name="Delay (Months)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Comprehensive Benchmarking Matrix Table */}
          <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60">
            <div className="p-4.5 border-b border-slate-700/60 bg-slate-900/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                Infrastructure Portfolio Benchmark Index
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {viewMode === 'ministries' ? 'Ministries League Table' : 'Sectors League Table'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Name / Portfolio</th>
                    <th className="p-3.5 text-center">Projects</th>
                    <th className="p-3.5 text-right">Total Budget (₹ Cr)</th>
                    <th className="p-3.5 text-center">Avg Risk Score</th>
                    <th className="p-3.5 text-center">Avg Cost Escalation</th>
                    <th className="p-3.5 text-center">Avg Timeline Delay</th>
                    <th className="p-3.5 text-center">Critical Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(viewMode === 'ministries' ? ministries : sectors).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-200">
                        {item.ministry ? shortenMinistry(item.ministry) : item.sector || NOT_AVAILABLE}
                      </td>
                      <td className="p-3.5 text-center font-mono text-white">
                        {item.count}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-200">
                        {crore(item.total_budget_cr ?? item.total_cost_cr, { fallback: '--' })}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                          item.avg_risk_score >= 60 ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          item.avg_risk_score >= 40 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {item.avg_risk_score ?? 'Pending'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-amber-400">
                        {pct(item.avg_cost_variance_pct, { fallback: '--', sign: true })}
                      </td>
                      <td className="p-3.5 text-center font-mono text-purple-400">
                        {cell(item.avg_schedule_delay_months, (v) => `${v} mo`)}
                      </td>
                      <td className="p-3.5 text-center font-mono">
                        <span className={item.critical_projects > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                          {item.critical_projects}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
