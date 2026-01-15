-- Migration: Add pm_performed_by column to tasks table
-- This stores who performed the PM task that resulted in the CM task generation
-- For accountability and clarity

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pm_performed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_pm_performed_by ON tasks(pm_performed_by);
