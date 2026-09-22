import React from 'react';
import { useDataSource } from '../context/DataSourceContext';
import {
  LayoutDashboard,
  FolderKanban,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Sliders,
  GitCompare,
  Bot,
  Layers,
  ChevronRight,
  Settings
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { status } = useDataSource();

  const menuItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, badge: null },
    {
      id: 'projects',
      label: 'Project Explorer',
      icon: FolderKanban,
      badge: String(status.active_project_count ?? ''),
    },
    { id: 'early-warnings', label: 'Early Warning Center', icon: AlertTriangle, badge: 'Alerts' },
    { id: 'risk-analytics', label: 'Risk Analytics', icon: BarChart3, badge: null },
    { id: 'ai-risk', label: 'AI Risk Analysis', icon: ShieldAlert, badge: '0-100' },
    { id: 'simulator', label: 'What-if Simulator', icon: Sliders, badge: 'Sim' },
    { id: 'cuf-analysis', label: 'CUF & Model Evaluation', icon: GitCompare, badge: 'ML' },
    { id: 'assistant', label: 'AI Project Assistant', icon: Bot, badge: 'Q&A' },
    { id: 'settings', label: 'Settings & Architecture', icon: Settings, badge: 'v1.0' },
  ];

  return (
    <aside className="w-64 bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0 select-none shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
      <div className="space-y-5">
        {/* Workflow Pipeline Card */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900/90 to-indigo-950/30 border border-indigo-500/20 shadow-inner">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            OPERATIONAL WORKFLOW
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
            <span className="text-slate-400">DATA</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-blue-400">PREDICT</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-amber-400">EXPLAIN</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-rose-400">ALERT</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-emerald-400">ACT</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90 hover:translate-x-0.5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 group-hover:border-indigo-500/30 group-hover:text-indigo-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Engine Status:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
            Online (v1.0)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Data Source:</span>
          <span
            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
              status.is_synthetic
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            }`}
          >
            {status.is_synthetic ? 'Demo (Synthetic)' : 'Real (Imported)'}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 pt-1 font-mono">
          SIH 2026 • SIH26103 Prototype
        </div>
      </div>
    </aside>
  );
}
