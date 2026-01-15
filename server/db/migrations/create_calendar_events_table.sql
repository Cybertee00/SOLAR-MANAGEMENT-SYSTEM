-- Migration: Create calendar_events table
-- Stores scheduled tasks/events on the year calendar

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date DATE NOT NULL,
    task_title VARCHAR(500) NOT NULL,
    procedure_code VARCHAR(50),
    description TEXT,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    frequency VARCHAR(50), -- weekly, monthly, quarterly, annually, etc.
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_template_id ON calendar_events(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_asset_id ON calendar_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_procedure_code ON calendar_events(procedure_code);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON calendar_events(event_date, task_title);
