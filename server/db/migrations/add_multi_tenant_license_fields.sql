-- Migration: Add multi-tenant and advanced license fields
-- This migration enhances the licenses table for:
-- - Multi-tenant support (company_id)
-- - License tiers and features
-- - Revocation mechanism
-- - Signed token support

-- Add company_id for multi-tenant support (nullable initially for backward compatibility)
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS company_id UUID;
-- Note: Foreign key will be added after companies table exists in multi-tenant migration
-- ALTER TABLE licenses ADD CONSTRAINT fk_licenses_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Add license token field (full signed token)
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_token TEXT;
-- Note: license_token can store the full signed token for offline validation

-- Add license tier (small/medium/large/enterprise)
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_tier VARCHAR(50) DEFAULT 'small';

-- Add license type (trial/subscription/perpetual)
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'subscription';

-- Add check constraints (only if they don't exist)
DO $$ 
BEGIN
  -- Add license_tier constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_license_tier'
  ) THEN
    ALTER TABLE licenses ADD CONSTRAINT chk_license_tier 
      CHECK (license_tier IN ('small', 'medium', 'large', 'enterprise'));
  END IF;

  -- Add license_type constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_license_type'
  ) THEN
    ALTER TABLE licenses ADD CONSTRAINT chk_license_type
      CHECK (license_type IN ('trial', 'subscription', 'perpetual'));
  END IF;
END $$;

-- Add features JSONB field for feature flags
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- Add revocation support
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT false;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- Add issued_at timestamp (separate from activated_at)
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP;

-- Add metadata JSONB for additional license data
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing licenses with default values
UPDATE licenses SET 
  license_tier = COALESCE(license_tier, 'small'),
  license_type = COALESCE(license_type, 'subscription'),
  features = COALESCE(features, '[]'::jsonb),
  is_revoked = COALESCE(is_revoked, false),
  metadata = COALESCE(metadata, '{}'::jsonb)
WHERE license_tier IS NULL OR license_type IS NULL OR features IS NULL OR is_revoked IS NULL OR metadata IS NULL;

-- Set issued_at from created_at if not set
UPDATE licenses SET issued_at = created_at WHERE issued_at IS NULL;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_licenses_company_id ON licenses(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_license_tier ON licenses(license_tier);
CREATE INDEX IF NOT EXISTS idx_licenses_license_type ON licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_licenses_is_revoked ON licenses(is_revoked) WHERE is_revoked = true;
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at_is_active ON licenses(expires_at, is_active);

-- Add comments
COMMENT ON COLUMN licenses.company_id IS 'Company ID for multi-tenant support. NULL for single-company deployments.';
COMMENT ON COLUMN licenses.license_token IS 'Full signed license token (JWT-style). Used for offline validation.';
COMMENT ON COLUMN licenses.license_tier IS 'License tier: small, medium, large, or enterprise';
COMMENT ON COLUMN licenses.license_type IS 'License type: trial, subscription, or perpetual';
COMMENT ON COLUMN licenses.features IS 'JSONB array of enabled feature codes (e.g., ["white_labeling", "api_access"])';
COMMENT ON COLUMN licenses.is_revoked IS 'Whether the license has been revoked';
COMMENT ON COLUMN licenses.revoked_at IS 'Timestamp when license was revoked';
COMMENT ON COLUMN licenses.revoked_reason IS 'Reason for license revocation';
COMMENT ON COLUMN licenses.issued_at IS 'Timestamp when license was originally issued/generated';
COMMENT ON COLUMN licenses.metadata IS 'Additional license metadata (JSONB)';
