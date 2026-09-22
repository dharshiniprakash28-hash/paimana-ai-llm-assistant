import React, { useState, useEffect, useCallback } from 'react';
import {
  GitCompare,
  Sparkles,
  TrendingUp,
  Cpu,
  Layers,
  HelpCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Sigma,
  Brain,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';
import { metric, NOT_AVAILABLE } from '../utils/format';

const CLASSIFICATION_LABELS = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1 Score',
  roc_auc: 'ROC-AUC',
};

const REGRESSION_LABELS = {
  mae: 'MAE',
  rmse: 'RMSE',
  r2: 'R\u00b2',
};

/** Renders a measured delta. Negative deltas are shown as negative, not hidden. */
function DeltaCell({ row, higherIsBetter }) {
  if (row.delta === null || row.delta === undefined) {
    return <span className="text-slate-500">{NOT_AVAILABLE}</span>;
  }
  const improved = higherIsBetter ? row.delta > 0 : row.delta < 0;
  const neutral = row.delta === 0;
  const colour = neutral
    ? 'text-slate-400'
    : improved
    ? 'text-emerald-400'
    : 'text-rose-400';
  const sign = row.delta > 0 ? '+' : '';
  return (
    <span className={`font-mono font-semibold ${colour}`}>
      {sign}
      {row.delta.toFixed(4)}
    </span>
  );
}

function ComparisonTable({ title, subtitle, baselineName, mlName, rows, labels, higherIsBetter }) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 print-block">
      <div className="p-4.5 border-b border-slate-700/60 bg-slate-900/40">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <th className="p-3">Metric</th>
              <th className="p-3 text-right">
                Conventional Baseline
                <div className="font-normal normal-case text-slate-500">{baselineName}</div>
              </th>
              <th className="p-3 text-right">
                ML Model
                <div className="font-normal normal-case text-slate-500">{mlName}</div>
              </th>
              <th className="p-3 text-right">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row) => (
              <tr key={row.metric} className="hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-200">
                  {labels[row.metric] || row.metric}
                </td>
                <td className="p-3 text-right font-mono text-blue-300">
                  {metric(row.baseline, { digits: 4 })}
                </td>
                <td className="p-3 text-right font-mono text-purple-300">
                  {metric(row.ml, { digits: 4 })}
                </td>
                <td className="p-3 text-right">
                  <DeltaCell row={row} higherIsBetter={higherIsBetter} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
        {higherIsBetter
          ? 'Higher is better for every metric in this table.'
          : 'Lower is better for error metrics (MAE, RMSE); higher is better for R\u00b2.'}{' '}
        Differences are reported as measured. Neither model is designated a winner.
      </div>
    </div>
  );
}

