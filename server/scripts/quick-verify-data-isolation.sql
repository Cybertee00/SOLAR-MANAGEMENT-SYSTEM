-- Quick Data Isolation Verification Script
-- Run this in PostgreSQL to verify data isolation

-- Set the Smart Innovations Energy ID
\set sie_id '00000000-0000-0000-0000-000000000001'

-- 1. List all organizations
\echo ''
\echo '=== ORGANIZATIONS ==='
SELECT 
  id, 
  name, 
  slug, 
  is_active,
  created_at
FROM organizations 
ORDER BY created_at ASC;

-- 2. Check data distribution
\echo ''
\echo '=== DATA DISTRIBUTION ==='
WITH org_data AS (
  SELECT 
    o.id,
    o.name,
    o.slug,
    (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND (role != 'system_owner' OR role IS NULL)) as user_count,
    (SELECT COUNT(*) FROM assets WHERE organization_id = o.id) as asset_count,
    (SELECT COUNT(*) FROM tasks WHERE organization_id = o.id) as task_count,
    (SELECT COUNT(*) FROM checklist_templates WHERE organization_id = o.id) as template_count
  FROM organizations o
  WHERE o.is_active = true
)
SELECT 
  name,
  slug,
  user_count,
  asset_count,
  task_count,
  template_count,
  (user_count + asset_count + task_count + template_count) as total_records
FROM org_data
ORDER BY 
  CASE WHEN id = :sie_id::UUID THEN 0 ELSE 1 END,
  name;

-- 3. Check for data in other organizations (should be 0)
\echo ''
\echo '=== VERIFICATION: Other Organizations Should Have Zero Data ==='
DO $$
DECLARE
  sie_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  org_record RECORD;
  table_name TEXT;
  tables_to_check TEXT[] := ARRAY['users', 'assets', 'tasks', 'checklist_templates'];
  record_count INTEGER;
  has_issues BOOLEAN := false;
BEGIN
  FOR org_record IN 
    SELECT id, name, slug FROM organizations 
    WHERE id != sie_id AND is_active = true
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'Organization: % (%)', org_record.name, org_record.slug;
    RAISE NOTICE '----------------------------------------';
    
    FOREACH table_name IN ARRAY tables_to_check LOOP
      BEGIN
        EXECUTE format('
          SELECT COUNT(*) 
          FROM %I 
          WHERE organization_id = $1
        ', table_name) INTO record_count USING org_record.id;
        
        IF record_count > 0 THEN
          RAISE WARNING '  ⚠️  %: % records found (SHOULD BE 0!)', table_name, record_count;
          has_issues := true;
        ELSE
          RAISE NOTICE '  ✅ %: 0 records', table_name;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⏭️  %: Table or column does not exist', table_name;
      END;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '';
  IF has_issues THEN
    RAISE WARNING '=== VERIFICATION FAILED: Some organizations have data that should not exist ===';
  ELSE
    RAISE NOTICE '=== VERIFICATION PASSED: All other organizations have zero data ===';
  END IF;
END $$;

-- 4. Check Smart Innovations Energy data (should have data)
\echo ''
\echo '=== Smart Innovations Energy Data (Should Have Data) ==='
SELECT 
  'Users' as table_name,
  COUNT(*) as record_count
FROM users 
WHERE organization_id = :sie_id::UUID
  AND (role != 'system_owner' OR role IS NULL)
UNION ALL
SELECT 
  'Assets' as table_name,
  COUNT(*) as record_count
FROM assets 
WHERE organization_id = :sie_id::UUID
UNION ALL
SELECT 
  'Tasks' as table_name,
  COUNT(*) as record_count
FROM tasks 
WHERE organization_id = :sie_id::UUID
UNION ALL
SELECT 
  'Templates' as table_name,
  COUNT(*) as record_count
FROM checklist_templates 
WHERE organization_id = :sie_id::UUID
ORDER BY table_name;

\echo ''
\echo '=== VERIFICATION COMPLETE ==='
\echo 'Expected: Smart Innovations Energy should have data, all other organizations should have 0 data'
