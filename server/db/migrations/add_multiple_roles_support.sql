-- Migration: Add support for multiple roles per user
-- Changes role from VARCHAR to JSONB array to support multiple roles

-- Step 1: Add new column for multiple roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '["technician"]'::jsonb;

-- Step 2: Migrate existing role data to roles array
-- Convert single role to array format
UPDATE users 
SET roles = jsonb_build_array(role)
WHERE roles IS NULL OR roles = '[]'::jsonb;

-- Step 3: Create index for efficient role queries
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN (roles);

-- Step 4: Add constraint to ensure roles is always an array
ALTER TABLE users ADD CONSTRAINT check_roles_is_array 
  CHECK (jsonb_typeof(roles) = 'array');

-- Step 5: Keep the old 'role' column for backward compatibility during migration
-- We'll deprecate it later, but keep it for now to avoid breaking existing code
-- The application will use 'roles' (array) going forward

-- Note: The 'role' column will remain but should be considered deprecated
-- New code should use the 'roles' JSONB array instead
