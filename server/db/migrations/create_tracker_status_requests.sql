-- Migration: Create tracker_status_requests table
-- This table stores requests from users to mark trackers as done/halfway for grass cutting or panel wash

CREATE TABLE IF NOT EXISTS tracker_status_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    tracker_ids TEXT[] NOT NULL, -- Array of tracker IDs (e.g., ['M01', 'M02', 'M03'])
    task_type VARCHAR(50) NOT NULL, -- 'grass_cutting' or 'panel_wash'
    status_type VARCHAR(50) NOT NULL, -- 'done' or 'halfway'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    message TEXT, -- Optional message from user
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin/superadmin who reviewed
    reviewed_at TIMESTAMP,
    rejection_reason TEXT, -- Reason if rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracker_status_requests_user_id ON tracker_status_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_status_requests_status ON tracker_status_requests(status);
CREATE INDEX IF NOT EXISTS idx_tracker_status_requests_task_type ON tracker_status_requests(task_type);
CREATE INDEX IF NOT EXISTS idx_tracker_status_requests_reviewed_by ON tracker_status_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_tracker_status_requests_created_at ON tracker_status_requests(created_at);
