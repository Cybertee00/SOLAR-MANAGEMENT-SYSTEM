-- Migration: Drop licenses table
-- This migration removes the licenses table and all related objects
-- License functionality has been completely removed from the application

-- Drop indexes first
DROP INDEX IF EXISTS idx_licenses_license_key;
DROP INDEX IF EXISTS idx_licenses_expires_at;
DROP INDEX IF EXISTS idx_licenses_is_active;
DROP INDEX IF EXISTS idx_licenses_company_id;
DROP INDEX IF EXISTS idx_licenses_license_tier;
DROP INDEX IF EXISTS idx_licenses_license_type;
DROP INDEX IF EXISTS idx_licenses_is_revoked;
DROP INDEX IF EXISTS idx_licenses_expires_at_is_active;

-- Drop constraints if they exist
ALTER TABLE IF EXISTS licenses DROP CONSTRAINT IF EXISTS chk_license_tier;
ALTER TABLE IF EXISTS licenses DROP CONSTRAINT IF EXISTS chk_license_type;
ALTER TABLE IF EXISTS licenses DROP CONSTRAINT IF EXISTS fk_licenses_company_id;

-- Drop the table
DROP TABLE IF EXISTS licenses CASCADE;

-- Note: COMMENT ON TABLE cannot be used with IF EXISTS, so we skip it if table doesn't exist
-- The table is already dropped, so no comment is needed
