# Auth Loading Race Condition Fix

## Critical Bug Identified

When users refreshed the page, all data disappeared because components were checking `hasOrganizationContext(user)` **before** AuthContext finished loading. On page refresh:

1. Components mount → `user` is `null` (AuthContext hasn't loaded yet)
2. `hasOrganizationContext(null)` returns `false`
3. Components set empty data and `loading: false`
4. Later, AuthContext finishes loading and sets `user` with organization info
5. **But components' useEffect already ran, so they don't re-check!**

## Root Cause

Components were not waiting for `authLoading` to complete before checking organization context. The `useEffect` hooks ran immediately when components mounted, but `user` was still `null` at that point.

## Solution

All components that check organization context now wait for `authLoading` to be `false` before checking:

```javascript
const { user, loading: authLoading } = useAuth();

useEffect(() => {
  // Wait for AuthContext to finish loading before checking organization context
  if (authLoading) {
    return; // Don't check until auth is loaded
  }
  
  // Only load data if user has organization context
  if (hasOrganizationContext(user)) {
    loadData();
  } else {
    // System owner without company: show empty data
    setData([]);
    setLoading(false);
  }
}, [user, authLoading]); // Include authLoading in dependencies
```

## Files Fixed

### Frontend Components
1. **Dashboard.js**: Added `authLoading` check before loading dashboard data
2. **Tasks.js**: Added `authLoading` check before loading tasks and templates
3. **Inventory.js**: Added `authLoading` check before loading inventory items
4. **Calendar.js**: Added `authLoading` check before loading calendar events
5. **ChecklistTemplates.js**: Added `authLoading` check before loading templates
6. **CMLetters.js**: Added `authLoading` check before loading CM letters
7. **Plant.js**: Added `authLoading` check before loading plant map structure and site map name

## Notifications Component

**Notifications.js does NOT need this fix** because:
- Notifications are user-specific (filtered by `user_id` in backend)
- Notifications don't require organization context check
- They work correctly without organization context

However, notifications are still organization-scoped at the backend level (users can only receive notifications for tasks/assets in their organization).

## Testing

### Test Case 1: Regular User Refresh
1. Log in as a regular user (e.g., "John Technician" from Smart Innovations Energy)
2. Navigate to Dashboard → verify data loads
3. Refresh the page (F5)
4. **Expected**: All data persists correctly
5. Navigate to Tasks, Inventory, Calendar, Templates, CM Letters, Plant → verify data loads
6. Refresh each page → verify data persists

### Test Case 2: System Owner Without Company
1. Log in as system owner
2. Navigate to Dashboard → verify empty dashboard
3. Refresh the page → verify still empty
4. Navigate to other pages → verify empty data persists after refresh

### Test Case 3: System Owner With Selected Company
1. Log in as system owner
2. Select a company from Platform Dashboard
3. Navigate to Dashboard → verify company data loads
4. Refresh the page → verify data persists
5. Navigate to other pages → verify data persists after refresh

## Prevention of Regressions

### Critical Rules

1. **Always wait for authLoading**: Components that check organization context MUST wait for `authLoading` to be `false` before checking `hasOrganizationContext(user)`.

2. **Include authLoading in dependencies**: The `useEffect` dependency array MUST include `authLoading` to re-run when auth finishes loading.

3. **Pattern to follow**:
   ```javascript
   const { user, loading: authLoading } = useAuth();
   
   useEffect(() => {
     if (authLoading) {
       return; // Don't check until auth is loaded
     }
     
     if (hasOrganizationContext(user)) {
       loadData();
     } else {
       setEmptyData();
     }
   }, [user, authLoading]);
   ```

### Code Review Checklist

When reviewing components that load organization-specific data:

- [ ] Does the component get `loading: authLoading` from `useAuth()`?
- [ ] Does the component check `authLoading` before checking organization context?
- [ ] Is `authLoading` included in the `useEffect` dependency array?
- [ ] Has page refresh been tested for regular users?
- [ ] Has page refresh been tested for system owners (with and without selected company)?

## Related Documentation

- `ORGANIZATION_CONTEXT_PERSISTENCE_FIX.md`: Backend fix for `/me` endpoint to return organization info
- `DATA_FILTERING_AND_COLORS_IMPLEMENTATION.md`: Data isolation and filtering implementation
- `client/src/utils/organizationContext.js`: Frontend utility functions for organization context

## Date Implemented

January 26, 2026

## Status

✅ **FIXED** - Components now wait for AuthContext to finish loading before checking organization context, preventing data loss on page refresh.
