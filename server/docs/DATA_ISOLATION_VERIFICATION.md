# Data Isolation Verification Guide

## Overview

This document provides instructions for verifying that data isolation is working correctly across organizations. **All data should belong to Smart Innovations Energy**, and other organizations should have **zero data**.

## Quick Verification

### Step 1: Check Organizations

Run this SQL query to see all organizations:

```sql
SELECT 
  id, 
  name, 
  slug, 
  is_active,
  created_at
FROM organizations 
ORDER BY created_at ASC;
```

**Expected Result:**
- Smart Innovations Energy (ID: `00000000-0000-0000-0000-000000000001`) should exist
- Other organizations (if any) should have NO data

### Step 2: Verify Data Distribution

Run this SQL query to check data distribution across organizations:

```sql
-- Check data distribution for key tables
WITH org_data AS (
  SELECT 
    o.id,
    o.name,
    o.slug,
    (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND role != 'system_owner') as user_count,
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
  CASE WHEN id = '00000000-0000-0000-0000-000000000001' THEN 0 ELSE 1 END,
  name;
```

**Expected Result:**
- **Smart Innovations Energy**: Should have all the data (users, assets, tasks, templates)
- **All other organizations**: Should show `0` for all counts

### Step 3: Detailed Table-by-Table Check

Run this comprehensive check:

```sql
-- Detailed verification: Check each table for data belonging to other organizations
DO $$
DECLARE
  sie_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  org_record RECORD;
  table_name TEXT;
  tables_to_check TEXT[] := ARRAY['users', 'assets', 'tasks', 'checklist_templates', 'tracker_status_requests', 'notifications', 'plant_map_structure'];
  total_other_orgs INTEGER := 0;
BEGIN
  RAISE NOTICE '=== DATA ISOLATION VERIFICATION ===';
  RAISE NOTICE '';
  
  -- Get all organizations except Smart Innovations Energy
  FOR org_record IN 
    SELECT id, name, slug FROM organizations 
    WHERE id != sie_id AND is_active = true
  LOOP
    RAISE NOTICE 'Organization: % (%)', org_record.name, org_record.slug;
    RAISE NOTICE '----------------------------------------';
    
    FOREACH table_name IN ARRAY tables_to_check LOOP
      BEGIN
        EXECUTE format('
          SELECT COUNT(*) 
          FROM %I 
          WHERE organization_id = $1
        ', table_name) INTO total_other_orgs USING org_record.id;
        
        IF total_other_orgs > 0 THEN
          RAISE WARNING '  ⚠️  %: % records found (SHOULD BE 0!)', table_name, total_other_orgs;
        ELSE
          RAISE NOTICE '  ✅ %: 0 records', table_name;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⏭️  %: Table or column does not exist', table_name;
      END;
    END LOOP;
    
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '=== VERIFICATION COMPLETE ===';
END $$;
```

## Testing via API

### Test 1: Platform View (System Owner)

1. **Login as system owner**
2. **Access Platform Dashboard**: `/platform/dashboard`
3. **Check Organization Stats**: Should see all organizations listed
4. **Verify**: Other organizations should show `0` users, `0` assets, `0` tasks

### Test 2: Enter Other Organization

1. **From Platform Dashboard**, click "Enter Company" for a non-SIE organization
2. **Access Tenant Dashboard**: `/tenant/dashboard`
3. **Check Data**:
   - Assets: Should be empty (`/api/tenant/assets`)
   - Tasks: Should be empty (`/api/tenant/tasks`)
   - Templates: Should be empty (`/api/tenant/templates`)
   - Users: Should be empty (except possibly system owner)

**Expected Result**: All endpoints should return empty arrays or zero counts.

### Test 3: Enter Smart Innovations Energy

1. **From Platform Dashboard**, click "Enter Company" for Smart Innovations Energy
2. **Access Tenant Dashboard**: `/tenant/dashboard`
3. **Check Data**: Should see all existing data (assets, tasks, templates, users)

**Expected Result**: Should see all the data that was migrated to Smart Innovations Energy.

## Automated Verification Script

Run the verification script:

```bash
node server/scripts/verify-data-isolation.js
```

**Note**: This script requires database credentials. Make sure your `.env` file has correct database connection settings.

## Common Issues

### Issue 1: Other Organizations Have Data

**Symptom**: When entering other organizations, you see data that should belong to Smart Innovations Energy.

**Cause**: Data migration (`multi_tenant_007`) may not have run, or some records have incorrect `organization_id`.

**Fix**: 
1. Check if migration `multi_tenant_007` ran successfully
2. Run the migration again if needed
3. Manually verify and fix any records with incorrect `organization_id`

### Issue 2: NULL organization_id Records

**Symptom**: Some records have `NULL` organization_id.

**Cause**: Records created before multi-tenant migration, or system users (system_owner) which are allowed to have NULL.

**Fix**:
- For non-user tables: Update NULL records to Smart Innovations Energy
- For users table: NULL is OK for `system_owner` role, but regular users should have an organization_id

### Issue 3: RLS Not Working

**Symptom**: Users can see data from other organizations.

**Cause**: RLS policies not enabled, or tenant context middleware not setting session variables correctly.

**Fix**:
1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
2. Check tenant context middleware is running
3. Verify session variables are set: Check `app.current_organization_id` in PostgreSQL logs

## Verification Checklist

- [ ] All organizations listed in Platform Dashboard
- [ ] Smart Innovations Energy has all data
- [ ] Other organizations show `0` counts in Platform Dashboard
- [ ] Entering other organizations shows empty dashboards
- [ ] Entering Smart Innovations Energy shows all data
- [ ] RLS policies are enabled on all tenant tables
- [ ] No data leakage between organizations
- [ ] System owner can switch between organizations without seeing wrong data

## Summary

**Expected State:**
- ✅ Smart Innovations Energy: Has ALL data
- ✅ All other organizations: Have ZERO data
- ✅ RLS policies: Active and filtering correctly
- ✅ Tenant context: Working correctly for system owners

If any of these are not true, refer to the "Common Issues" section above.
