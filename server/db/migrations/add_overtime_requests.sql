-- Migration: Add overtime requests table
-- Tracks requests for working outside normal hours (07:00-16:00)

CREATE TABLE IF NOT EXISTS overtime_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL, -- 'start_after_hours', 'complete_after_hours'
    request_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_overtime_requests_task_id ON overtime_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_requested_by ON overtime_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_created_at ON overtime_requests(created_at);
