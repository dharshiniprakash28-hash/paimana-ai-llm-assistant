import React from 'react';

export default function MetricCard({ title, value, subtext, icon: Icon, color = 'blue', onClick }) {
  const colorMap = {
    blue: {
      bg: 'from-blue-950/40 via-slate-900/60 to-slate-950/80',
      border: 'border-blue-500/20 hover:border-blue-500/50',
      glow: 'hover:shadow-blue-500/10',
      text: 'text-blue-400',
      iconBg: 'bg-gradient-to-br from-blue-600/30 to-indigo-600/20 text-blue-300 border border-blue-500/30',
      topBar: 'from-blue-500 via-indigo-500 to-cyan-400',
    },
    rose: {
      bg: 'from-rose-950/40 via-slate-900/60 to-slate-950/80',
      border: 'border-rose-500/20 hover:border-rose-500/50',
      glow: 'hover:shadow-rose-500/10',
      text: 'text-rose-400',
      iconBg: 'bg-gradient-to-br from-rose-600/30 to-red-600/20 text-rose-300 border border-rose-500/30',
      topBar: 'from-rose-500 via-red-500 to-amber-500',
    },
    orange: {
      bg: 'from-orange-950/40 via-slate-900/60 to-slate-950/80',
      border: 'border-orange-500/20 hover:border-orange-500/50',
      glow: 'hover:shadow-orange-500/10',
      text: 'text-orange-400',
      iconBg: 'bg-gradient-to-br from-orange-600/30 to-amber-600/20 text-orange-300 border border-orange-500/30',
      topBar: 'from-orange-500 via-amber-500 to-yellow-400',
    },
    amber: {
      bg: 'from-amber-950/40 via-slate-900/60 to-slate-950/80',
      border: 'border-amber-500/20 hover:border-amber-500/50',
      glow: 'hover:shadow-amber-500/10',
      text: 'text-amber-400',
      iconBg: 'bg-gradient-to-br from-amber-600/30 to-yellow-600/20 text-amber-300 border border-amber-500/30',
      topBar: 'from-amber-500 via-yellow-400 to-orange-400',
    },
    emerald: {
      bg: 'from-emerald-950/40 via-slate-900/60 to-slate-950/80',
      border: 'border-emerald-500/20 hover:border-emerald-500/50',
      glow: 'hover:shadow-emerald-500/10',
      text: 'text-emerald-400',
      iconBg: 'bg-gradient-to-br from-emerald-600/30 to-teal-600/20 text-emerald-300 border border-emerald-500/30',
      topBar: 'from-emerald-500 via-teal-400 to-cyan-400',
    },
    purple: {
      bg: 'from-purple-950/40 via-slate-900/60 to-slate-950/80',
      border: 'border-purple-500/20 hover:border-purple-500/50',
      glow: 'hover:shadow-purple-500/10',
      text: 'text-purple-400',
      iconBg: 'bg-gradient-to-br from-purple-600/30 to-indigo-600/20 text-purple-300 border border-purple-500/30',
      topBar: 'from-purple-500 via-indigo-500 to-pink-500',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-md bg-gradient-to-br ${scheme.bg} ${scheme.border} p-5 transition-all duration-200 shadow-md ${scheme.glow} ${
        onClick ? 'cursor-pointer hover:scale-[1.015] hover:shadow-xl' : ''
      }`}
    >
      {/* Top ambient color accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${scheme.topBar}`} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{title}</p>
          <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-white font-mono">
            {value}
          </h3>
          {subtext && (
            <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.iconBg} shadow-sm shrink-0`}>
            <Icon className="w-5 h-5 drop-shadow" />
          </div>
        )}
      </div>
    </div>
  );
}
