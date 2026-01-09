-- Solar O&M Maintenance Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'technician', -- technician, supervisor, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(100) UNIQUE NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(100) NOT NULL, -- weather_station, inverter, transformer, etc.
    location VARCHAR(255),
    installation_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, maintenance
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checklist Templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(100) UNIQUE NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    asset_type VARCHAR(100) NOT NULL, -- Links to asset type
    task_type VARCHAR(50) NOT NULL DEFAULT 'PM', -- PM (Preventive Maintenance) or CM (Corrective Maintenance)
    frequency VARCHAR(50), -- daily, weekly, monthly, quarterly, annually
    checklist_structure JSONB NOT NULL, -- Dynamic checklist structure
    validation_rules JSONB, -- Backend validation rules for pass/fail
    cm_generation_rules JSONB, -- Rules for generating CM tasks from failed PMs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table (PM/CM instances)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code VARCHAR(100) UNIQUE NOT NULL,
    checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    task_type VARCHAR(50) NOT NULL, -- PM or CM
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
    scheduled_date DATE,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    overall_status VARCHAR(50), -- pass, fail, partial
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- For CM tasks generated from PM
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checklist Responses table
CREATE TABLE IF NOT EXISTS checklist_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
    response_data JSONB NOT NULL, -- Dynamic response data matching checklist structure
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CM Letters table
CREATE TABLE IF NOT EXISTS cm_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    parent_pm_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    letter_number VARCHAR(100) UNIQUE NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    recommended_action TEXT,
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_asset_id ON tasks(asset_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_checklist_responses_task_id ON checklist_responses(task_id);
CREATE INDEX IF NOT EXISTS idx_cm_letters_task_id ON cm_letters(task_id);
CREATE INDEX IF NOT EXISTS idx_cm_letters_parent_pm_task_id ON cm_letters(parent_pm_task_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_asset_type ON checklist_templates(asset_type);

