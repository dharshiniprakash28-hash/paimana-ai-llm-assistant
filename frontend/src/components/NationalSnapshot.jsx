import React from 'react';
import { Landmark, Layers, Info } from 'lucide-react';

/**
 * Two deliberately separated blocks:
 *
 *   NATIONAL PAIMANA SNAPSHOT  - macro reference figures quoted from the SIH26103
 *                                problem statement (April 2026). Not computed here.
 *   APPLICATION DATASET        - what is actually loaded in this application right
 *                                now, whether synthetic demo data or an import.
 *
 * Keeping them apart is the point: the app's project count must never be read as
 * the national portfolio.
 */

function formatCr(value) {
  if (value === null || value === undefined) return 'Not available';
  if (value >= 100000) return `Rs ${(value / 100000).toFixed(2)} Lakh Cr`;
  return `Rs ${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

export default function NationalSnapshot({ nationalReference, applicationDataset }) {
  if (!nationalReference) return null;

  const m = nationalReference.metrics || {};
  const nationalRows = [
    { label: m.projects?.label, value: m.projects?.display },
    { label: m.original_approved_cost?.label, value: m.original_approved_cost?.display },
    { label: m.revised_cost?.label, value: m.revised_cost?.display },
    { label: m.cumulative_expenditure?.label, value: m.cumulative_expenditure?.display },
    { label: m.ministries?.label, value: m.ministries?.display },
    { label: m.sectors?.label, value: m.sectors?.display },
  ];

  const app = applicationDataset || {};
  const appRows = [
    { label: 'Projects', value: app.projects?.toLocaleString('en-IN') ?? 'Not available' },
    { label: 'Ministries', value: app.ministries ?? 'Not available' },
    { label: 'Sectors', value: app.sectors ?? 'Not available' },
    { label: 'Original Cost', value: formatCr(app.total_original_cost_cr) },
    { label: 'Revised Cost', value: formatCr(app.total_revised_cost_cr) },
    { label: 'Expenditure', value: formatCr(app.total_expenditure_cr) },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-block">
      {/* ---------- National reference ---------- */}
      <div className="glass-panel rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/30 via-slate-900/80 to-slate-950/90 p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between gap-3 border-b border-indigo-800/40 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-900/60 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20">
              <Landmark className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>National PAIMANA Snapshot</span>
              </h3>
              <p className="text-[11px] text-indigo-300/90 mt-0.5">
                {nationalReference.label}
              </p>
            </div>
          </div>
          <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-900/60 text-indigo-300 border border-indigo-500/50">
            Reference
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {nationalRows.map((row) => (
            <div
              key={row.label}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-indigo-900/50 hover:border-indigo-700/50 transition-colors"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{row.label}</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">{row.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-indigo-200/80">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px text-indigo-400" />
          <span>
            Source: {nationalReference.source}. {nationalReference.note}
          </span>
        </div>
      </div>

      {/* ---------- Application dataset ---------- */}
      <div
        className={`glass-panel rounded-2xl border p-5 shadow-2xl relative overflow-hidden ${
          app.is_synthetic
            ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900/80 to-slate-950/90'
            : 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-slate-900/80 to-slate-950/90'
        }`}
      >
        <div
          className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
            app.is_synthetic ? 'bg-amber-500/10' : 'bg-emerald-500/10'
          }`}
        />
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                app.is_synthetic
                  ? 'bg-amber-900/50 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'bg-emerald-900/50 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
              }`}
            >
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Application Dataset
              </h3>
              <p
                className={`text-[11px] mt-0.5 font-medium ${
                  app.is_synthetic ? 'text-amber-300/90' : 'text-emerald-300/90'
                }`}
              >
                {app.label || 'Not available'}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
              app.is_synthetic
                ? 'bg-amber-900/50 text-amber-300 border-amber-500/50'
                : 'bg-emerald-900/50 text-emerald-300 border-emerald-500/50'
            }`}
          >
            {app.is_synthetic ? 'Synthetic' : 'Imported'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {appRows.map((row) => (
            <div key={row.label} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{row.label}</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">{row.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px text-slate-500" />
          <span>{app.disclaimer}</span>
        </div>
      </div>
    </div>
  );
}
