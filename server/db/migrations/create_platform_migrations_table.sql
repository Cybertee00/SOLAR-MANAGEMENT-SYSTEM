-- Migration: Create platform_migrations table
-- Tracks which migrations have been applied to prevent duplicate execution

CREATE TABLE IF NOT EXISTS platform_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(255)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_platform_migrations_name ON platform_migrations(name);
CREATE INDEX IF NOT EXISTS idx_platform_migrations_applied_at ON platform_migrations(applied_at DESC);

-- Add comments for documentation
COMMENT ON TABLE platform_migrations IS 'Tracks which database migrations have been applied';
COMMENT ON COLUMN platform_migrations.name IS 'Name of the migration file';
COMMENT ON COLUMN platform_migrations.applied_at IS 'When the migration was applied';
COMMENT ON COLUMN platform_migrations.applied_by IS 'Who or what applied the migration (optional)';
