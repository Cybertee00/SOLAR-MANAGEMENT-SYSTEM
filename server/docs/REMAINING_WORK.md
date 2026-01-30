# Multi-Tenant Migration - Remaining Work

**Last Updated**: 2026-01-26  
**Status**: Database setup complete ✅ | Route migration in progress ⚠️

---

## ✅ COMPLETED

### Database Foundation
- ✅ **Organizations table** - Created with Smart Innovations Energy as default
- ✅ **All tables have `organization_id`** - Migration `multi_tenant_006` completed
- ✅ **All existing data migrated** - All data assigned to Smart Innovations Energy (Migration `multi_tenant_007`)
- ✅ **RLS policies implemented** - Row-Level Security active on all key tables
- ✅ **Indexes created** - All `organization_id` columns indexed
- ✅ **Tenant context middleware** - Request-scoped connections implemented (`setTenantContext`)
- ✅ **Helper function** - `getDb(req, pool)` available for routes

### Routes Migrated (3/19)
1. ✅ **`server/routes/assets.js`** - **FULLY MIGRATED** (all endpoints use `getDb`)
2. ✅ **`server/routes/tasks.js`** - **PARTIALLY MIGRATED** (only GET `/` endpoint)
3. ✅ **`server/routes/inventory.js`** - **PARTIALLY MIGRATED** (only GET `/items` endpoint)

---

## ⚠️ IN PROGRESS

### Route Migration Status

| Route File | Status | Priority | Endpoints | Notes |
|------------|--------|----------|-----------|-------|
| `tasks.js` | ⚠️ Partial | 🔴 **HIGH** | 1/6 migrated | Most critical route - needs completion |
| `inventory.js` | ⚠️ Partial | 🔴 **HIGH** | 1/11 migrated | GET `/items` done, 10 more to go |
| `users.js` | ❌ Not started | 🔴 **HIGH** | 0/11 | Security-critical |
| `checklistResponses.js` | ❌ Not started | 🔴 **HIGH** | 0/6 | Core business logic |
| `checklistTemplates.js` | ❌ Not started | 🟡 **MEDIUM** | 0/8 | Template management |
| `plant.js` | ❌ Not started | 🟡 **MEDIUM** | 0/7 | Complex queries |
| `cmLetters.js` | ❌ Not started | 🟡 **MEDIUM** | 0/5 | CM letter management |
| `calendar.js` | ❌ Not started | 🟡 **MEDIUM** | 0/6 | Calendar events |
| `notifications.js` | ❌ Not started | 🟡 **MEDIUM** | 0/5 | User notifications |
| `overtimeRequests.js` | ❌ Not started | 🟢 **LOW** | 0/4 | Overtime management |
| `earlyCompletionRequests.js` | ❌ Not started | 🟢 **LOW** | 0/5 | Early completion |
| `auth.js` | ❌ Not started | 🔴 **HIGH** | 0/4 | Authentication |
| `upload.js` | ❌ Not started | 🟡 **MEDIUM** | 0/3 | File uploads |
| `license.js` | ❌ Not started | 🟡 **MEDIUM** | 0/5 | License management |
| `platform.js` | ❌ Not started | 🟢 **LOW** | 0/7 | Platform settings |
| `webhooks.js` | ❌ Not started | 🟢 **LOW** | 0/5 | Webhook management |
| `apiTokens.js` | ❌ Not started | 🟢 **LOW** | 0/3 | API token management |
| `sync.js` | ❌ Not started | 🟢 **LOW** | 0/1 | Sync operations |
| `feedback.js` | ❌ Not started | 🟢 **LOW** | 0/? | Feedback system |

**Total**: 19 route files, ~106+ endpoints  
**Migrated**: 3 files (partial), ~3 endpoints  
**Remaining**: 16 files, ~103+ endpoints

---

## 🔴 CRITICAL NEXT STEPS

### 1. Complete `tasks.js` Migration (HIGHEST PRIORITY)
**Why**: Most frequently used route, already partially migrated  
**Estimated Time**: 2-3 hours

**Endpoints to migrate**:
- [ ] `GET /:id` - Get task by ID
- [ ] `POST /` - Create task (ensure `organization_id` set)
- [ ] `PUT /:id` - Update task
- [ ] `DELETE /:id` - Delete task
- [ ] `POST /:id/assign` - Assign task
- [ ] `POST /:id/complete` - Complete task
- [ ] Other task-related endpoints

**Action Required**:
1. Replace all `pool.query()` with `getDb(req, pool).query()`
2. Ensure `organization_id` is set on INSERTs using `req.tenantContext?.organizationId`
3. Handle transactions using `req.db` directly (not `pool`)
4. Test each endpoint

---

### 2. Migrate `users.js` (HIGH PRIORITY)
**Why**: Security-critical, user management  
**Estimated Time**: 2-3 hours

**Key Considerations**:
- User creation must set `organization_id`
- User queries must respect RLS (already handled)
- System owners can see all users (RLS handles this)

---

### 3. Migrate `checklistResponses.js` (HIGH PRIORITY)
**Why**: Core business logic, data integrity critical  
**Estimated Time**: 2-3 hours

**Key Considerations**:
- Responses must be linked to organization
- RLS will filter automatically once migrated

---

### 4. Complete `inventory.js` Migration
**Why**: Already started, just needs completion  
**Estimated Time**: 1-2 hours

