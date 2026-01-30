-- Migration: Allow NULL organization_id for system users in notifications table
-- This allows platform-level users (like the creator/system_owner) to receive notifications
-- without being associated with a tenant organization

-- Make organization_id nullable in notifications
-- System users (system_owner) don't belong to tenant organizations
ALTER TABLE notifications 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Add index for organization_id (including NULL values for system users)
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id 
  ON notifications(organization_id) 
  WHERE organization_id IS NOT NULL;

-- Add comment explaining the nullable organization_id
COMMENT ON COLUMN notifications.organization_id IS 
  'Organization ID for tenant users. NULL for system-level users (system_owner/creator) who are not part of any tenant organization.';