export default function CUFAnalysisPage() {
  const [evaluation, setEvaluation] = useState(null);
  const [featureStudy, setFeatureStudy] = useState(null);
  const [pipelineSync, setPipelineSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { status: dataSource, version } = useDataSource();

  const handleRunPipelineSync = async () => {
    setSyncing(true);
    try {
      const res = await api.runMonthlyPipelineSync();
      setPipelineSync(res);
    } catch (err) {
      console.error('Failed to run monthly pipeline sync:', err);
    } finally {
      setSyncing(false);
    }
  };

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBaselineVsML(refresh);
      setEvaluation(res);
    } catch {
      setError(
        'Could not reach the PAIMANA-AI backend to run the model evaluation. Ensure the FastAPI server is running on port 8000.'
      );
      setEvaluation(null);
    } finally {
      setLoading(false);
    }

    // The candidate-variable feature study is a secondary panel; a failure here
    // must not blank the page.
    try {
      const fs = await api.getCUFComparison();
      setFeatureStudy(fs);
    } catch {
      setFeatureStudy(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-2">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Fitting the baseline and ML models on the active dataset...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/40 border border-rose-600/40 rounded-xl text-rose-300 space-y-3">
        <p className="font-semibold text-sm">{error}</p>
        <p className="text-xs text-rose-200/80">
          No placeholder metrics are shown. All figures on this page are computed at
          request time from the active dataset, so none can be displayed while the
          backend is unreachable.
        </p>
        <button
          onClick={() => load()}
          className="px-4 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!evaluation?.available) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-purple-400" />
          Conventional Statistical Method vs Machine Learning
        </h2>
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-amber-600/40 text-sm text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            Insufficient data for prediction
          </div>
          <p className="text-xs leading-relaxed text-amber-200/90">
            {evaluation?.reason ||
              'The active dataset cannot be evaluated. No metrics are shown rather than estimated values.'}
          </p>
          <p className="text-xs text-slate-400">
            Active data source: <strong>{dataSource.label}</strong> (
            {dataSource.active_project_count} projects).
          </p>
        </div>
      </div>
    );
  }

  const { classification, regression, evaluation_protocol, model_information, explainability } =
    evaluation;

  const baselineName = classification.baseline.name;
  const mlName = classification.ml.name;

  const chartData = classification.comparison
    .filter((r) => r.baseline !== null && r.ml !== null)
    .map((r) => ({
      metric: CLASSIFICATION_LABELS[r.metric] || r.metric,
      baseline: +(r.baseline * 100).toFixed(1),
      ml: +(r.ml * 100).toFixed(1),
    }));

  const regressionRows = [
    ...regression.comparison_error,
    ...regression.comparison_fit,
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-purple-400" />
              Conventional Statistical Method vs Machine Learning
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
              SIH26103
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Does AI/ML give a significant gain over conventional statistical methods? Both
            models are fitted on the same dataset, the same target, the same train/test
            split and the same preprocessed feature matrix. Only the estimator differs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunPipelineSync}
            disabled={syncing}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/40 text-xs font-semibold text-emerald-300 cursor-pointer disabled:opacity-50"
            title="Benchmark the monthly ingestion and scoring SLA pipeline (<10 min SLA)"
          >
            <Clock className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : 'text-emerald-400'}`} />
            {syncing ? 'Benchmarking Pipeline...' : 'Benchmark Monthly SLA'}
          </button>
          <button
            onClick={() => load(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-run evaluation
          </button>
        </div>
      </div>

      {/* Monthly Pipeline Latency SLA Diagram (Slide Specification) */}
      <div className="glass-panel rounded-2xl border border-slate-700/60 p-5 shadow-2xl print-block space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Monthly Pipeline Latency Architecture (Target: &lt; 10 min Refresh)
            </h3>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {pipelineSync
              ? `Benchmark Passed in ${pipelineSync.benchmark_execution_sec}s (${pipelineSync.total_projects_processed} projects)`
              : 'Target SLA benchmark for IPMD monthly batch cycle'}
          </div>
        </div>

        {/* 4 Pipeline Stages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              step: '1. Data Ingest',
              target: '< 2 min',
              desc: 'PAIMANA/OCMS monthly extract validation',
              color: 'border-blue-500/40 bg-blue-950/20 text-blue-300',
              actual: pipelineSync?.steps[0]?.actual_duration_ms,
            },
            {
              step: '2. Feature Build',
              target: '< 3 min',
              desc: 'Leading indicators & panel update',
              color: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
              actual: pipelineSync?.steps[1]?.actual_duration_ms,
            },
            {
              step: '3. Model Scoring',
              target: '< 1 min',
              desc: 'Batch XGBoost / Random Forest inference',
              color: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
              actual: pipelineSync?.steps[2]?.actual_duration_ms,
            },
            {
              step: '4. Alert Generation',
              target: '< 1 min',
              desc: 'SHAP attribution & financial impact',
              color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
              actual: pipelineSync?.steps[3]?.actual_duration_ms,
            },
          ].map((stage, idx) => (
            <div key={idx} className={`p-3.5 rounded-xl border ${stage.color} relative overflow-hidden flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{stage.step}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                    Target: {stage.target}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">{stage.desc}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Actual Benchmark:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {stage.actual !== undefined ? `${stage.actual} ms` : 'Ready'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation protocol */}
      <div className="glass-panel rounded-2xl border border-slate-700/60 p-5 shadow-2xl print-block">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-800 text-purple-300">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">Evaluation protocol</div>
            <div className="text-[11px] text-slate-400">{evaluation_protocol.statement}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {[
            ['Dataset', dataSource.label],
            ['Total samples', evaluation_protocol.total_samples],
            ['Training samples', evaluation_protocol.train_samples],
            ['Test samples', evaluation_protocol.test_samples],
            ['Features', evaluation_protocol.feature_count],
            ['Split', `${(1 - evaluation_protocol.test_size) * 100}/${evaluation_protocol.test_size * 100} stratified`],
          ].map(([label, value]) => (
            <div key={label} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
              <div className="text-xs font-mono font-bold text-white mt-0.5 break-words">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 p-3 rounded-xl bg-blue-950/25 border border-blue-800/40 text-[11px] text-blue-200/90 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
          <span>
            <strong className="text-blue-300">Leakage control:</strong>{' '}
            {evaluation_protocol.leakage_control}
          </span>
        </div>
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-block">
        <div className="glass-panel border border-blue-500/40 rounded-2xl p-6 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-900/50 text-blue-300 border border-blue-700/50">
              MODEL A
            </span>
            <Sigma className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Conventional Statistical Baseline</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-300">{classification.baseline.name}</strong> for the
            classification task and{' '}
            <strong className="text-slate-300">{regression.baseline.name}</strong> for the
            regression task. A historical-average reference (predicting the training mean) is
            also reported for regression as the simplest conventional method of all.
          </p>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
            Historical average reference predicts{' '}
            <span className="font-mono text-slate-200">
              {regression.historical_average_reference.predicted_value}%
            </span>{' '}
            cost variance for every project. R&sup2;:{' '}
            <span className="font-mono text-slate-200">
              {metric(regression.historical_average_reference.metrics.r2, { digits: 4 })}
            </span>
          </div>
        </div>

        <div className="glass-panel border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-3 glow-indigo relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-900/60 text-purple-300 border border-purple-700">
              MODEL B
            </span>
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Machine Learning</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">{mlName}</strong>, a gradient-boosted / ensemble tree
            model receiving the identical preprocessed feature matrix as the baseline.
          </p>
          {classification.ml.fallback_note && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/40 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>{classification.ml.fallback_note}</span>
            </div>
          )}
        </div>
      </div>

      {/* Classification comparison */}
      <ComparisonTable
        title="Classification: will the project end up materially off-track?"
        subtitle={classification.target}
        baselineName={baselineName}
        mlName={mlName}
        rows={classification.comparison}
        labels={CLASSIFICATION_LABELS}
        higherIsBetter
      />

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 print-block">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Measured classification performance
            </h3>
            <p className="text-xs text-slate-400">
              Held-out test set of {evaluation_protocol.test_samples} unseen projects
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="metric" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                  formatter={(val) => [`${val}%`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="baseline" name={`Conventional baseline (${baselineName})`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ml" name={`ML model (${mlName})`} fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Regression comparison */}
      <ComparisonTable
        title="Regression: predicted final cost variance percentage"
        subtitle={regression.target}
        baselineName={regression.baseline.name}
        mlName={regression.ml.name}
        rows={regressionRows}
        labels={REGRESSION_LABELS}
        higherIsBetter={false}
      />

      {/* Interpretation */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300 leading-relaxed flex items-start gap-3 print-block">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p>{evaluation.interpretation}</p>
          <p className="text-slate-400">{evaluation.disclaimer}</p>
        </div>
      </div>

      {/* Model transparency */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 print-block">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Model Information
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Every value below is read from the evaluation actually performed on this dataset.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            ['ML model', model_information.ml_model],
            ['Baseline (classification)', model_information.baseline_classification_model],
            ['Baseline (regression)', model_information.baseline_regression_model],
            ['Training samples', model_information.training_samples],
            ['Test samples', model_information.test_samples],
            ['Feature count', model_information.feature_count],
            ['XGBoost available', model_information.xgboost_available ? 'Yes' : 'No'],
            ['Explainability', model_information.explainability],
          ].map(([label, value]) => (
            <div key={label} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
              <div className="text-xs font-mono font-bold text-white mt-1 break-words">{value}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase">
            Features supplied to both models ({model_information.feature_count})
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {model_information.features.map((f) => (
              <span
                key={f}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-blue-300 border border-slate-700"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Excluded fields */}
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-2">
          <div className="text-[11px] font-bold text-rose-300 uppercase">
            Fields deliberately excluded (leakage control)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {evaluation_protocol.excluded_fields.map((f) => (
              <span
                key={f}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-800/50 line-through"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Explainability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-block">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              ML feature importance
            </h3>
            <p className="text-xs text-slate-400">Top predictors learned by {mlName}</p>
          </div>
          {classification.ml.feature_importance?.length ? (
            <div className="space-y-2.5">
              {classification.ml.feature_importance.slice(0, 10).map((f) => (
                <div key={f.feature} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 truncate max-w-[70%]">{f.feature}</span>
                    <span className="font-mono font-bold text-white">
                      {(f.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (f.importance /
                            (classification.ml.feature_importance[0].importance || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">{NOT_AVAILABLE}</p>
          )}
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sigma className="w-4 h-4 text-blue-400" />
              Baseline coefficients
            </h3>
            <p className="text-xs text-slate-400">
              Standardised logistic regression coefficients (sign shows direction)
            </p>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {classification.baseline.coefficients.slice(0, 12).map((c) => (
              <div
                key={c.feature}
                className="flex justify-between items-center text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800"
              >
                <span className="font-mono text-slate-300 truncate max-w-[70%]">{c.feature}</span>
                <span
                  className={`font-mono font-bold ${
                    c.coefficient >= 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {c.coefficient > 0 ? '+' : ''}
                  {c.coefficient.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SHAP */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs shadow-lg print-block">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white text-sm">SHAP explainability</span>
        </div>
        {explainability.shap_available && explainability.shap_summary?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {explainability.shap_summary.slice(0, 12).map((s) => (
              <span
                key={s.feature}
                className="px-2 py-1 rounded text-[10px] font-mono bg-slate-950/70 text-amber-200 border border-amber-900/50"
              >
                {s.feature}: {s.mean_abs_shap}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">{explainability.shap_note}</p>
        )}
      </div>

      {/* Secondary: candidate-variable feature study */}
      {featureStudy?.dataset_metadata && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 print-block">
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" />
              Secondary study
            </div>
            <h3 className="text-lg font-bold text-white">
              Feature-set study: CUF variables vs CUF + candidate variables
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              A separate question from the one above: not which method is better, but whether
              adding candidate leading indicators to the schema would help.
            </p>
          </div>

          {featureStudy.methodological_caveat && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 text-[11px] text-amber-200 flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Read this before quoting these numbers:</strong>{' '}
                {featureStudy.methodological_caveat}
              </span>
            </div>
          )}

          <div className="text-[11px] text-slate-400">
            Trained on {featureStudy.dataset_metadata.train_samples} samples, tested on{' '}
            {featureStudy.dataset_metadata.test_samples}. Tree model used:{' '}
            <span className="font-mono text-slate-200">
              {featureStudy.boosted_model_used || NOT_AVAILABLE}
            </span>
          </div>
        </div>
      )}

      {/* Candidate variable proposal */}
      <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/30 text-xs text-amber-200 flex items-start gap-2.5 print-block">
        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          <strong>Candidate variable disclosure:</strong> Contractor rating, land acquisition
          delay, clearance status, weather disruption, material price escalation, labour
          availability and funding delay are candidate schema-extension fields proposed for
          this prototype. They exist only in the synthetic demo dataset and are not claimed
          to be captured in live official Government PAIMANA systems.
        </span>
      </div>
    </div>
  );
}
