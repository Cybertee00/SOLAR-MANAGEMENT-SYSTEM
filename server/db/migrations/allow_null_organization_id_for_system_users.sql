-- Migration: Allow NULL organization_id for system users (system_owner/creator)
-- This allows platform-level users (like the creator) to create tracker status requests
-- without being associated with a tenant organization

-- Make organization_id nullable in tracker_status_requests
-- System users (system_owner) don't belong to tenant organizations
ALTER TABLE tracker_status_requests 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Add index for organization_id (including NULL values for system users)
CREATE INDEX IF NOT EXISTS idx_tracker_status_requests_organization_id 
  ON tracker_status_requests(organization_id) 
  WHERE organization_id IS NOT NULL;

-- Add comment explaining the nullable organization_id
COMMENT ON COLUMN tracker_status_requests.organization_id IS 
  'Organization ID for tenant users. NULL for system-level users (system_owner/creator) who are not part of any tenant organization.';
