/**
 * Tenant Query Helper
 * Wraps database queries with tenant context for RLS
 * Sets PostgreSQL session variables before executing queries
 */

/**
 * Execute a query with tenant context
 * Wraps query in a transaction and sets RLS session variables
 * @param {Object} pool - Database connection pool
 * @param {Object} tenantContext - Tenant context from req.tenantContext
 * @param {Function} queryFn - Function that receives a client and executes queries
 * @returns {Promise} Query result
 */
async function executeWithTenantContext(pool, tenantContext, queryFn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Set session variables for RLS
    // Note: SET LOCAL doesn't support parameterized queries, so we use string interpolation
    // The values are UUIDs from our own system, so this is safe
    const orgId = tenantContext && tenantContext.organizationId 
      ? tenantContext.organizationId 
      : '';
    const userId = tenantContext && tenantContext.userId 
      ? tenantContext.userId 
      : '';
    
    await client.query(`SET LOCAL app.current_organization_id = '${orgId}'`);
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    
    // Execute the query function
    const result = await queryFn(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a simple query with tenant context
 * @param {Object} pool - Database connection pool
 * @param {Object} tenantContext - Tenant context from req.tenantContext
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
async function queryWithTenantContext(pool, tenantContext, query, params = []) {
  return executeWithTenantContext(pool, tenantContext, async (client) => {
    return await client.query(query, params);
  });
}

module.exports = {
  executeWithTenantContext,
  queryWithTenantContext
};
