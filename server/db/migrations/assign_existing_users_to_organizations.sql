-- Migration: Assign Existing Users to Organizations
-- CRITICAL: This prevents data leakage by ensuring all users belong to an organization
-- Users without organization_id cannot access company-specific data

-- Step 0: Make organization_id nullable (if it's currently NOT NULL)
-- This allows system owners to have NULL organization_id
DO $$
BEGIN
  -- Check if column has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
      AND column_name = 'organization_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;
    RAISE NOTICE 'Made organization_id nullable';
  END IF;
END $$;

-- Step 1: Assign users based on their existing data associations
-- Strategy: Find the most common organization_id from their tasks/assets/etc.

-- Update users who have tasks - assign to the organization of their most recent task
UPDATE users u
SET organization_id = (
  SELECT t.organization_id
  FROM tasks t
  WHERE t.assigned_to = u.id
     OR EXISTS (
       SELECT 1 FROM task_assignments ta
       WHERE ta.user_id = u.id AND ta.task_id = t.id
     )
  GROUP BY t.organization_id
  ORDER BY COUNT(*) DESC, MAX(t.created_at) DESC
  LIMIT 1
)
WHERE u.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE (t.assigned_to = u.id
       OR EXISTS (
         SELECT 1 FROM task_assignments ta
         WHERE ta.user_id = u.id AND ta.task_id = t.id
       ))
      AND t.organization_id IS NOT NULL
  );

-- Step 2: Assign users who submitted checklist responses - assign to organization of those tasks
UPDATE users u
SET organization_id = (
  SELECT t.organization_id
  FROM checklist_responses cr
  JOIN tasks t ON cr.task_id = t.id
  WHERE cr.submitted_by = u.id
  GROUP BY t.organization_id
  ORDER BY COUNT(*) DESC, MAX(cr.submitted_at) DESC
  LIMIT 1
)
WHERE u.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM checklist_responses cr
    JOIN tasks t ON cr.task_id = t.id
    WHERE cr.submitted_by = u.id
      AND t.organization_id IS NOT NULL
  );

-- Step 3: Assign users who reported CM letters - assign to that organization
UPDATE users u
SET organization_id = (
  SELECT cm.organization_id
  FROM cm_letters cm
  WHERE cm.reported_by = u.id
  GROUP BY cm.organization_id
  ORDER BY COUNT(*) DESC, MAX(cm.created_at) DESC
  LIMIT 1
)
WHERE u.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM cm_letters cm
    WHERE cm.reported_by = u.id
      AND cm.organization_id IS NOT NULL
  );

-- Step 4: Assign remaining users to Smart Innovations Energy (default organization)
-- This is a fallback for users with no data associations
-- Smart Innovations Energy should be the first/default organization
UPDATE users u
SET organization_id = (
  SELECT id FROM organizations 
  WHERE slug = 'smart-innovations-energy' 
     OR name ILIKE '%smart innovations%'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE u.organization_id IS NULL
  AND (u.role != 'system_owner' AND u.role != 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = u.id AND r.role_code = 'system_owner'
  );

-- Step 5: Verify system owners don't have organization_id (they're platform-level)
UPDATE users u
SET organization_id = NULL
WHERE (u.role = 'system_owner' OR u.role = 'super_admin')
   OR EXISTS (
     SELECT 1 FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = u.id AND r.role_code = 'system_owner'
   );

-- Step 7: Add constraint to prevent future users without organization (except system_owner)
-- Note: This constraint will be added via ALTER TABLE, but we'll check if it exists first
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_require_organization_except_system_owner'
  ) THEN
    -- Add check constraint: organization_id is required unless user is system_owner
    -- Note: This is a soft constraint - we'll enforce it at application level
    -- Database constraint would be complex due to RBAC roles
    ALTER TABLE users ADD CONSTRAINT users_require_organization_except_system_owner
    CHECK (
      organization_id IS NOT NULL 
      OR role = 'system_owner' 
      OR role = 'super_admin'
    );
  END IF;
END $$;

-- Step 8: Report results
DO $$
DECLARE
  total_users INTEGER;
  users_with_org INTEGER;
  users_without_org INTEGER;
  system_owners_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO users_with_org FROM users WHERE organization_id IS NOT NULL;
  SELECT COUNT(*) INTO users_without_org FROM users WHERE organization_id IS NULL;
  SELECT COUNT(*) INTO system_owners_count FROM users 
  WHERE (role = 'system_owner' OR role = 'super_admin')
     OR EXISTS (
       SELECT 1 FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = users.id AND r.role_code = 'system_owner'
     );
  
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Users with organization: %', users_with_org;
  RAISE NOTICE '  Users without organization (should be system owners only): %', users_without_org;
  RAISE NOTICE '  System owners (correctly have no organization): %', system_owners_count;
  
  IF users_without_org > system_owners_count THEN
    RAISE WARNING 'WARNING: Some non-system-owner users still lack organization_id!';
  END IF;
END $$;
