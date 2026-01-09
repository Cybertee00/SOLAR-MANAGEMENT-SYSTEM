-- Add profile_image column to users table
-- This stores the filename/path of the user's profile image

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);

-- Add index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_profile_image ON users(profile_image) WHERE profile_image IS NOT NULL;
