-- Migration: Add pause/resume functionality to tasks
-- Allows tasks to be paused and resumed, tracking pause time separately

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_pause_duration_minutes INTEGER DEFAULT 0;

-- Create index for paused tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_paused ON tasks(is_paused) WHERE is_paused = TRUE;
