import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  FolderKanban
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';
import { cell, crore, pct, shortenMinistry, NOT_AVAILABLE } from '../utils/format';

export default function ProjectsPage({ onSelectProject, initialSearch = '' }) {
  const [projects, setProjects] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [selectedMinistry, setSelectedMinistry] = useState('All');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedRisk, setSelectedRisk] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('risk_score');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    ministries: ['All'],
    sectors: ['All'],
    regions: ['All'],
    risk_levels: ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    statuses: ['All'],
  });

  const { status: dataSource, version } = useDataSource();

  // Filter options come from the active dataset, so they reload when it changes.
  useEffect(() => {
    api.getProjectFilters()
      .then((data) => setFilterOptions(data))
      .catch((err) => console.error('Error fetching filter options:', err));
  }, [version]);

  // Fetch projects whenever filters/pagination change
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProjects({
        search,
        ministry: selectedMinistry,
        sector: selectedSector,
        region: selectedRegion,
        risk_level: selectedRisk,
        status: selectedStatus,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        limit: 10,
      });
      setProjects(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedMinistry, selectedSector, selectedRegion, selectedRisk, selectedStatus, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, version]);

  // A data source switch invalidates the current page number.
  useEffect(() => {
    setCurrentPage(1);
  }, [version]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProjects();
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedMinistry('All');
    setSelectedSector('All');
    setSelectedRegion('All');
    setSelectedRisk('All');
    setSelectedStatus('All');
    setSortBy('risk_score');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-blue-400" />
            Infrastructure Project Explorer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Query, filter and inspect {totalCount} projects from{' '}
            <span className={dataSource.is_synthetic ? 'text-amber-300' : 'text-emerald-300'}>
              {dataSource.label}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Showing {projects.length} of {totalCount} Records
          </span>
          <button
            onClick={fetchProjects}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Reload table"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/60 space-y-3.5">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by project name, ID (e.g. PRJ-105), or agency (NHAI, RVNL, NTPC)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700/80 cursor-pointer transition-all"
          >
            Reset
          </button>
        </form>

        {/* Multi-select filter dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          {/* Ministry */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Ministry</label>
            <select
              value={selectedMinistry}
              onChange={(e) => { setSelectedMinistry(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {filterOptions.ministries.map((m) => (
                <option key={m} value={m}>
                  {m === 'All' ? 'All Ministries' : m.replace('Ministry of ', '')}
                </option>
              ))}
            </select>
          </div>

          {/* Sector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Sector</label>
            <select
              value={selectedSector}
              onChange={(e) => { setSelectedSector(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {filterOptions.sectors.map((s) => (
                <option key={s} value={s}>{s === 'All' ? 'All Sectors' : s}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => { setSelectedRegion(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {(filterOptions.regions || ['All']).map((r) => (
                <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
              ))}
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Risk Category</label>
            <select
              value={selectedRisk}
              onChange={(e) => { setSelectedRisk(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="All">All Risk Levels</option>
              <option value="CRITICAL" className="text-rose-400">CRITICAL (81-100)</option>
              <option value="HIGH" className="text-orange-400">HIGH (61-80)</option>
              <option value="MEDIUM" className="text-amber-400">MEDIUM (31-60)</option>
              <option value="LOW" className="text-emerald-400">LOW (0-30)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {filterOptions.statuses.map((st) => (
                <option key={st} value={st}>{st === 'All' ? 'All Statuses' : st}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Sort By</label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="risk_score">Risk Score</option>
                <option value="cost_variance">Cost Variance</option>
                <option value="schedule_delay">Schedule Delay</option>
                <option value="original_cost">Original Cost</option>
                <option value="progress_gap">Progress Gap</option>
                <option value="project_id">Project ID</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300"
                title={`Sort ${sortOrder === 'desc' ? 'Ascending' : 'Descending'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700/60 uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Project ID</th>
                <th className="p-3.5">Project Name</th>
                <th className="p-3.5">Ministry / Sector</th>
                <th className="p-3.5">Agency</th>
                <th className="p-3.5 text-right">Revised Cost (Cr)</th>
                <th className="p-3.5 text-center">Progress (P / A)</th>
                <th className="p-3.5 text-center">Delay</th>
                <th className="p-3.5 text-center">Risk Score</th>
                <th className="p-3.5">Primary Risk Driver</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading project records...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-slate-400">
                    No infrastructure projects matched your filter criteria.
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr
                    key={p.project_id}
                    onClick={() => onSelectProject(p.project_id)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="p-3.5 font-mono font-bold text-blue-400">
                      {p.project_id}
                    </td>
                    <td className="p-3.5 max-w-[220px]">
                      <div className="font-semibold text-slate-200 line-clamp-1 group-hover:text-blue-300">
                        {p.project_name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        Region: {p.region || NOT_AVAILABLE}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="text-slate-300 font-medium max-w-[160px] truncate" title={p.ministry}>
                        {shortenMinistry(p.ministry)}
                      </div>
                      <div className="text-[11px] text-slate-400">{p.sector || NOT_AVAILABLE}</div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-300">
                      {p.implementing_agency || NOT_AVAILABLE}
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      <div className="font-semibold text-white">
                        {crore(p.revised_cost, { fallback: '--' })}
                      </div>
                      {p.cost_variance > 0 && (
                        <div className="text-[10px] text-amber-400">
                          +{crore(p.cost_variance, { fallback: '--' })} ({pct(p.cost_variance_pct, { fallback: '--', sign: true })})
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="font-mono text-xs">
                        <span className="text-blue-400 font-semibold">{cell(p.planned_progress, (v) => `${v}%`)}</span>
                        {' / '}
                        <span className="text-emerald-400 font-semibold">{cell(p.actual_progress, (v) => `${v}%`)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Gap: <span className={p.progress_gap > 10 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {cell(p.progress_gap, (v) => `${v}%`)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        p.schedule_delay_months > 12 ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        p.schedule_delay_months > 3 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {cell(p.schedule_delay_months, (v) => `${v} mo`)}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {p.risk?.score_available ? (
                        <RiskBadge level={p.risk?.risk_level} score={p.risk?.overall_risk_score} />
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          Risk analysis pending
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 max-w-[170px]">
                      <div className="text-[11px] text-slate-300 truncate" title={p.risk?.primary_driver}>
                        {p.risk?.primary_driver || NOT_AVAILABLE}
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(p.project_id);
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Details</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-mono text-xs text-slate-300">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
