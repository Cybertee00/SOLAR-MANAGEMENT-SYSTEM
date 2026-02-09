/**
 * Organization Context Utilities
 *
 * Provides consistent handling of organization_id across routes
 * Handles both system users (NULL organization_id) and tenant users
 */

/**
 * Get organization context for database queries
 * @param {object} req - Express request object
 * @returns {object} { organizationId, isSystemUser, requiresOrganization }
 */
function getOrganizationContext(req) {
  // Check if user is system owner (can have NULL organization_id)
  const isSystemUser = req.session?.role === 'system_owner' ||
                       (req.session?.roles && Array.isArray(req.session.roles) &&
                        req.session.roles.includes('system_owner'));

  // Get organization_id from tenant context or session
  const organizationId = req.tenantContext?.organizationId ||
                         req.session?.organizationId ||
                         null;

  return {
    // NULL for system users, actual ID for tenant users
    organizationId: isSystemUser ? null : organizationId,

    // Is this a system owner user?
    isSystemUser,

    // Does this request require an organization context?
    requiresOrganization: !isSystemUser && !organizationId
  };
}

/**
 * Validate that request has required organization context
 * Throws error if tenant user doesn't have organization_id
 * @param {object} req - Express request object
 * @throws {Error} If organization context is required but missing
 */
function requireOrganizationContext(req) {
  const context = getOrganizationContext(req);

  if (context.requiresOrganization) {
    throw new Error('Organization context is required for this operation');
  }

  return context;
}

/**
 * Get organization filter for SQL queries
 * Returns NULL for system users (sees all), ID for tenant users
 * @param {object} req - Express request object
 * @returns {string|null} organization_id for WHERE clause
 */
function getOrganizationFilter(req) {
  const { organizationId, isSystemUser } = getOrganizationContext(req);

  // System users see everything (no filter)
  if (isSystemUser) {
    return null;
  }

  return organizationId;
}

/**
 * Build SQL WHERE clause for organization filtering
 * @param {object} req - Express request object
 * @param {string} tableAlias - Optional table alias (e.g., 't', 'u')
 * @returns {object} { clause: string, params: array, paramIndex: number }
 */
function buildOrganizationWhere(req, tableAlias = '') {
  const { organizationId, isSystemUser } = getOrganizationContext(req);
  const prefix = tableAlias ? `${tableAlias}.` : '';

  // System users don't need filtering
  if (isSystemUser) {
    return {
      clause: '1=1', // Always true - no filtering
      params: [],
      paramIndex: 0
    };
  }

  // Tenant users filtered by organization_id
  return {
    clause: `${prefix}organization_id = $1`,
    params: [organizationId],
    paramIndex: 1
  };
}

/**
 * Middleware to attach organization context to request
 * Usage: router.use(attachOrganizationContext)
 */
function attachOrganizationContext(req, res, next) {
  req.orgContext = getOrganizationContext(req);
  next();
}

module.exports = {
  getOrganizationContext,
  requireOrganizationContext,
  getOrganizationFilter,
  buildOrganizationWhere,
  attachOrganizationContext
};
