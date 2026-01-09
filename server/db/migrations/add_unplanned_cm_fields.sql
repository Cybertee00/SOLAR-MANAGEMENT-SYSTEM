-- Migration: Add support for Planned CM and Unplanned CM task types
-- Add cm_occurred_at field for Unplanned CM tasks

-- Add cm_occurred_at column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS cm_occurred_at TIMESTAMP;

-- Update task_type constraint to allow: 'PM', 'Planned CM', 'Unplanned CM'
-- First, drop the existing constraint if it exists (PostgreSQL doesn't have a direct way to modify CHECK constraints)
-- We'll use a trigger or application-level validation instead
-- For now, we'll just add the column and let the application handle validation

-- Add comment to document the new field
COMMENT ON COLUMN tasks.cm_occurred_at IS 'Timestamp when the CM issue occurred (for Unplanned CM tasks only)';

-- Update any existing 'CM' tasks to 'Planned CM' to maintain backward compatibility
UPDATE tasks 
SET task_type = 'Planned CM' 
WHERE task_type = 'CM';
