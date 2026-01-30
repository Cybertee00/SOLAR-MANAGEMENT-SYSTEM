# Platform Access Control Testing Guide

This document outlines comprehensive test cases for verifying the platform architecture access control implementation.

## Test Prerequisites

1. **Test Users Required:**
   - System Owner (system_owner role)
   - Regular User (belongs to an organization)
   - Admin User (belongs to an organization)

2. **Test Organizations:**
   - At least 2 organizations in the database
   - One organization should be "Smart Innovations Energy" (default)

3. **Test Data:**
   - Each organization should have:
     - At least 1 user
     - At least 1 asset
     - At least 1 task

## Test Cases

### 1. Platform Routes Access Control

#### Test 1.1: System Owner Can Access Platform Dashboard
- **Steps:**
  1. Login as system owner
  2. Navigate to `/platform/dashboard`
- **Expected Result:**
  - ✅ Platform Dashboard loads successfully
  - ✅ Shows system-wide statistics (all organizations)
  - ✅ Lists all organizations
  - ✅ No company abbreviation badge in header

#### Test 1.2: Regular User Cannot Access Platform Dashboard
- **Steps:**
  1. Login as regular user
  2. Navigate to `/platform/dashboard`
- **Expected Result:**
  - ✅ Redirected to `/tenant/dashboard` or shown 403 error
  - ✅ Cannot see platform dashboard

#### Test 1.3: Platform API Endpoints - System Owner Access
- **Steps:**
  1. Login as system owner
  2. Make API calls to:
     - `GET /api/platform/stats`
     - `GET /api/platform/organizations`
     - `GET /api/platform/users`
- **Expected Result:**
  - ✅ All endpoints return data
  - ✅ Data includes ALL organizations/users/assets (no filtering)
  - ✅ Response status: 200

#### Test 1.4: Platform API Endpoints - Regular User Access
- **Steps:**
  1. Login as regular user
  2. Make API calls to:
     - `GET /api/platform/stats`
     - `GET /api/platform/organizations`
- **Expected Result:**
  - ✅ Returns 403 Forbidden
  - ✅ Error message indicates system owner access required

### 2. Tenant Routes Access Control

#### Test 2.1: Regular User Can Access Tenant Dashboard
- **Steps:**
  1. Login as regular user
  2. Navigate to `/tenant/dashboard`
- **Expected Result:**
  - ✅ Tenant Dashboard loads successfully
  - ✅ Shows only their organization's data
  - ✅ Company abbreviation badge shows in header
  - ✅ Cannot see other organizations' data

#### Test 2.2: System Owner Can Access Tenant Dashboard (Without Entering Company)
- **Steps:**
  1. Login as system owner
  2. Navigate to `/tenant/dashboard` directly (without entering a company)
- **Expected Result:**
  - ✅ Dashboard loads but shows no data (or error)
  - ✅ No organization context set
  - ✅ No company abbreviation badge

#### Test 2.3: Tenant API Endpoints - Regular User
- **Steps:**
  1. Login as regular user (Organization A)
  2. Make API calls to:
     - `GET /api/tasks`
     - `GET /api/assets`
     - `GET /api/inventory`
- **Expected Result:**
  - ✅ All endpoints return data
  - ✅ Data is filtered to only Organization A's data
  - ✅ Cannot see Organization B's data

#### Test 2.4: Tenant API Endpoints - Cross-Organization Access Prevention
- **Steps:**
  1. Login as regular user (Organization A)
  2. Try to access Organization B's data:
     - `GET /api/tasks` (should only return Org A tasks)
     - `GET /api/assets` (should only return Org A assets)
- **Expected Result:**
  - ✅ Only Organization A's data is returned
  - ✅ Organization B's data is not visible
  - ✅ RLS policies are working correctly

### 3. Enter Company Functionality

#### Test 3.1: System Owner Enters Company
- **Steps:**
  1. Login as system owner
  2. Navigate to `/platform/dashboard`
  3. Click "Enter Company" for an organization
