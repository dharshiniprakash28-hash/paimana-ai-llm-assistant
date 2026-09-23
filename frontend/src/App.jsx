import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DisclaimerBanner from './components/DisclaimerBanner';
import DemoTourGuide from './components/DemoTourGuide';
import { DataSourceProvider } from './context/DataSourceContext';

// Pages
import { api } from './services/api';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import AIRiskPage from './pages/AIRiskPage';
import EarlyWarningsPage from './pages/EarlyWarningsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SimulatorPage from './pages/SimulatorPage';
import CUFAnalysisPage from './pages/CUFAnalysisPage';
import AssistantPage from './pages/AssistantPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <DataSourceProvider>
      <AppShell />
    </DataSourceProvider>
  );
}

function AppShell() {
  // Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('paimana_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Verify Supabase Connection on startup
  useEffect(() => {
    async function checkSupabase() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('❌ Supabase connection error:', error.message);
      } else {
        console.log('✅ Supabase connected successfully! Session status:', data);
      }
    }
    checkSupabase();
  }, []);

  // Navigation & Project selection
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState('PRJ-101');
  const [searchQuery, setSearchQuery] = useState('');
  const [alertCount, setAlertCount] = useState(0);
  const [isDemoTourOpen, setIsDemoTourOpen] = useState(false);

  // Keep the navbar alert badge in step with the active dataset.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .getAlerts()
      .then((alerts) => {
        if (!cancelled) setAlertCount(Array.isArray(alerts) ? alerts.length : 0);
      })
      .catch(() => {
        if (!cancelled) setAlertCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, activeTab]);

  // Handle Login
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('paimana_user', JSON.stringify(userData));
    setActiveTab('dashboard');
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('paimana_user');
  };

  // Navigate to Project Details
  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveTab('project-detail');
  };

  // Navigate to AI Risk Analysis
  const handleNavigateToAiRisk = (projectId) => {
    setSelectedProjectId(projectId || selectedProjectId);
    setActiveTab('ai-risk');
  };

  // Navigate to What-if Simulator
  const handleNavigateToSimulator = (projectId) => {
    setSelectedProjectId(projectId || selectedProjectId);
    setActiveTab('simulator');
  };

  // Global search from Navbar
  const handleSearch = (term) => {
    setSearchQuery(term);
    setActiveTab('projects');
  };

  // Guided demo tour step jump
  const handleDemoStepJump = (targetTab, targetProjectId) => {
    if (targetProjectId) {
      setSelectedProjectId(targetProjectId);
    }
    setActiveTab(targetTab);
  };

  // If not logged in, render professional Login Page
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Disclaimer Banner */}
      <DisclaimerBanner />

      {/* Top Navbar */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        onSearch={handleSearch}
        alertCount={alertCount}
        onOpenAlerts={() => setActiveTab('early-warnings')}
        onOpenDemoTour={() => setIsDemoTourOpen(true)}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Scrollable Page Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-transparent">
          {activeTab === 'dashboard' && (
            <DashboardPage
              onSelectProject={handleSelectProject}
              onNavigateToWarnings={() => setActiveTab('early-warnings')}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsPage
              initialSearch={searchQuery}
              onSelectProject={handleSelectProject}
            />
          )}

          {activeTab === 'project-detail' && (
            <ProjectDetailPage
              projectId={selectedProjectId}
              onBack={() => setActiveTab('projects')}
              onNavigateToAiRisk={handleNavigateToAiRisk}
              onNavigateToSimulator={handleNavigateToSimulator}
            />
          )}

          {activeTab === 'ai-risk' && (
            <AIRiskPage
              initialProjectId={selectedProjectId}
              onNavigateToSimulator={handleNavigateToSimulator}
            />
          )}

          {activeTab === 'early-warnings' && (
            <EarlyWarningsPage onSelectProject={handleSelectProject} />
          )}

          {activeTab === 'risk-analytics' && (
            <AnalyticsPage />
          )}

          {activeTab === 'simulator' && (
            <SimulatorPage initialProjectId={selectedProjectId} />
          )}

          {activeTab === 'cuf-analysis' && (
            <CUFAnalysisPage />
          )}

          {activeTab === 'assistant' && (
            <AssistantPage
              onSelectProject={handleSelectProject}
              onNavigateToAiRisk={handleNavigateToAiRisk}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage />
          )}
        </main>
      </div>

      {/* Floating 3-5 Minute Guided Demo Story Guide */}
      <DemoTourGuide
        isOpen={isDemoTourOpen}
        onClose={() => setIsDemoTourOpen(false)}
        onNavigateStep={handleDemoStepJump}
      />
    </div>
  );
}
