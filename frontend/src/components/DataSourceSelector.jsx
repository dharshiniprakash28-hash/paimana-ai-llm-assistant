import React from 'react';
import { Database, FlaskConical, Loader2 } from 'lucide-react';
import { useDataSource } from '../context/DataSourceContext';

/**
 * Lets the user switch between the synthetic demo dataset and an imported
 * PAIMANA extract. The REAL option stays disabled until a file has been
 * imported, so the app can never claim to show real data it does not have.
 */
export default function DataSourceSelector({ compact = false }) {
  const { status, switchMode, switching } = useDataSource();

  const handleChange = async (e) => {
    try {
      await switchMode(e.target.value);
    } catch {
      /* error surfaces through context state */
    }
  };

  const isReal = status.mode === 'REAL';
  const Icon = isReal ? Database : FlaskConical;

  return (
    <div className="flex items-center gap-2 no-print">
      <div
        className={`flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl border text-xs ${
          isReal
            ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
            : 'bg-amber-950/30 border-amber-700/40 text-amber-300'
        }`}
        title={status.disclaimer}
      >
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}

        {!compact && (
          <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
            Data Source
          </span>
        )}

        <select
          value={status.mode}
          onChange={handleChange}
          disabled={switching}
          className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer disabled:opacity-60"
        >
          {status.available_modes?.map((m) => (
            <option
              key={m.value}
              value={m.value}
              disabled={!m.enabled}
              className="bg-slate-900 text-slate-100"
            >
              {m.label}
              {!m.enabled ? ' (no file imported)' : ''}
            </option>
          ))}
        </select>
      </div>

      <span className="hidden lg:inline text-[10px] font-mono text-slate-400">
        {status.active_project_count} projects
      </span>
    </div>
  );
}
