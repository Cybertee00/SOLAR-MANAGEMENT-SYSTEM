# Migration Strategy - Senior Developer Recommendation

## Executive Summary

**Recommended Approach**: **Gradual, prioritized migration** with automated testing and monitoring.

**Timeline**: 2-3 weeks for complete migration
**Risk Level**: Low (backward compatible, can rollback per route)

---

## Phase 1: Critical Routes First (Week 1)

### Priority 1: High-Traffic, High-Risk Routes

These routes handle the most critical operations and should be migrated first:

1. **`server/routes/tasks.js`** ⚠️ **HIGH PRIORITY**
   - Most frequently used route
   - Handles task creation, updates, assignments
   - Already partially migrated (GET `/`)
   - **Action**: Complete migration of all endpoints

2. **`server/routes/users.js`** ⚠️ **HIGH PRIORITY**
   - User management and authentication
   - Security-critical
   - **Action**: Migrate all endpoints

3. **`server/routes/checklistResponses.js`** ⚠️ **HIGH PRIORITY**
   - Core business logic
   - Data integrity critical
   - **Action**: Migrate all endpoints

### Priority 2: Data-Heavy Routes

4. **`server/routes/plant.js`**
   - Plant management operations
   - Complex queries
   - **Action**: Migrate systematically

5. **`server/routes/inventory.js`**
   - Already partially migrated (GET `/items`)
   - **Action**: Complete migration

---

## Phase 2: Supporting Routes (Week 2)

6. **`server/routes/feedback.js`**
7. **`server/routes/overtimeRequests.js`**
8. **`server/routes/cmLetters.js`**
9. **`server/routes/checklistTemplates.js`**
10. **`server/routes/apiTokens.js`**
11. **`server/routes/webhooks.js`**
12. **`server/routes/upload.js`**

---

## Migration Process Per Route

### Step 1: Pre-Migration Checklist
- [ ] Review route file for all `pool.query()` calls
- [ ] Identify transaction usage
- [ ] Check for connection pooling patterns
- [ ] Document any special cases

### Step 2: Migration
```javascript
// 1. Add import
const { getDb } = require('../middleware/tenantContext');

// 2. Replace pool.query() with getDb(req, pool).query()
// 3. Handle transactions (use req.db directly)
// 4. Ensure organization_id is set on INSERTs
```

### Step 3: Testing Checklist
- [ ] Unit test: Route works with `req.db`
- [ ] Integration test: User from Org A only sees Org A data
- [ ] Integration test: User from Org B only sees Org B data
- [ ] Integration test: System owner sees all data
- [ ] Performance test: No significant latency increase
- [ ] Connection test: No connection leaks

### Step 4: Deployment
- [ ] Deploy to staging
- [ ] Monitor for 24 hours
- [ ] Check connection pool metrics
- [ ] Deploy to production
- [ ] Monitor for 48 hours

---

## Testing Strategy

### Automated Testing

**Create test suite**: `server/tests/integration/tenant-isolation.test.js`

```javascript
describe('Tenant Isolation', () => {
  it('should isolate data between organizations', async () => {
    // Create org1, org2, users, test data
    // Login as org1 user
    // Verify only org1 data visible
    // Login as org2 user
    // Verify only org2 data visible
  });
  
  it('should allow system owners to see all data', async () => {
    // Login as system_owner
    // Verify all data visible
  });
});
```

**Run before each migration:**
```bash
npm run test:tenant-isolation
```

### Manual Testing Checklist

For each migrated route:

1. **Setup**:
   - Create 2 test organizations (Org A, Org B)
   - Create users in each organization
   - Create test data for each organization

2. **Test as Org A User**:
   - Login as Org A user
   - Access route endpoint
   - Verify only Org A data appears
   - Verify Org B data is NOT visible

3. **Test as Org B User**:
   - Login as Org B user
   - Access route endpoint
   - Verify only Org B data appears
   - Verify Org A data is NOT visible

4. **Test as System Owner**:
   - Login as system_owner
   - Access route endpoint
   - Verify ALL data appears (both Org A and Org B)

---

## Monitoring Strategy

### 1. Connection Pool Monitoring

**Add to `server/index.js`**:

```javascript
// Monitor connection pool every 5 minutes
setInterval(() => {
  const poolStats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
  
  logger.info('[POOL] Connection pool stats', poolStats);
  
  // Alert if pool is exhausted
  if (pool.totalCount >= pool.max) {
    logger.warn('[POOL] Connection pool near capacity!', poolStats);
  }
  
  // Alert if many waiting connections
  if (pool.waitingCount > 5) {
    logger.warn('[POOL] Many connections waiting!', poolStats);
  }
}, 5 * 60 * 1000);
```

