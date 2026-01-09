-- Migration: Add hours tracking, budgeted hours, early completion requests, and notifications

-- Add hours tracking fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hours_worked DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS budgeted_hours DECIMAL(10, 2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP; -- When task was assigned
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS can_open_before_scheduled BOOLEAN DEFAULT false; -- For early completion approval

-- Create early completion requests table
CREATE TABLE IF NOT EXISTS early_completion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivation TEXT NOT NULL, -- Reason for early completion
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- task_assigned, task_reminder, task_flagged, early_completion_approved, early_completion_rejected
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- Additional data (e.g., task details, highlight info)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_flagged ON tasks(is_flagged);
CREATE INDEX IF NOT EXISTS idx_early_completion_requests_task_id ON early_completion_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_early_completion_requests_status ON early_completion_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
