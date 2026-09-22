import React from 'react';
import { AlertCircle, Database } from 'lucide-react';
import { useDataSource } from '../context/DataSourceContext';

/**
 * Reflects the ACTIVE data source rather than asserting a fixed one. When a real
 * PAIMANA extract is loaded it says so, and shifts the disclosure to what is
 * actually true then: the data is real, the risk analysis on top of it is not
 * an official prediction.
 */
export default function DisclaimerBanner() {
  const { status } = useDataSource();
  const synthetic = status.is_synthetic !== false;

  return (
    <div
      className={`no-print px-4 py-2 text-xs flex items-center justify-between gap-4 border-b ${
        synthetic
          ? 'bg-amber-950/40 border-amber-600/30 text-amber-200/90'
          : 'bg-emerald-950/30 border-emerald-600/30 text-emerald-200/90'
      }`}
    >
      <div className="flex items-center gap-2">
        {synthetic ? (
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        <span>
          <strong className={`font-semibold ${synthetic ? 'text-amber-300' : 'text-emerald-300'}`}>
            {synthetic ? 'DEMO DATA - SYNTHETIC:' : 'REAL PAIMANA DATA - IMPORTED:'}
          </strong>{' '}
          {status.disclaimer} Risk scores, drivers, alerts and financial impact figures
          are PAIMANA-AI derived analysis from a prototype engine, not official
          Government of India predictions.
        </span>
      </div>
      <span
        className={`hidden md:inline-block shrink-0 px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
          synthetic
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        }`}
      >
        SIH26103 Prototype
      </span>
    </div>
  );
}
