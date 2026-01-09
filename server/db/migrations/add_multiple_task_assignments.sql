-- Migration: Add support for multiple users per task
-- This creates a junction table for many-to-many relationship between tasks and users

-- Create task_assignments junction table
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(task_id, user_id) -- Prevent duplicate assignments
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON task_assignments(user_id);

-- Migrate existing single assignments to the new table
-- This preserves existing task assignments
INSERT INTO task_assignments (task_id, user_id, assigned_at)
SELECT id, assigned_to, assigned_at
FROM tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Note: We keep the assigned_to column for backward compatibility
-- It will store the primary assignee (first user in the list)
-- The new task_assignments table is the source of truth for all assignments
