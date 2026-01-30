-- Migration: Allow NULL organization_id for system users in plant_map_structure table
-- This allows platform-level users (like the creator/system_owner) to update plant map structure
-- without being associated with a tenant organization

-- Make organization_id nullable in plant_map_structure
-- System users (system_owner) don't belong to tenant organizations
ALTER TABLE plant_map_structure 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Add index for organization_id (including NULL values for system users)
CREATE INDEX IF NOT EXISTS idx_plant_map_structure_organization_id 
  ON plant_map_structure(organization_id) 
  WHERE organization_id IS NOT NULL;

-- Add comment explaining the nullable organization_id
COMMENT ON COLUMN plant_map_structure.organization_id IS 
  'Organization ID for tenant users. NULL for system-level users (system_owner/creator) who are not part of any tenant organization.';
