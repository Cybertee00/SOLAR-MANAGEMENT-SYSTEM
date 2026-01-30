# Users Data Isolation - Permanent Solution

## Overview
This document describes the permanent, universal user filtering implementation that ensures system owners see only the selected company's users, or system owners only when no company is selected.

## Implementation Details

### 1. User Filtering Logic

**File:** `server/routes/users.js`

**Problem:** System owners were seeing all users regardless of selected company.

**Solution:**
```javascript
// Get organization ID from request context
const { isSystemOwnerWithoutCompany, getOrganizationIdFromRequest } = require('../utils/organizationFilter');
const organizationId = getOrganizationIdFromRequest(req);

// System owners without a selected company should only see system owners
if (isSystemOwnerWithoutCompany(req)) {
  // Return only system owners
  // ...
}

// System owner with company selected: Show company users + system owners
if (isSystemOwner && organizationId) {
  query = `
    SELECT ... FROM users u
    WHERE u.organization_id = $1
       OR u.id IN (SELECT ... WHERE role_code = 'system_owner')
       OR u.role = 'system_owner' OR u.role = 'super_admin'
  `;
  result = await db.query(query, [organizationId]);
}
```

**Key Points:**
- ✅ If `organizationId` exists → Show company users + system owners
- ✅ If no `organizationId` → Show only system owners
- ✅ Uses `getDb()` for RLS (Row-Level Security)
- ✅ Explicit `organization_id` filtering as backup

### 2. Query Structure

**For System Owner with Company Selected:**
```sql
SELECT ... FROM users u
WHERE u.organization_id = $1  -- Company users
   OR u.id IN (SELECT ... WHERE role_code = 'system_owner')  -- System owners
   OR u.role = 'system_owner' OR u.role = 'super_admin'  -- Legacy system owners
```

**For System Owner without Company:**
```sql
SELECT ... FROM users u
WHERE u.id IN (SELECT ... WHERE role_code = 'system_owner')
   OR u.role = 'system_owner' OR u.role = 'super_admin'
```

**For Regular Admin (Operations Administrator):**
```sql
SELECT ... FROM users u
WHERE u.organization_id = $1  -- Only their company's users
  AND u.id NOT IN (SELECT ... WHERE role_code = 'system_owner')  -- Exclude system owners
  AND (u.role != 'system_owner' AND u.role != 'super_admin')
```

### 3. RBAC Support

The implementation supports both:
- **RBAC System**: Uses `user_roles` and `roles` tables
- **Legacy System**: Uses `users.role` and `users.roles` columns

Both systems filter by `organization_id` when a company is selected.

## Expected Behavior

### Scenario 1: System Owner without Company Selected
- **Shows:** Only system owners (users with `system_owner` or `super_admin` role)
- **Hides:** All company users

### Scenario 2: System Owner with Company Selected
- **Shows:** 
  - All users from selected company (`organization_id = selected_company_id`)
  - All system owners (regardless of organization)
- **Hides:** Users from other companies

### Scenario 3: Regular Admin (Operations Administrator)
- **Shows:** Only users from their assigned organization
- **Hides:** System owners and users from other companies

### Scenario 4: Company with No Users
- **Shows:** Only system owners (company has no users, so only system owners visible)

## Database Schema

**users table:**
- `organization_id` UUID - Links user to organization
- `role` VARCHAR - Legacy role field
- `roles` JSONB - Array of role codes (RBAC)

**user_roles table (RBAC):**
- `user_id` UUID - References users.id
- `role_id` UUID - References roles.id

**roles table (RBAC):**
- `role_code` VARCHAR - Role identifier (e.g., 'system_owner', 'technician')

## Maintenance Guidelines

### ⚠️ DO NOT:
- ❌ Remove `organization_id` filtering when company is selected
- ❌ Show all users to system owners without filtering
- ❌ Use `pool.query()` directly (must use `getDb()` for RLS)
- ❌ Remove system owner visibility logic

### ✅ DO:
- ✅ Always filter by `organization_id` when company is selected
- ✅ Show system owners in addition to company users
- ✅ Use `getDb()` for all queries (enables RLS)
- ✅ Handle both RBAC and legacy role systems
- ✅ Return only system owners when no company selected

## Testing Checklist

When making changes, verify:
- [ ] System owner without company → sees only system owners
- [ ] System owner with company → sees company users + system owners
- [ ] System owner with company (no users) → sees only system owners
- [ ] Regular admin → sees only their company's users (no system owners)
- [ ] No cross-company user leakage

## Breaking Change Prevention

### Protected Elements:
1. **Organization Filtering**: Must filter by `organization_id` when company selected
2. **System Owner Visibility**: System owners should always be visible to system owners
3. **Query Execution**: Must use `getDb()` (not `pool.query()`)
4. **No Company State**: Must return only system owners

### Safe to Modify:
- Role mapping logic
- User display format
- Additional user fields

## Related Files

- `server/routes/users.js` - User listing and management
- `server/utils/organizationFilter.js` - Organization context utilities
- `server/middleware/tenantContext.js` - RLS middleware

## Last Updated
2026-01-26 - Permanent user filtering implementation
