# User Organization Assignment Implementation

## Overview
This document describes the implementation of mandatory organization assignment for users to prevent data leakage in the multi-tenant SaaS platform.

## Problem Statement
Users without an `organization_id` could potentially access data from all companies, causing severe data leakage. This implementation ensures:
1. **All new users** are automatically assigned to an organization when created
2. **Existing users** are assigned to organizations based on their data associations
3. **System owners** (platform-level users) correctly have `organization_id = NULL`
4. **Regular users** must belong to an organization

## Backend Changes

### 1. User Creation Route (`server/routes/users.js`)

**Key Changes:**
- Added `organization_id` handling in the `POST /users` route
- **System owners creating users:**
  - Must provide `organization_id` when creating non-system-owner users
  - `organization_id` is optional (and ignored) when creating system_owner users
  - Validates that the organization exists and is active
- **Regular admins creating users:**
  - `organization_id` is automatically set from their organization context
  - Cannot create system_owner users
- Uses `getDb(req, pool)` for RLS-aware database queries

**Code Location:** Lines 496-679

### 2. User Update Route (`server/routes/users.js`)

**Key Changes:**
- Added `organization_id` update support
- Only system owners can change a user's organization
- Validates organization exists and is active
- Prevents assigning system owners to organizations
- Prevents removing organization from non-system-owner users

**Code Location:** Lines 684-860

### 3. Input Validation (`server/middleware/inputValidation.js`)

**Key Changes:**
- Added `organization_id` to `removeUnexpectedFields` for both create and update
- Added optional UUID validation for `organization_id` field

**Code Location:** Lines 239-271 (create), 276-311 (update)

### 4. Database Migration (`server/db/migrations/assign_existing_users_to_organizations.sql`)

**Purpose:** Assigns existing users to organizations based on data associations

**Strategy:**
1. **Users with tasks:** Assign to organization of their most recent/most common task
2. **Users with assets:** Assign to organization of their created/updated assets
3. **Users with checklist templates:** Assign to organization of their templates
4. **Users with CM letters:** Assign to organization of their CM letters
5. **Remaining users:** Assign to Smart Innovations Energy (default organization)
6. **System owners:** Ensure they have `organization_id = NULL`

**Safety Features:**
- Only updates users with `organization_id IS NULL`
- Preserves system owners (sets their `organization_id` to NULL)
- Reports migration results

## Frontend Changes

### 1. UserManagement Component (`client/src/components/UserManagement.js`)

**Key Changes:**
- Added `availableOrganizations` state
- Added `loadOrganizations()` function (fetches from `/platform/organizations`)
- Added `organization_id` to `formData` state
- **Organization dropdown:**
  - Shown only for system owners
  - Required when creating non-system-owner users
  - Disabled for system owner users (shows "Platform Level")
  - Shows organization name and slug
- **Form submission:**
  - System owners: Must provide `organization_id` (unless creating system owner)
  - Regular admins: `organization_id` is omitted (backend assigns automatically)

**Code Location:** Throughout component, especially:
- State initialization (lines 20-27)
- `loadOrganizations()` function (lines 58-68)
- Form rendering (organization dropdown after password field)
- Form submission logic (lines 98-147)

## Data Flow

### Creating a User (System Owner)
```
1. System owner selects organization from dropdown
2. Frontend sends: { username, email, full_name, roles, organization_id }
3. Backend validates organization exists and is active
4. Backend creates user with organization_id
5. User can only access data from their organization
```

### Creating a User (Regular Admin)
```
1. Regular admin fills form (no organization dropdown shown)
2. Frontend sends: { username, email, full_name, roles } (no organization_id)
3. Backend gets organization_id from req.tenantContext
4. Backend creates user with organization_id from admin's context
5. User automatically belongs to admin's organization
```

### Updating User Organization
```
1. System owner edits user and changes organization
2. Frontend sends: { organization_id: new_org_id }
3. Backend validates:
   - User is system owner (can change org)
   - Organization exists and is active
   - User is not a system owner (can't assign system owner to org)
4. Backend updates user.organization_id
5. User now sees data from new organization
```

## Security Considerations

1. **Data Isolation:** Users can only see data from their `organization_id` due to RLS and explicit filters
2. **Role-Based Access:** Only system owners can change user organizations
3. **Validation:** Organization existence and active status are validated before assignment
4. **System Owner Protection:** System owners cannot be assigned to organizations (they're platform-level)

## Migration Instructions

1. **Run the migration script:**
   ```bash
   psql -U your_user -d your_database -f server/db/migrations/assign_existing_users_to_organizations.sql
   ```

2. **Verify results:**
   - Check migration output for statistics
   - Verify all non-system-owner users have `organization_id`
   - Verify all system owners have `organization_id IS NULL`

3. **Manual Review:**
   - Review users assigned to default organization (Smart Innovations Energy)
   - Reassign users to correct organizations if needed

## Testing Checklist

- [ ] System owner can create user with organization selection
- [ ] System owner cannot create user without organization (non-system-owner)
- [ ] Regular admin creates user (organization auto-assigned)
- [ ] Regular admin cannot change user organization
- [ ] System owner can change user organization
- [ ] System owner cannot assign system owner to organization
- [ ] Users see only their organization's data
- [ ] Migration script assigns existing users correctly
- [ ] System owners have `organization_id = NULL` after migration

## Future Enhancements

1. **Bulk Organization Assignment:** Allow system owners to bulk-assign users to organizations
2. **Organization Transfer:** Allow transferring users between organizations with data migration
3. **Audit Logging:** Log organization changes for compliance
4. **Organization Validation:** Add UI to validate user-organization assignments
