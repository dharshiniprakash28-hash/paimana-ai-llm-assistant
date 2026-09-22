import React from 'react';

export default function RiskBadge({ level, score }) {
  const normalized = (level || '').toUpperCase();

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let dotColor = 'bg-slate-400';

  if (normalized === 'CRITICAL' || score >= 81) {
    colorClasses = 'bg-rose-950/80 text-rose-300 border-rose-600/40 shadow-sm shadow-rose-950/50';
    dotColor = 'bg-rose-500 animate-pulse';
  } else if (normalized === 'HIGH' || score >= 61) {
    colorClasses = 'bg-orange-950/80 text-orange-300 border-orange-600/40 shadow-sm shadow-orange-950/50';
    dotColor = 'bg-orange-500';
  } else if (normalized === 'MEDIUM' || score >= 31) {
    colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-600/40 shadow-sm shadow-amber-950/50';
    dotColor = 'bg-amber-400';
  } else if (normalized === 'LOW' || (score !== undefined && score < 31)) {
    colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40 shadow-sm shadow-emerald-950/50';
    dotColor = 'bg-emerald-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span>{normalized || 'LOW'}</span>
      {score !== undefined && (
        <span className="text-[11px] opacity-80 font-mono">({score})</span>
      )}
    </span>
  );
}
