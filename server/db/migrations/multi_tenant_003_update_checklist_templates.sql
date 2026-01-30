-- Migration: Multi-Tenant Step 3 - Update Checklist Templates for Multi-Tenant Support
-- Adds organization_id, is_system_template, and can_be_cloned columns

-- Check if organization_id column exists and handle NOT NULL constraint
DO $$
BEGIN
  -- Add organization_id column if it doesn't exist (NULL = system template, available to all organizations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist_templates' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE checklist_templates 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  ELSE
    -- Column exists, check if it has NOT NULL constraint and drop it
    -- Check column is_nullable
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'checklist_templates' 
        AND column_name = 'organization_id' 
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE checklist_templates ALTER COLUMN organization_id DROP NOT NULL;
    END IF;
  END IF;
END $$;

-- Add is_system_template flag (true = system template, false = organization-specific)
ALTER TABLE checklist_templates 
  ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN DEFAULT false;

-- Add can_be_cloned flag (allows organizations to clone system templates)
ALTER TABLE checklist_templates 
  ADD COLUMN IF NOT EXISTS can_be_cloned BOOLEAN DEFAULT true;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_checklist_templates_organization_id 
  ON checklist_templates(organization_id) 
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_templates_is_system 
  ON checklist_templates(is_system_template) 
  WHERE is_system_template = true;

CREATE INDEX IF NOT EXISTS idx_checklist_templates_org_asset_type 
  ON checklist_templates(organization_id, asset_type) 
  WHERE organization_id IS NOT NULL;

-- Update existing templates to be system templates (if they don't have organization_id)
UPDATE checklist_templates 
SET is_system_template = true, can_be_cloned = true
WHERE organization_id IS NULL;

-- Check for duplicates before creating unique constraints
-- First, handle any existing duplicates by making them system templates
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Count duplicates with same organization_id and template_code
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT organization_id, template_code, COUNT(*)
    FROM checklist_templates
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id, template_code
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % duplicate template_code entries. These will be handled.', dup_count;
    -- Set duplicates to NULL organization_id (system templates) to avoid constraint violation
    UPDATE checklist_templates t1
    SET organization_id = NULL, is_system_template = true
    WHERE EXISTS (
      SELECT 1 FROM checklist_templates t2
      WHERE t2.organization_id = t1.organization_id
        AND t2.template_code = t1.template_code
        AND t2.id < t1.id
    );
  END IF;
END $$;

-- Add unique constraint: template_code must be unique per organization
-- System templates (organization_id IS NULL) can have unique template_code globally
-- Organization templates must have unique template_code within their organization
-- Drop index if exists first
DROP INDEX IF EXISTS idx_checklist_templates_org_code_unique;
CREATE UNIQUE INDEX idx_checklist_templates_org_code_unique 
  ON checklist_templates(organization_id, template_code) 
  WHERE organization_id IS NOT NULL;

-- For system templates (NULL organization_id), ensure template_code is unique
-- Drop index if exists first
DROP INDEX IF EXISTS idx_checklist_templates_system_code_unique;
CREATE UNIQUE INDEX idx_checklist_templates_system_code_unique 
  ON checklist_templates(template_code) 
  WHERE organization_id IS NULL AND is_system_template = true;

-- Add comments
COMMENT ON COLUMN checklist_templates.organization_id IS 
  'Organization ID for tenant-specific templates. NULL = system template available to all organizations.';
COMMENT ON COLUMN checklist_templates.is_system_template IS 
  'True if this is a system template (available to all organizations), false if organization-specific.';
COMMENT ON COLUMN checklist_templates.can_be_cloned IS 
  'True if organizations can clone this template to create their own version.';
