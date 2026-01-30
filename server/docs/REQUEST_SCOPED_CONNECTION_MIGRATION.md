# Request-Scoped Connection Migration Guide

## Overview

The multi-tenant system now uses **request-scoped connections** with connection-level PostgreSQL session variables. This ensures Row-Level Security (RLS) policies automatically filter data by organization without requiring manual transaction wrapping.

## How It Works

1. **Tenant Context Middleware** (`server/middleware/tenantContext.js`):
   - Acquires a database connection at the start of each request
   - Sets `app.current_organization_id` and `app.current_user_id` session variables
   - Attaches the connection to `req.db`
   - Releases the connection when the response finishes

2. **Routes** use `getDb(req, pool)` helper:
   - Returns `req.db` if available (has tenant context)
   - Falls back to `pool` if `req.db` is not set
   - All queries through `req.db` automatically respect RLS policies

## Migration Steps

### Step 1: Import the Helper

Add to the top of your route file:

```javascript
const { getDb } = require('../middleware/tenantContext');
```

### Step 2: Replace `pool.query()` with `getDb(req, pool).query()`

**Before:**
```javascript
const result = await pool.query('SELECT * FROM assets', []);
```

**After:**
```javascript
const db = getDb(req, pool);
const result = await db.query('SELECT * FROM assets', []);
```

Or inline:
```javascript
const result = await getDb(req, pool).query('SELECT * FROM assets', []);
```

### Step 3: For Transactions

If you're using transactions, use `req.db` directly:

```javascript
const client = req.db || await pool.connect();
try {
  await client.query('BEGIN');
  // ... your queries ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  if (!req.db) {
    client.release();
  }
}
```

**Note:** If using `req.db`, don't release it manually - the middleware handles that.

## Example: Assets Route

```javascript
const express = require('express');
const { getDb } = require('../middleware/tenantContext');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const db = getDb(req, pool);
      const result = await db.query('SELECT * FROM assets ORDER BY asset_code');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { asset_code, asset_name, asset_type } = req.body;
      const organizationId = req.tenantContext?.organizationId || null;
      
      const db = getDb(req, pool);
      const result = await db.query(
        'INSERT INTO assets (asset_code, asset_name, asset_type, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [asset_code, asset_name, asset_type, organizationId]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating asset:', error);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });

  return router;
};
```

## Benefits

✅ **Automatic RLS**: All queries automatically respect organization boundaries  
✅ **No Transaction Wrapping**: No need to wrap queries in transactions  
✅ **Gradual Migration**: Routes can migrate one at a time  
✅ **Backward Compatible**: Falls back to `pool` if `req.db` is not set  
✅ **Connection Pooling**: Connections are properly released after each request  

## Routes Already Migrated

- ✅ `server/routes/assets.js`
- ✅ `server/routes/tasks.js` (GET /)
- ✅ `server/routes/inventory.js` (GET /items)

## Routes Pending Migration

- ⏳ `server/routes/tasks.js` (other endpoints)
- ⏳ `server/routes/users.js`
- ⏳ `server/routes/plant.js`
- ⏳ `server/routes/checklistResponses.js`
- ⏳ `server/routes/feedback.js`
- ⏳ Other route files

## Testing

After migrating a route, test that:
1. Users from Organization A only see Organization A's data
2. Users from Organization B only see Organization B's data
3. System owners (no organization) see all data
4. No connection leaks occur (check server logs)

## Troubleshooting

### Issue: RLS not filtering correctly

**Solution:** Ensure `req.db` is being used, not `pool` directly. Check that the tenant context middleware is applied before your route handler.

### Issue: Connection not released

**Solution:** Don't manually release `req.db` - the middleware handles that automatically. Only release connections you acquire yourself with `pool.connect()`.

### Issue: Session variables not set

**Solution:** Verify the tenant context middleware is applied in `server/index.js` before your routes:

```javascript
app.use('/api/assets', licenseCheck, tenantContextMiddleware, assetsRoutes(pool));
```

## Next Steps

1. Migrate routes one at a time, starting with the most critical
2. Test each route after migration
3. Monitor server logs for connection pool issues
4. Update this document as routes are migrated