- **Expected Result:**
  - ✅ API call to `POST /api/organizations/:id/enter` succeeds
  - ✅ Navigates to `/tenant/dashboard`
  - ✅ Company abbreviation badge appears in header
  - ✅ Shows only that organization's data
  - ✅ "Exit Company" button appears in header

#### Test 3.2: System Owner Views Company Data
- **Steps:**
  1. Login as system owner
  2. Enter Company A
  3. Navigate to various tenant routes:
     - `/tenant/tasks`
     - `/tenant/inventory`
     - `/tenant/assets`
- **Expected Result:**
  - ✅ All routes show only Company A's data
  - ✅ Cannot see Company B's data
  - ✅ RLS filtering is active
  - ✅ Company abbreviation badge persists

#### Test 3.3: System Owner Exits Company
- **Steps:**
  1. Login as system owner
  2. Enter a company
  3. Click "Exit Company" button
- **Expected Result:**
  - ✅ API call to `POST /api/organizations/exit` succeeds
  - ✅ Navigates to `/platform/dashboard`
  - ✅ Company abbreviation badge disappears
  - ✅ "Exit Company" button disappears
  - ✅ Can see all organizations again

#### Test 3.4: Enter Inactive Company
- **Steps:**
  1. Login as system owner
  2. Try to enter an inactive organization
- **Expected Result:**
  - ✅ API returns 400 Bad Request
  - ✅ Error message: "Cannot enter inactive organization"
  - ✅ Does not navigate to tenant dashboard

### 4. Data Isolation (RLS)

#### Test 4.1: RLS Filtering for Regular Users
- **Steps:**
  1. Create two users: User A (Org A), User B (Org B)
  2. Create tasks/assets for each organization
  3. Login as User A
  4. Query tasks/assets
- **Expected Result:**
  - ✅ User A only sees Org A's data
  - ✅ User A cannot see Org B's data
  - ✅ Database RLS policies are enforcing isolation

#### Test 4.2: RLS Filtering for System Owner in Tenant Mode
- **Steps:**
  1. Login as system owner
  2. Enter Company A
  3. Query tasks/assets
  4. Exit company
  5. Enter Company B
  6. Query tasks/assets
- **Expected Result:**
  - ✅ In Company A: Only sees Company A's data
  - ✅ In Company B: Only sees Company B's data
  - ✅ Data isolation is maintained

#### Test 4.3: Application-Level Filtering for Platform Routes
- **Steps:**
  1. Login as system owner
  2. Access platform routes:
     - `GET /api/platform/stats`
     - `GET /api/platform/organizations`
- **Expected Result:**
  - ✅ Returns data from ALL organizations
  - ✅ No RLS filtering applied
  - ✅ Application-level filtering bypasses RLS

### 5. Navigation and Routing

#### Test 5.1: Default Route Redirect - System Owner
- **Steps:**
  1. Login as system owner
  2. Navigate to `/`
- **Expected Result:**
  - ✅ Redirects to `/platform/dashboard`
  - ✅ Platform dashboard loads

#### Test 5.2: Default Route Redirect - Regular User
- **Steps:**
  1. Login as regular user
  2. Navigate to `/`
- **Expected Result:**
  - ✅ Redirects to `/tenant/dashboard`
  - ✅ Tenant dashboard loads

#### Test 5.3: Backward Compatibility Routes
- **Steps:**
  1. Login as any user
  2. Navigate to old routes:
     - `/dashboard`
     - `/tasks`
     - `/inventory`
- **Expected Result:**
  - ✅ All routes redirect to `/tenant/*` equivalents
  - ✅ No broken links
  - ✅ Navigation works smoothly

### 6. Header Display

#### Test 6.1: Company Abbreviation - System Owner in Tenant Mode
- **Steps:**
  1. Login as system owner
  2. Enter "Smart Innovations Energy"
  3. Check header
