-- Migration: Create platform_updates table
-- This table tracks all platform updates for audit and rollback purposes

CREATE TABLE IF NOT EXISTS platform_updates (
    id VARCHAR(255) PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    update_type VARCHAR(50) NOT NULL DEFAULT 'patch', -- patch, minor, major, rollback
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
    initiated_by VARCHAR(255), -- IP address or service identifier
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    log_file VARCHAR(500), -- Path to update log file
    rollback_from VARCHAR(50), -- Previous version (for rollbacks)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_platform_updates_status ON platform_updates(status);
CREATE INDEX IF NOT EXISTS idx_platform_updates_initiated_at ON platform_updates(initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_updates_version ON platform_updates(version);

-- Add comments for documentation
COMMENT ON TABLE platform_updates IS 'Tracks all platform updates for audit and rollback purposes';
COMMENT ON COLUMN platform_updates.id IS 'Unique identifier for the update operation';
COMMENT ON COLUMN platform_updates.version IS 'Version being deployed';
COMMENT ON COLUMN platform_updates.update_type IS 'Type of update: patch, minor, major, or rollback';
COMMENT ON COLUMN platform_updates.status IS 'Current status of the update';
COMMENT ON COLUMN platform_updates.initiated_by IS 'IP address or service identifier that initiated the update';
COMMENT ON COLUMN platform_updates.log_file IS 'Path to the log file containing update details';
