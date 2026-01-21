-- Migration: Add feedback_submissions table
-- Stores user feedback, bug reports, feature requests, etc.

CREATE TABLE IF NOT EXISTS feedback_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(50) NOT NULL CHECK (subject IN ('bug', 'feature', 'question', 'improvement', 'other')),
    message TEXT NOT NULL,
    page_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_submissions(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_subject ON feedback_submissions(subject);

-- Add comment for documentation
COMMENT ON TABLE feedback_submissions IS 'Stores user feedback submissions including bug reports, feature requests, and general inquiries';
COMMENT ON COLUMN feedback_submissions.status IS 'Status: new, reviewed, in_progress, resolved, closed';
