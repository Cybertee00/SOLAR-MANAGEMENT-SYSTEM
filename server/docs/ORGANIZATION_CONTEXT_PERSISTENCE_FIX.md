# Organization Context Persistence Fix

## Problem Statement

When users refreshed the page, all data disappeared except for Plant and Notifications pages. This occurred because the `/me` endpoint (used to restore user session on page refresh) was not returning organization information (`organization_id`, `organization_name`, `organization_slug`), causing frontend components to incorrectly determine that the user had no organization context.

## Root Cause

1. **Login endpoint** (`POST /api/auth/login`) correctly fetches and returns organization information for regular users.
2. **Session check endpoint** (`GET /api/auth/me`) did NOT fetch or return organization information.
3. On page refresh, `AuthContext.checkAuth()` calls `/me` endpoint, which returns user data without organization info.
4. Frontend components use `hasOrganizationContext(user)` utility to check if user has organization context:
   - For regular users: checks `user.organization_id`
   - For system owners: checks `sessionStorage` for selected organization
5. Since `user.organization_id` was `undefined` after refresh, `hasOrganizationContext()` returned `false` for regular users.
6. Components with organization context checks (Dashboard, Tasks, Inventory, Calendar, Templates, CM Letters) would not load data.

## Solution

### Backend Fix: `/me` Endpoint (`server/routes/auth.js`)

Updated the `/me` endpoint to fetch and return organization information for regular users, matching the behavior of the login endpoint:

```javascript
// Load organization info for regular users (not system owners)
let organizationInfo = null;
const isSystemOwnerUser = userRoles.includes('system_owner') || 
                          user.role === 'system_owner' ||
                          userRoles.includes('super_admin') ||
                          user.role === 'super_admin';

if (!isSystemOwnerUser && user.organization_id) {
  try {
    const orgResult = await pool.query(
      `SELECT id, name, slug FROM organizations WHERE id = $1 AND is_active = true`,
      [user.organization_id]
    );
    if (orgResult.rows.length > 0) {
      organizationInfo = {
        id: orgResult.rows[0].id,
        name: orgResult.rows[0].name,
        slug: orgResult.rows[0].slug
      };
    }
  } catch (orgError) {
    logger.warn('Error loading organization info in /me endpoint', { error: orgError.message });
    // Continue without organization info - not critical
  }
}

// Response includes organization info
res.json({
  user: {
    // ... other user fields ...
    organization_id: user.organization_id || null,
    organization_name: organizationInfo?.name || null,
    organization_slug: organizationInfo?.slug || null
  }
});
```

### Frontend Fix: Component Organization Context Checks

Added organization context checks to components that were missing them:

1. **ChecklistTemplates.js**: Added `hasOrganizationContext` check before loading templates.
2. **CMLetters.js**: Added `hasOrganizationContext` check before loading CM letters.

These components now follow the same pattern as Dashboard, Tasks, Inventory, Calendar, and Plant:

```javascript
useEffect(() => {
  // Only load data if user has organization context
  if (hasOrganizationContext(user)) {
    loadData();
  } else {
    // System owner without company: show empty data
    setData([]);
    setLoading(false);
  }
}, [user]);
```

## How It Works

### For Regular Users

1. User logs in → Login endpoint returns `organization_id`, `organization_name`, `organization_slug`.
2. User refreshes page → `/me` endpoint now also returns organization info.
3. `hasOrganizationContext(user)` checks `user.organization_id` → returns `true`.
4. Components load data correctly.

### For System Owners

1. System owner logs in → Login endpoint returns `organization_id: null` (system owners don't have organizations).
2. System owner selects a company → `sessionStorage` stores `selectedOrganizationId` and `selectedOrganizationSlug`.
3. System owner refreshes page → `/me` endpoint returns `organization_id: null`.
4. `hasOrganizationContext(user)` checks `sessionStorage` → returns `true` if company is selected.
5. Components load data for selected company.

## Files Modified

### Backend
- `server/routes/auth.js`: Updated `/me` endpoint to fetch and return organization info.

### Frontend
- `client/src/components/ChecklistTemplates.js`: Added organization context check.
- `client/src/components/CMLetters.js`: Added organization context check.

## Testing

### Test Case 1: Regular User Refresh
1. Log in as a regular user (e.g., "John Technician" from Smart Innovations Energy).
2. Navigate to Dashboard → verify data loads (tasks, stats, logo).
3. Refresh the page (F5).
4. **Expected**: All data persists, dashboard shows same information.
5. Navigate to Tasks, Inventory, Calendar, Templates, CM Letters → verify data loads.
6. Refresh each page → verify data persists.

### Test Case 2: System Owner Without Company
1. Log in as system owner.
2. Navigate to Dashboard → verify empty dashboard (no data).
3. Refresh the page → verify still empty.
4. Navigate to Tasks, Inventory, etc. → verify empty data.

### Test Case 3: System Owner With Selected Company
1. Log in as system owner.
2. Select a company from Platform Dashboard.
3. Navigate to Dashboard → verify company data loads.
4. Refresh the page → verify data persists.
5. Navigate to other pages → verify data persists after refresh.

## Prevention of Regressions

### Critical Rules

1. **Always return organization info in `/me` endpoint**: The `/me` endpoint MUST return `organization_id`, `organization_name`, and `organization_slug` for regular users, matching the login endpoint behavior.

2. **Always check organization context in components**: All components that load company-specific data MUST check `hasOrganizationContext(user)` before loading data.

3. **Never rely solely on sessionStorage for regular users**: Regular users' organization context comes from `user.organization_id` in the user object, not from `sessionStorage`.

4. **Test page refresh**: Always test that data persists after page refresh for both regular users and system owners.

### Code Review Checklist

When reviewing code that affects user authentication or organization context:

- [ ] Does `/me` endpoint return organization info for regular users?
- [ ] Do components check `hasOrganizationContext(user)` before loading data?
- [ ] Are there any components loading company-specific data without organization context checks?
- [ ] Has page refresh been tested for regular users?
- [ ] Has page refresh been tested for system owners (with and without selected company)?

### Related Documentation

- `USER_ORGANIZATION_CONTEXT_IMPLEMENTATION.md`: Full implementation details for user organization context.
- `DATA_FILTERING_AND_COLORS_IMPLEMENTATION.md`: Data isolation and filtering implementation.
- `client/src/utils/organizationContext.js`: Frontend utility functions for organization context.

## Date Implemented

January 26, 2026

## Status

✅ **FIXED** - Organization context now persists correctly on page refresh for both regular users and system owners.
