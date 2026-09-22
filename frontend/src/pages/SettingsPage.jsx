import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Server,
  Shield,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { api, API_BASE } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';
import DataSourceImport from '../components/DataSourceImport';

export default function SettingsPage() {
  const { status: dataSource } = useDataSource();
  const [assistantStatus, setAssistantStatus] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: 'offline', error: `HTTP ${res.status}` });
      }
    } catch {
      setBackendHealth({ status: 'offline', error: 'Could not connect to localhost:8000' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    api
      .getAssistantStatus()
      .then(setAssistantStatus)
      .catch(() => setAssistantStatus(null));
  }, []);

  const postgresSchema = `-- PostgreSQL Production Schema for PAIMANA-AI (SIH26103)
CREATE TABLE ministries (
    ministry_id SERIAL PRIMARY KEY,
    ministry_name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL
);

CREATE TABLE projects (
    project_id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    ministry_id INT REFERENCES ministries(ministry_id),
    sector VARCHAR(100) NOT NULL,
    implementing_agency VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    original_cost NUMERIC(12, 2) NOT NULL,
    revised_cost NUMERIC(12, 2) NOT NULL,
    expenditure NUMERIC(12, 2) NOT NULL,
    planned_progress NUMERIC(5, 2) NOT NULL,
    actual_progress NUMERIC(5, 2) NOT NULL,
    planned_start_date DATE NOT NULL,
    planned_completion_date DATE NOT NULL,
    expected_completion_date DATE NOT NULL,
    milestone_count INT NOT NULL DEFAULT 10,
    milestones_completed INT NOT NULL DEFAULT 0,
    milestone_delays INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'In Progress',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_telemetry (
    telemetry_id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(project_id),
    contractor_rating NUMERIC(3, 2),
    land_acquisition_delay_days INT DEFAULT 0,
    weather_disruption_days INT DEFAULT 0,
    material_price_escalation_pct NUMERIC(5, 2) DEFAULT 0.0,
    labour_availability_index NUMERIC(3, 2) DEFAULT 1.0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_evaluations (
    eval_id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(project_id),
    overall_risk_score INT NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    cost_overrun_risk_pct NUMERIC(5, 2),
    schedule_overrun_risk_pct NUMERIC(5, 2),
    progress_risk_pct NUMERIC(5, 2),
    milestone_risk_pct NUMERIC(5, 2),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-400" />
          System Settings & Platform Architecture
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Backend services status, database-ready PostgreSQL schema, and SIH 2026 problem statement configuration
        </p>
      </div>

      {/* Real PAIMANA data import */}
      <DataSourceImport />

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend & Environment Health */}
        <div className="glass-panel border border-slate-700/60 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              API Service & Runtime Health
            </h3>
            <button
              onClick={checkHealth}
              disabled={checking}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>Ping</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400">FastAPI Backend (Port 8000):</span>
              <span className="font-mono font-bold flex items-center gap-1.5">
                {backendHealth?.status === 'healthy' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online (healthy)
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Fallback Client Engine Active
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400">ML Stack:</span>
              <span className="font-mono text-purple-300">scikit-learn, XGBoost, SHAP</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400">Frontend Stack:</span>
              <span className="font-mono text-blue-300">React, Vite, Tailwind CSS, Recharts</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400">Active Data Source:</span>
              <span
                className={`font-mono font-bold ${
                  dataSource.is_synthetic ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {dataSource.label} ({dataSource.active_project_count})
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400">Demo Dataset:</span>
              <span className="font-mono text-slate-200">
                {dataSource.demo_project_count} synthetic projects
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400">AI Assistant Mode:</span>
              <span
                className={`font-mono font-bold ${
                  assistantStatus?.llm_enabled ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                {assistantStatus
                  ? assistantStatus.llm_enabled
                    ? `Gemini LLM (${assistantStatus.model})`
                    : 'Local fallback'
                  : 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* SIH 2026 Problem Statement Scope */}
        <div className="glass-panel border border-slate-700/60 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              SIH 2026 Scope Specification
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">Problem Statement ID:</div>
              <div className="font-mono font-bold text-blue-400 text-sm mt-0.5">SIH26103</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">Title:</div>
              <div className="font-semibold text-white mt-0.5">Web-based integrated project-monitoring platform</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">Project Name:</div>
              <div className="font-bold text-white mt-0.5">
                PAIMANA-AI – Predictive Infrastructure Monitoring & Early Warning System
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">Core Decision Workflow:</div>
              <div className="font-mono font-bold text-emerald-400 mt-0.5 text-[11px]">
                DATA → PREDICT → EXPLAIN → ALERT → ACT
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PostgreSQL Database Architecture */}
      <div className="glass-panel border border-slate-700/60 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              PostgreSQL Production-Ready Schema Architecture
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Designed for turnkey migration from prototype JSON repository to high-concurrency relational DB
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-700">
            PostgreSQL DDL
          </span>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed max-h-72">
          {postgresSchema}
        </pre>
      </div>

      {/* Data Integrity & Prototype Transparency */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-950 border border-amber-600/40 text-xs text-amber-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Mandatory Prototype Data Integrity Declaration
        </div>
        <p className="leading-relaxed text-[11px] text-amber-200/90">
          This system is a hackathon prototype developed for Smart India Hackathon 2026
          (SIH26103). {dataSource.disclaimer} Risk scores, drivers, alerts and financial
          impact figures are PAIMANA-AI derived analysis produced by a prototype engine, and
          are not official Government of India predictions or certified forecasts. National
          macro statistics shown on the dashboard are quoted from the problem statement and
          are not derived from the dataset loaded here.
        </p>
      </div>
    </div>
  );
}
