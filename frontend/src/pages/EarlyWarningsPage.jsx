import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Search,
  RefreshCw,
  Calculator,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';
import { NOT_AVAILABLE } from '../utils/format';

export default function EarlyWarningsPage({ onSelectProject }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { status: dataSource, version } = useDataSource();

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(selectedSeverity, page, pageSize);
      if (data && Array.isArray(data.items)) {
        setAlerts(data.items);
        setTotalAlerts(data.total || data.items.length);
        setTotalPages(data.pages || 1);
      } else if (Array.isArray(data)) {
        setAlerts(data);
        setTotalAlerts(data.length);
        setTotalPages(Math.max(1, Math.ceil(data.length / pageSize)));
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSeverity, page, pageSize]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts, version]);

  const handleSeverityChange = (sev) => {
    setSelectedSeverity(sev);
    setPage(1);
  };

  const filteredAlerts = alerts.filter((a) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.project_name.toLowerCase().includes(q) ||
      a.project_id.toLowerCase().includes(q) ||
      a.risk_type.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q)
    );
  });

  const getAlertIcon = (riskType) => {
    if (riskType.includes('Cost')) return TrendingUp;
    if (riskType.includes('Schedule') || riskType.includes('Timeline')) return Clock;
    if (riskType.includes('Critical')) return AlertOctagon;
    return AlertTriangle;
  };

  const getSeverityBadge = (severity) => {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-950 text-rose-300 border border-rose-600/50 flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          CRITICAL
        </span>
      );
    }
    if (s === 'HIGH') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-950 text-orange-300 border border-orange-600/50 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          HIGH
        </span>
      );
    }
    if (s === 'MEDIUM') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-600/50 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          MEDIUM
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600/50 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        LOW
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Early Warning Indicators
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Threshold triggers for intervention before cost and schedule breach, computed from{' '}
            <span className={dataSource.is_synthetic ? 'text-amber-300' : 'text-emerald-300'}>
              {dataSource.label}
            </span>
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 cursor-pointer w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          Refresh Alerts
        </button>
      </div>

      {/* Severity Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl border border-slate-700/60 p-4 shadow-xl">
        {/* Severity Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => handleSeverityChange(sev)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedSeverity === sev
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700/70'
              }`}
            >
              {sev === 'All' ? 'All Alerts' : sev}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search warnings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
            Loading early warnings feed...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 glass-panel border border-slate-700/60 rounded-2xl text-center text-slate-400 shadow-xl">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
            No active early warning alerts matching filter criteria.
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const Icon = getAlertIcon(alert.risk_type);
            return (
              <div
                key={alert.alert_id || idx}
                className="glass-panel border border-slate-700/60 hover:border-indigo-500/40 rounded-2xl p-5 shadow-xl transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40 shadow-sm shadow-rose-900/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          {alert.project_id}
                        </span>
                        <h4 className="font-bold text-sm text-white">{alert.risk_type}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {alert.project_name} • <span className="text-slate-300">{alert.ministry}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    {getSeverityBadge(alert.severity)}
                    <button
                      onClick={() => onSelectProject(alert.project_id)}
                      className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Project</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Key facts strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Risk Score
                    </div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {alert.risk_score !== null && alert.risk_score !== undefined
                        ? `${alert.risk_score}/100`
                        : 'Not available'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Primary Driver
                    </div>
                    <div
                      className="font-semibold text-slate-200 mt-0.5 truncate"
                      title={alert.primary_driver}
                    >
                      {alert.primary_driver || NOT_AVAILABLE}
                    </div>
                  </div>

                  {/* Financial impact: only ever shown when legitimately derived */}
                  <div
                    className={`p-2.5 rounded-lg border ${
                      alert.financial_impact?.available
                        ? 'bg-amber-950/30 border-amber-700/40'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div
                      className={`text-[10px] uppercase tracking-wider ${
                        alert.financial_impact?.available ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {alert.financial_impact?.label || 'Financial Impact'}
                    </div>
                    <div
                      className={`font-mono font-bold mt-0.5 ${
                        alert.financial_impact?.available ? 'text-amber-200' : 'text-slate-400'
                      }`}
                    >
                      {alert.financial_impact?.display || 'Not available'}
                    </div>
                    {alert.financial_impact?.available && (
                      <div className="text-[9px] uppercase tracking-wider text-amber-400/80 font-semibold mt-0.5">
                        {alert.financial_impact.qualifier || 'Derived estimate'}
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Model Availability
                    </div>
                    <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                      {alert.model_availability || NOT_AVAILABLE}
                    </div>
                  </div>
                </div>

                {/* How the financial figure was derived */}
                {alert.financial_impact?.basis && (
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[10px] text-slate-400 leading-relaxed flex items-start gap-2">
                    <Calculator className="w-3.5 h-3.5 shrink-0 mt-px text-slate-500" />
                    <span>
                      <strong className="text-slate-300">Basis:</strong>{' '}
                      {alert.financial_impact.basis}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Trigger Reason:
                    </span>
                    <p className="text-slate-200">{alert.reason}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-600/30">
                    <span className="text-[11px] font-semibold text-indigo-300 block mb-1">
                      Recommended Action:
                    </span>
                    <p className="text-indigo-100 font-medium">{alert.recommended_action}</p>
                    <p className="text-[10px] text-indigo-300/70 italic mt-1.5">
                      Prototype decision-support suggestion, not an official Government
                      instruction.
                    </p>
                  </div>
                </div>

                {alert.confidence && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3" />
                    Confidence: {alert.confidence}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300">
          <div>
            Showing Page <span className="font-bold text-white">{page}</span> of{' '}
            <span className="font-bold text-white">{totalPages}</span> ({totalAlerts} total alerts)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Disclosure */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
        <strong className="text-slate-300">On financial impact figures:</strong> each value is
        a derived estimate calculated arithmetically from fields present on the project, and
        the formula used is stated on the card. They are not official Government forecasts.
        Where no legitimate basis exists, the card reads &ldquo;Not available&rdquo; rather
        than showing an estimate.
      </div>
    </div>
  );
}
