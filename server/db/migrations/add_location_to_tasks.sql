-- Migration: Add location column to tasks table
-- This allows tasks to have a location instead of requiring an asset

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Make asset_id nullable to allow tasks without assets
ALTER TABLE tasks ALTER COLUMN asset_id DROP NOT NULL;
