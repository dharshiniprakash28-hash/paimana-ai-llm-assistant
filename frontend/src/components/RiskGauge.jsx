import React from 'react';

export default function RiskGauge({ score = 50, level = 'MEDIUM', size = 180 }) {
  // Score 0-100
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  // Calculate stroke dash for circle/arc
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  // Use a 240-degree arc
  const arcLength = circumference * (240 / 360);
  const strokeOffset = arcLength - (arcLength * (normalizedScore / 100));

  let color = '#3b82f6';
  let badgeBg = 'bg-blue-950/80 border-blue-500/30 text-blue-300';

  if (normalizedScore >= 81) {
    color = '#ef4444'; // Red
    badgeBg = 'bg-rose-950/80 border-rose-500/30 text-rose-300';
  } else if (normalizedScore >= 61) {
    color = '#f97316'; // Orange
    badgeBg = 'bg-orange-950/80 border-orange-500/30 text-orange-300';
  } else if (normalizedScore >= 31) {
    color = '#eab308'; // Amber
    badgeBg = 'bg-amber-950/80 border-amber-500/30 text-amber-300';
  } else {
    color = '#22c55e'; // Green
    badgeBg = 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300';
  }

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 200 200" className="transform rotate-[150deg]">
          {/* Background track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke="#1e293b"
            strokeWidth="14"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active progress arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="14"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 10px ${color})` }}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        
        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center mt-2">
          <span className="text-4xl font-black font-mono tracking-tight text-white">
            {normalizedScore}
          </span>
          <span className="text-xs text-slate-400 font-medium">/ 100</span>
        </div>
      </div>

      <div className={`-mt-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${badgeBg}`}>
        {level} RISK
      </div>
    </div>
  );
}