**Remaining Endpoints**:
- [ ] `POST /items` - Create inventory item
- [ ] `PUT /items/:id` - Update inventory item
- [ ] `DELETE /items/:id` - Delete inventory item
- [ ] `GET /transactions` - Get transactions
- [ ] `POST /transactions` - Create transaction
- [ ] `GET /slips` - Get inventory slips
- [ ] `POST /slips` - Create inventory slip
- [ ] Other inventory endpoints

---

## 🟡 MEDIUM PRIORITY

### 5. Migrate Supporting Routes
**Estimated Time**: 1-2 hours each

- `checklistTemplates.js` - Template management
- `plant.js` - Plant management (complex queries)
- `cmLetters.js` - CM letter management
- `calendar.js` - Calendar events
- `notifications.js` - User notifications
- `auth.js` - Authentication (may need special handling)
- `upload.js` - File uploads
- `license.js` - License management

---

## 🟢 LOW PRIORITY

### 6. Migrate Remaining Routes
**Estimated Time**: 30-60 minutes each

- `overtimeRequests.js`
- `earlyCompletionRequests.js`
- `platform.js`
- `webhooks.js`
- `apiTokens.js`
- `sync.js`
- `feedback.js`

---

## 📋 Migration Checklist Per Route

For each route file:

### Step 1: Preparation
- [ ] Review route file for all `pool.query()` calls
- [ ] Count total endpoints
- [ ] Identify transaction usage
- [ ] Check for special connection patterns

### Step 2: Migration
- [ ] Add `const { getDb } = require('../middleware/tenantContext');` at top
- [ ] Replace `pool.query()` with `getDb(req, pool).query()`
- [ ] Replace `pool.connect()` with `req.db` (if available)
- [ ] For transactions: use `req.db` directly (not `pool`)
- [ ] Ensure `organization_id` is set on INSERTs:
  ```javascript
  const organizationId = req.tenantContext?.organizationId;
  // Include in INSERT: organization_id: organizationId
  ```

### Step 3: Testing
- [ ] Test endpoint with regular user (should see only their org data)
- [ ] Test endpoint with system owner (should see all data)
- [ ] Test INSERT operations (verify `organization_id` set)
- [ ] Test UPDATE/DELETE operations (verify RLS works)
- [ ] Check for connection leaks (monitor pool)

### Step 4: Documentation
- [ ] Update this document with migration status
- [ ] Note any special cases or gotchas

---

## 🧪 Testing Strategy

### Manual Testing Per Route

1. **Setup Test Data**:
   ```sql
   -- Create test orgs (if not exists)
   INSERT INTO organizations (id, name, slug) VALUES 
     ('11111111-1111-1111-1111-111111111111', 'Test Org A', 'test-org-a'),
     ('22222222-2222-2222-2222-222222222222', 'Test Org B', 'test-org-b');
   
   -- Create test users
   -- Create test data for each org
   ```

2. **Test as Org A User**:
   - Login as Org A user
   - Access endpoint
   - Verify only Org A data visible
   - Verify Org B data NOT visible

3. **Test as Org B User**:
   - Login as Org B user
   - Access endpoint
   - Verify only Org B data visible
   - Verify Org A data NOT visible

4. **Test as System Owner**:
   - Login as system_owner
   - Access endpoint
   - Verify ALL data visible (both orgs)

---

## 📊 Progress Tracking

### Week 1 Goal
- [ ] Complete `tasks.js` migration
- [ ] Migrate `users.js`
- [ ] Migrate `checklistResponses.js`
- [ ] Complete `inventory.js` migration

### Week 2 Goal
- [ ] Migrate all medium-priority routes
- [ ] Test thoroughly
- [ ] Monitor connection pool

### Week 3 Goal
- [ ] Migrate all remaining routes
- [ ] Full test coverage
- [ ] Documentation complete

---

## 🔍 Monitoring

### Connection Pool Health
Monitor these metrics after each migration:
- Connection pool size
- Active connections
- Idle connections
- Waiting connections
- Connection leaks

### Query Performance
- Average query time
- Slow queries (>100ms)
- Database load

### Data Isolation
- Verify RLS policies working
- Check for cross-tenant data leaks
- Verify system owners can see all data

---

## 📝 Notes

### Special Cases

1. **Transactions**: Always use `req.db` directly for transactions:
   ```javascript
   const client = req.db || await pool.connect();
   try {
     await client.query('BEGIN');
     // ... operations ...
     await client.query('COMMIT');
   } catch (error) {
     await client.query('ROLLBACK');
     throw error;
   } finally {
     if (!req.db) client.release();
   }
   ```

2. **System Owners**: RLS policies automatically allow system owners to see all data. No special handling needed in routes.

3. **INSERT Operations**: Always include `organization_id`:
   ```javascript
   const organizationId = req.tenantContext?.organizationId;
   await db.query(
     'INSERT INTO table (..., organization_id) VALUES (..., $1)',
     [..., organizationId]
   );
   ```

---

## 🎯 Current Focus

**IMMEDIATE NEXT ACTION**: Complete `tasks.js` migration

**Why**: 
- Already partially migrated (GET `/` done)
- Most critical route
- Sets pattern for other routes

**Steps**:
1. Review `tasks.js` file
2. Identify all `pool.query()` calls
3. Replace with `getDb(req, pool).query()`
4. Ensure `organization_id` set on INSERTs
5. Test each endpoint
6. Update this document

---

**Last Updated**: 2026-01-26  
**Next Review**: After `tasks.js` migration complete
