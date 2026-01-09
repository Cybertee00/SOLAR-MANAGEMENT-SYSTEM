-- Migration: Add draft checklist responses table for auto-save functionality

-- Create table for draft checklist responses
CREATE TABLE IF NOT EXISTS draft_checklist_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
    response_data JSONB NOT NULL, -- Draft response data
    maintenance_team TEXT,
    inspected_by TEXT,
    approved_by TEXT,
    images JSONB, -- Draft image metadata (uploaded paths + comments)
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id) -- One draft per task
);

-- Create index for draft responses
CREATE INDEX IF NOT EXISTS idx_draft_responses_task_id ON draft_checklist_responses(task_id);
CREATE INDEX IF NOT EXISTS idx_draft_responses_saved_at ON draft_checklist_responses(saved_at);

