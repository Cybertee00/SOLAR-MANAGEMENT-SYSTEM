-- ============================================
-- Migration: Standardize organization_id NULL Handling
-- ============================================
-- Description: Ensures consistent NULL handling for organization_id across tables
-- Impact: System users can have NULL organization_id, tenant users must have one
-- Safe: Yes - only adds constraints and helper functions
-- Created: 2026-02-06

-- Ensure key tables allow NULL for system records
-- ===============================================

-- Users table - NULL allowed for system_owner
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

-- Notifications table - NULL allowed for system notifications
ALTER TABLE notifications ALTER COLUMN organization_id DROP NOT NULL;

-- Add CHECK constraint to ensure NULL is only for system users
-- =============================================================

-- Drop existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_system_check;

-- Add constraint: organization_id must be set unless user is system_owner
ALTER TABLE users ADD CONSTRAINT users_org_id_system_check
  CHECK (
    organization_id IS NOT NULL
    OR (role = 'system_owner' OR roles::text LIKE '%system_owner%')
  );

COMMENT ON CONSTRAINT users_org_id_system_check ON users IS
  'Ensures organization_id is NULL only for system owner users';

-- Create helper function for consistent org filtering
-- ====================================================

CREATE OR REPLACE FUNCTION is_system_record(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN org_id IS NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_system_record IS
  'Returns true if organization_id is NULL (system record)';

-- Add indexes that handle NULL efficiently
-- =========================================

-- Users table - NULL values sorted last
CREATE INDEX IF NOT EXISTS idx_users_org_id_nulls_last
  ON users(organization_id NULLS LAST);

COMMENT ON INDEX idx_users_org_id_nulls_last IS
  'Efficiently handles queries with NULL organization_id (system users)';

-- Assets table - NULL values sorted last
CREATE INDEX IF NOT EXISTS idx_assets_org_id_nulls_last
  ON assets(organization_id NULLS LAST)
  WHERE organization_id IS NULL;

-- Tasks table - NULL values sorted last
CREATE INDEX IF NOT EXISTS idx_tasks_org_id_nulls_last
  ON tasks(organization_id NULLS LAST)
  WHERE organization_id IS NULL;

-- Notifications table - NULL values sorted last
CREATE INDEX IF NOT EXISTS idx_notifications_org_id_nulls_last
  ON notifications(organization_id NULLS LAST)
  WHERE organization_id IS NULL;

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE 'organization_id NULL handling standardized';
  RAISE NOTICE 'System users can now have NULL organization_id';
  RAISE NOTICE 'Helper function is_system_record() created';
  RAISE NOTICE 'Indexes optimized for NULL handling';
END $$;