### 2. Request-Level Monitoring

**Add middleware to track connection usage**:

```javascript
// server/middleware/connectionMonitor.js
function connectionMonitor(req, res, next) {
  const startTime = Date.now();
  const originalEnd = res.end.bind(res);
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    if (req.db) {
      logger.debug('[CONNECTION] Request used req.db', {
        path: req.path,
        method: req.method,
        duration,
        userId: req.session?.userId
      });
    }
    
    return originalEnd.apply(this, args);
  };
  
  next();
}
```

### 3. Database-Level Monitoring

**Query to check for connection leaks**:

```sql
-- Check active connections
SELECT 
  count(*) as total_connections,
  state,
  application_name
FROM pg_stat_activity
WHERE datname = 'solar_om_db'
GROUP BY state, application_name;

-- Check for long-running queries (potential leaks)
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE datname = 'solar_om_db'
  AND state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 minutes';
```

### 4. Logging

**Add structured logging**:

```javascript
// In tenantContext middleware
logger.info('[TENANT] Connection acquired', {
  userId: userId,
  organizationId: organizationId || 'system',
  connectionId: client.processID
});

// On connection release
logger.debug('[TENANT] Connection released', {
  userId: userId,
  duration: Date.now() - connectionStartTime
});
```

---

## Risk Mitigation

### Rollback Plan

**Per-Route Rollback**:
- If a route has issues, revert that specific route file
- Keep `getDb()` calls but change back to `pool` temporarily
- No need to rollback entire system

**Full Rollback** (if needed):
- Revert `server/middleware/tenantContext.js` to previous version
- All routes fall back to `pool` automatically
- No data migration needed

### Gradual Rollout

1. **Week 1**: Migrate Priority 1 routes, monitor closely
2. **Week 2**: Migrate Priority 2 routes if Week 1 successful
3. **Week 3**: Complete remaining routes

### Feature Flags (Optional)

If you want extra safety:

```javascript
// server/config/features.js
module.exports = {
  USE_REQUEST_SCOPED_CONNECTIONS: process.env.USE_RSC === 'true'
};

// In routes
const db = process.env.USE_RSC === 'true' 
  ? getDb(req, pool) 
  : pool;
```

---

## Success Metrics

### Week 1 Goals
- ✅ Priority 1 routes migrated
- ✅ Zero connection leaks detected
- ✅ All tests passing
- ✅ No performance degradation

### Week 2 Goals
- ✅ Priority 2 routes migrated
- ✅ Connection pool utilization < 70%
- ✅ Average request latency unchanged
- ✅ Zero data isolation issues reported

### Week 3 Goals
- ✅ All routes migrated
- ✅ Full test coverage
- ✅ Documentation updated
- ✅ Team trained on new pattern

---

## Tools & Scripts Needed

### 1. Migration Helper Script

**`server/scripts/migrate-route.js`**:
- Scans route file for `pool.query()` calls
- Suggests replacements
- Validates migration

### 2. Connection Leak Detector

**`server/scripts/check-connection-leaks.js`**:
- Monitors connection pool
- Alerts on leaks
- Generates report

### 3. Tenant Isolation Test Runner

**`server/scripts/test-tenant-isolation.js`**:
- Automated test suite
- Tests all migrated routes
- Generates coverage report

---

## Recommended Timeline

| Week | Focus | Routes | Testing |
|------|-------|--------|---------|
| **Week 1** | Critical Routes | tasks.js, users.js, checklistResponses.js | Full test suite |
| **Week 2** | Data Routes | plant.js, inventory.js (complete) | Integration tests |
| **Week 3** | Supporting Routes | All remaining routes | Smoke tests |

---

## Final Recommendation

**Start with `tasks.js`** - it's the most critical and already partially migrated.

**Process**:
1. Complete `tasks.js` migration (2-3 hours)
2. Test thoroughly (1-2 hours)
3. Deploy to staging, monitor for 24 hours
4. If successful, proceed to `users.js`
5. Repeat process

**Monitoring**:
- Set up connection pool monitoring immediately
- Check logs daily for first week
- Review metrics weekly

**Team Communication**:
- Document migration progress in shared doc
- Update team on any issues found
- Share learnings and best practices

---

**Next Action**: Begin with `tasks.js` complete migration.
