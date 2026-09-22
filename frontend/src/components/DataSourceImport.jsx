import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Database,
  Loader2,
  Info,
  Download,
} from 'lucide-react';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';

/**
 * Imports a real PAIMANA extract and reports exactly what was and was not found
 * in the file. The coverage table is the important part: it is how a user sees
 * that a field is missing rather than silently defaulted.
 */
export default function DataSourceImport() {
  const { status, applyImportResult, clearImported, switchMode } = useDataSource();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.importDataset(file);
      setResult(res);
      applyImportResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleClear = async () => {
    setResult(null);
    setError(null);
    try {
      await clearImported();
    } catch (err) {
      setError(err.message);
    }
  };

  const meta = status.import_meta;
  const coverage = result?.field_availability || meta?.field_availability;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            Real PAIMANA Data Import
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload a CSV or XLSX extract. It is kept entirely separate from the synthetic
            demo dataset.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.getSampleCsvUrl()}
            download="paimana_sample_extract.csv"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shadow-sm"
            title="Download standardized sample PAIMANA CSV to test live import"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Sample CSV
          </a>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
            id="paimana-import-input"
          />
          <label
            htmlFor="paimana-import-input"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border cursor-pointer transition-colors ${
              uploading
                ? 'bg-slate-800 border-slate-700 text-slate-400'
                : 'bg-emerald-600/20 hover:bg-emerald-600/40 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Importing...' : 'Upload CSV / XLSX'}
          </label>

          {status.has_imported_dataset && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard
            </button>
          )}
        </div>
      </div>

      {/* Current state */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Active source</div>
          <div
            className={`font-mono font-bold mt-0.5 ${
              status.is_synthetic ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {status.label}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Imported file</div>
          <div className="font-mono text-slate-200 mt-0.5 truncate" title={meta?.filename}>
            {meta?.filename || 'None'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Imported rows</div>
          <div className="font-mono font-bold text-white mt-0.5">
            {status.imported_project_count || 0}
          </div>
        </div>
      </div>

      {/* Mode buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {status.available_modes?.map((m) => (
          <button
            key={m.value}
            onClick={() => m.enabled && switchMode(m.value)}
            disabled={!m.enabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              status.mode === m.value
                ? 'bg-blue-600 text-white border-blue-500'
                : m.enabled
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 cursor-pointer'
                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
            }`}
          >
            {m.label}
            {!m.enabled && ' (import a file first)'}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Import outcome */}
      {result && (
        <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-700/40 text-xs text-emerald-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            Imported {result.imported_rows} project(s)
            {result.skipped_rows > 0 && ` (${result.skipped_rows} row(s) skipped)`}
          </div>
          <p className="text-[11px] text-emerald-200/80 leading-relaxed">{result.note}</p>
        </div>
      )}

      {/* Warnings from the importer */}
      {(result?.warnings ?? meta?.warnings ?? []).length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-700/40 text-xs text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            Import notes
          </div>
          <ul className="space-y-1 text-[11px] leading-relaxed">
            {(result?.warnings ?? meta?.warnings ?? []).map((w, i) => (
              <li key={i} className="pl-3 relative">
                <span className="absolute left-0">&bull;</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Field coverage */}
      {coverage && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Field coverage in the uploaded file
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="sticky top-0">
                <tr className="bg-slate-800/90 text-slate-400 uppercase tracking-wider text-[9px]">
                  <th className="p-2">Field</th>
                  <th className="p-2">Mapped from column</th>
                  <th className="p-2 text-right">Rows present</th>
                  <th className="p-2 text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(coverage).map(([field, info]) => (
                  <tr key={field} className={info.available ? '' : 'opacity-60'}>
                    <td className="p-2 font-mono text-slate-300">{field}</td>
                    <td className="p-2 text-slate-400 truncate max-w-[180px]">
                      {info.mapped_from || (
                        <span className="text-rose-400">Not present in file</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-300">
                      {info.present_rows}/{info.total_rows}
                    </td>
                    <td className="p-2 text-right">
                      <span
                        className={`font-mono font-bold ${
                          info.coverage_pct === 100
                            ? 'text-emerald-400'
                            : info.coverage_pct > 0
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {info.coverage_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[10px] text-slate-400 leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px text-slate-500" />
        <span>
          Column headers are matched case-insensitively against a set of known PAIMANA
          aliases (for example &ldquo;Original Approved Cost&rdquo;, &ldquo;Sanctioned
          Cost&rdquo;). A project identifier column and a project name column are required.
          Fields absent from the file stay absent: no value is imputed, and nothing is copied
          from the synthetic demo dataset. Where required inputs are missing, the dashboard
          shows &ldquo;Risk analysis pending&rdquo; instead of an estimated score.
        </span>
      </div>
    </div>
  );
}
