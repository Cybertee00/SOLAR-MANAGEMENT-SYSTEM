-- Fix: Update roles column based on existing role column values
-- This ensures existing users keep their original roles instead of all being technicians

-- Update roles based on the role column value
UPDATE users 
SET roles = jsonb_build_array(role)
WHERE role IS NOT NULL 
  AND role != ''
  AND (roles IS NULL OR roles = '["technician"]'::jsonb OR roles = '[]'::jsonb);

-- For users with NULL role, set to technician
UPDATE users 
SET roles = '["technician"]'::jsonb
WHERE role IS NULL 
  AND (roles IS NULL OR roles = '[]'::jsonb);

-- Ensure all users have a valid roles array
UPDATE users 
SET roles = COALESCE(roles, jsonb_build_array(COALESCE(role, 'technician')))
WHERE roles IS NULL;
