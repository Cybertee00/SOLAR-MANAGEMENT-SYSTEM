-- Add password_changed column to track if user has changed their default password
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false;

-- Set password_changed to true for existing users (they've already set their passwords)
UPDATE users SET password_changed = true WHERE password_changed IS NULL OR password_changed = false;

-- Make sure the default is false for new users
ALTER TABLE users ALTER COLUMN password_changed SET DEFAULT false;