- **Expected Result:**
  - ✅ Shows "[SIE]" badge before title
  - ✅ Badge is styled correctly (blue background, white text)
  - ✅ "Exit Company" button visible

#### Test 6.2: Company Abbreviation - Regular User
- **Steps:**
  1. Login as regular user
  2. Navigate to any tenant route
  3. Check header
- **Expected Result:**
  - ✅ Shows company abbreviation badge
  - ✅ Badge shows correct abbreviation
  - ✅ No "Exit Company" button (not a system owner)

#### Test 6.3: No Abbreviation on Platform Routes
- **Steps:**
  1. Login as system owner
  2. Navigate to `/platform/dashboard`
  3. Check header
- **Expected Result:**
  - ✅ No company abbreviation badge
  - ✅ Only shows "{ABBREVIATION} O&M System" title (e.g., "SIE O&M System")

### 7. Session Management

#### Test 7.1: Selected Organization Persists Across Requests
- **Steps:**
  1. Login as system owner
  2. Enter a company
  3. Make multiple API requests
  4. Refresh page
- **Expected Result:**
  - ✅ Selected organization persists in session
  - ✅ Company context maintained across requests
  - ✅ After refresh, still in tenant mode with same company

#### Test 7.2: Session Cleared on Exit
- **Steps:**
  1. Login as system owner
  2. Enter a company
  3. Exit company
  4. Make API request
- **Expected Result:**
  - ✅ Selected organization cleared from session
  - ✅ Returns to platform mode
  - ✅ No organization context in requests

### 8. Edge Cases

#### Test 8.1: Invalid Organization ID
- **Steps:**
  1. Login as system owner
  2. Try to enter non-existent organization
- **Expected Result:**
  - ✅ Returns 404 Not Found
  - ✅ Error message indicates organization not found
  - ✅ Does not set invalid organization in session

#### Test 8.2: Multiple Tabs - Same User
- **Steps:**
  1. Login as system owner in Tab 1
  2. Enter Company A in Tab 1
  3. Open Tab 2 (same browser)
  4. Check Tab 2 state
- **Expected Result:**
  - ✅ Tab 2 should reflect Tab 1's state (session shared)
  - ✅ Or Tab 2 starts at platform dashboard (depending on implementation)

#### Test 8.3: Direct URL Access
- **Steps:**
  1. Login as system owner
  2. Directly navigate to `/tenant/dashboard` (without entering company)
- **Expected Result:**
  - ✅ Either redirects to platform dashboard
  - ✅ Or shows empty/no data state
  - ✅ No errors or crashes

## Automated Testing Script

A Node.js script can be created to automate these tests. Key areas to test:

1. **API Endpoint Testing:**
   - Test platform endpoints with system owner credentials
   - Test platform endpoints with regular user credentials (should fail)
   - Test tenant endpoints with regular user (should succeed, filtered)
   - Test tenant endpoints with system owner (should succeed, filtered by selected org)

2. **Database Query Testing:**
   - Verify RLS policies are active
   - Verify session variables are set correctly
   - Verify data isolation between organizations

3. **Session Testing:**
   - Verify selected organization is stored in session
   - Verify session persists across requests
   - Verify session is cleared on exit

## Manual Testing Checklist

- [ ] System owner can access platform dashboard
- [ ] Regular user cannot access platform dashboard
- [ ] System owner can enter a company
- [ ] System owner sees only entered company's data
- [ ] System owner can exit company
- [ ] Regular user sees only their organization's data
- [ ] Company abbreviation shows correctly in header
- [ ] Navigation works correctly
- [ ] Backward compatibility routes redirect properly
- [ ] RLS filtering works for all tenant routes
- [ ] Application-level filtering works for platform routes
- [ ] Session management works correctly
- [ ] Edge cases handled gracefully

## Notes

- All tests should be performed in a test environment
- Ensure test data is isolated from production data
- Document any issues found during testing
- Update this document with test results
