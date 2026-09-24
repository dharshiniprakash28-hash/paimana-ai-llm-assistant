-- ==============================================================================
-- PAIMANA-AI: Supabase PostgreSQL Database Schema
-- SIH26103 - Predictive Infrastructure Monitoring & Early Warning System
-- ==============================================================================

-- 1. Ministries Table
CREATE TABLE IF NOT EXISTS public.ministries (
    ministry_id SERIAL PRIMARY KEY,
    ministry_name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    project_id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    ministry VARCHAR(255),
    sector VARCHAR(100) NOT NULL,
    implementing_agency VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    original_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    revised_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    cost_variance NUMERIC(14, 2) DEFAULT 0.0,
    cost_variance_pct NUMERIC(6, 2) DEFAULT 0.0,
    expenditure NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    expenditure_ratio NUMERIC(6, 4) DEFAULT 0.0,
    planned_progress NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    actual_progress NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    progress_gap NUMERIC(6, 2) DEFAULT 0.0,
    planned_start_date DATE NOT NULL,
    planned_completion_date DATE NOT NULL,
    expected_completion_date DATE NOT NULL,
    planned_duration_months INT DEFAULT 0,
    schedule_delay_months INT DEFAULT 0,
    milestone_count INT NOT NULL DEFAULT 10,
    milestones_completed INT NOT NULL DEFAULT 0,
    milestone_delays INT NOT NULL DEFAULT 0,
    milestone_delay_ratio NUMERIC(6, 4) DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'In Progress',
    reason_for_delay TEXT,
    candidate_variables JSONB,
    history JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Candidate Telemetry Table (Optional detailed logs)
CREATE TABLE IF NOT EXISTS public.candidate_telemetry (
    telemetry_id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES public.projects(project_id) ON DELETE CASCADE,
    contractor_rating NUMERIC(3, 2),
    land_acquisition_delay_days INT DEFAULT 0,
    weather_disruption_days INT DEFAULT 0,
    material_price_escalation_pct NUMERIC(5, 2) DEFAULT 0.0,
    labour_availability_index NUMERIC(3, 2) DEFAULT 1.0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Risk Evaluations Table
CREATE TABLE IF NOT EXISTS public.risk_evaluations (
    eval_id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES public.projects(project_id) ON DELETE CASCADE,
    overall_risk_score INT NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    cost_overrun_risk_pct NUMERIC(5, 2),
    schedule_overrun_risk_pct NUMERIC(5, 2),
    progress_risk_pct NUMERIC(5, 2),
    milestone_risk_pct NUMERIC(5, 2),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_sector ON public.projects(sector);
CREATE INDEX IF NOT EXISTS idx_projects_region ON public.projects(region);
CREATE INDEX IF NOT EXISTS idx_risk_project_id ON public.risk_evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_project_id ON public.candidate_telemetry(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_evaluations ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon and Authenticated Read & Write Access for Demo & Backend API
DROP POLICY IF EXISTS "Allow public read access on ministries" ON public.ministries;
CREATE POLICY "Allow public read access on ministries" ON public.ministries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all for service role on ministries" ON public.ministries;
CREATE POLICY "Allow all for service role on ministries" ON public.ministries FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access on projects" ON public.projects;
CREATE POLICY "Allow public read access on projects" ON public.projects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all on projects" ON public.projects;
CREATE POLICY "Allow all on projects" ON public.projects FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access on candidate_telemetry" ON public.candidate_telemetry;
CREATE POLICY "Allow public read access on candidate_telemetry" ON public.candidate_telemetry FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all on candidate_telemetry" ON public.candidate_telemetry;
CREATE POLICY "Allow all on candidate_telemetry" ON public.candidate_telemetry FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access on risk_evaluations" ON public.risk_evaluations;
CREATE POLICY "Allow public read access on risk_evaluations" ON public.risk_evaluations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all on risk_evaluations" ON public.risk_evaluations;
CREATE POLICY "Allow all on risk_evaluations" ON public.risk_evaluations FOR ALL USING (true);
