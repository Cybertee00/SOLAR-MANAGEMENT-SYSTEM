# Organization Management UI - Access Guide

## Access Control Summary

### Who Can Access?
- **System Owners Only** (`system_owner` role)
- The API routes already enforce this restriction

### Current Access Pattern

Based on the existing codebase:

1. **Routes**: Protected with `<ProtectedRoute requireAdmin={true}>` wrapper
2. **Navigation**: Admin links shown conditionally using `isAdmin()` or `isSuperAdmin()` checks
3. **API**: Backend enforces system owner access

## Access Flow

### 1. User Authentication
- User logs in with `system_owner` role
- Session contains user roles/permissions
- `AuthContext` provides `isSuperAdmin()` helper

### 2. Navigation Visibility
- Header component checks `isSuperAdmin()` or `hasRole('system_owner')`
- Shows "Organizations" link only to system owners
- Similar to how "Users" and "License" links are shown to admins

### 3. Route Protection
- Routes protected with `<ProtectedRoute requireAdmin={true}>`
- Or custom check: `hasRole('system_owner')`

### 4. API Access
- Backend checks: `req.session.roles?.includes('system_owner') || req.session.role === 'system_owner'`
- Returns 403 if not system owner

## Implementation Steps

### Step 1: Add Routes to App.js
```javascript
// Import components
import OrganizationManagement from './components/OrganizationManagement';
import OrganizationSettings from './components/OrganizationSettings';
import OrganizationFeatures from './components/OrganizationFeatures';
import OrganizationBranding from './components/OrganizationBranding';

// Add routes (system owner only)
<Route 
  path="/organizations" 
  element={
    <ProtectedRoute requireAdmin={true}>
      <OrganizationManagement />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/organizations/:id/settings" 
  element={
    <ProtectedRoute requireAdmin={true}>
      <OrganizationSettings />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/organizations/:id/features" 
  element={
    <ProtectedRoute requireAdmin={true}>
      <OrganizationFeatures />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/organizations/:id/branding" 
  element={
    <ProtectedRoute requireAdmin={true}>
      <OrganizationBranding />
    </ProtectedRoute>
  } 
/>
```

### Step 2: Add Navigation Link in Header
```javascript
// In Header component, add after License link:
{isSuperAdmin() && (
  <Link to="/organizations" className={location.pathname.startsWith('/organizations') ? 'active' : ''}>
    Organizations
  </Link>
)}
```

### Step 3: Update ProtectedRoute (Optional)
If you want stricter system_owner-only access:
```javascript
// In ProtectedRoute component, add:
const isSystemOwner = hasRole('system_owner');
if (requireSystemOwner && !isSystemOwner) {
  return <Navigate to="/" />;
}
```

## Access URLs

Once implemented, system owners can access:

1. **Organization List**: `/organizations`
   - Lists all organizations
   - Create/Edit/Deactivate organizations

2. **Organization Settings**: `/organizations/:id/settings`
   - Manage key-value settings
   - Add/Edit/Delete settings

3. **Organization Features**: `/organizations/:id/features`
   - Manage feature flags
   - Enable/Disable features

4. **Organization Branding**: `/organizations/:id/branding`
   - White-labeling configuration
   - Logo, colors, custom domain

## Testing Access

### Test as System Owner:
1. Login with `system_owner` role
2. Should see "Organizations" link in header
3. Can access `/organizations` route
4. Can create/edit organizations
5. Can access settings/features/branding pages

### Test as Regular Admin:
1. Login with `operations_admin` or `admin` role
2. Should NOT see "Organizations" link
3. Direct URL access should redirect or show 403
4. API calls should return 403 Forbidden

## Current Status

✅ **API Routes**: Created and protected  
✅ **UI Components**: Created  
⏳ **Routes**: Need to add to App.js  
⏳ **Navigation**: Need to add to Header  
⏳ **Testing**: Need to test access control  

## Next Steps

1. Add routes to `App.js`
2. Add navigation link to `Header` component
3. Test with system_owner user
4. Test with regular admin user (should be blocked)
5. Verify API access control
