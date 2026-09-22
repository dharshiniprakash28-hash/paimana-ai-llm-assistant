import React, { useState } from 'react';
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  CheckCircle2
} from 'lucide-react';

export default function DemoTourGuide({ onNavigateStep, isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const demoSteps = [
    {
      step: 1,
      title: '1. Executive Dashboard',
      description: 'Review the National PAIMANA Snapshot (reference figures from the problem statement) alongside the Application Dataset panel, then the KPI cards, cost and schedule histograms, and the Priority Projects table.',
      targetTab: 'dashboard',
      projectId: null,
    },
    {
      step: 2,
      title: '2. Identify High-Risk Project',
      description: 'Open the highest-risk project from the Priority Projects table or the Project Explorer to see its risk drivers.',
      targetTab: 'projects',
      projectId: 'PRJ-101', // synthetic demo project
    },
    {
      step: 3,
      title: '3. Open Project Dossier',
      description: 'Inspect detailed project monitoring metrics: Planned vs Actual progress curve, Cost variance breakdown, and Milestone completion timeline.',
      targetTab: 'project-detail',
      projectId: 'PRJ-101', // synthetic demo project
    },
    {
      step: 4,
      title: '4. AI Risk Analysis & Decompositions',
      description: 'Click prominent AI Risk button to view overall risk score (91/100 CRITICAL), Cost Overrun Risk %, Schedule Overrun Risk %, and Milestone Breach Risk.',
      targetTab: 'ai-risk',
      projectId: 'PRJ-101', // synthetic demo project
    },
    {
      step: 5,
      title: '5. Explainable AI (Why is this risky?)',
      description: 'Examine ranked SHAP driver attribution chart: Physical progress gap, schedule delay months, and cost variance with verbal recommendations.',
      targetTab: 'ai-risk',
      projectId: 'PRJ-101', // synthetic demo project
    },
    {
      step: 6,
      title: '6. Early Warning Alert Center',
      description: 'View active alerts categorized by severity (Critical, High, Medium) with automated actionable mitigation recommendations.',
      targetTab: 'early-warnings',
      projectId: null,
    },
    {
      step: 7,
      title: '7. What-if Risk Simulator',
      description: 'Interactively simulate policy interventions: Adjust progress sliders, milestone recovery, or material cost surge to observe real-time risk score delta.',
      targetTab: 'simulator',
      projectId: 'PRJ-101', // synthetic demo project
    },
    {
      step: 8,
      title: '8. CUF Predictive Capability Analysis',
      description: 'Empirical comparison between Model A (CUF baseline) vs Model B (Enriched candidate features) with real calculated ML metrics (Random Forest / XGBoost).',
      targetTab: 'cuf-analysis',
      projectId: null,
    },
    {
      step: 9,
      title: '9. AI Project Assistant & Return',
      description: 'Ask project intelligence questions to the conversational assistant, then return to Executive Dashboard to conclude the 3-5 minute demonstration.',
      targetTab: 'assistant',
      projectId: null,
    },
  ];

  if (!isOpen) return null;

  const step = demoSteps[currentStepIndex];

  const handleStepJump = (idx) => {
    setCurrentStepIndex(idx);
    const target = demoSteps[idx];
    onNavigateStep(target.targetTab, target.projectId);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 bg-slate-900 border-2 border-indigo-500/60 rounded-2xl shadow-2xl p-4 backdrop-blur-md text-white animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              SIH 2026 Guided Demo Story
              <span className="text-[10px] font-mono text-indigo-300">({currentStepIndex + 1}/{demoSteps.length})</span>
            </div>
            <div className="text-[10px] text-slate-400">3–5 Minute Evaluation Walkthrough</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step Body */}
      <div className="space-y-2 mb-4">
        <div className="font-bold text-sm text-indigo-300 flex items-center justify-between">
          <span>{step.title}</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-1 mb-3">
        {demoSteps.map((_, i) => (
          <button
            key={i}
            onClick={() => handleStepJump(i)}
            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
              i === currentStepIndex
                ? 'w-6 bg-indigo-500'
                : i < currentStepIndex
                ? 'bg-emerald-500'
                : 'bg-slate-700'
            }`}
            title={`Step ${i + 1}`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <button
          disabled={currentStepIndex === 0}
          onClick={() => handleStepJump(currentStepIndex - 1)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        <button
          onClick={() => onNavigateStep(step.targetTab, step.projectId)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
        >
          <Play className="w-3 h-3" />
          Go to Step
        </button>

        {currentStepIndex < demoSteps.length - 1 ? (
          <button
            onClick={() => handleStepJump(currentStepIndex + 1)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => {
              handleStepJump(0);
              onNavigateStep('dashboard');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            Finish
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
