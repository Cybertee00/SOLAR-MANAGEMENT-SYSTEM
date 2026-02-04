/**
 * Middleware: require organization feature to be enabled for the current tenant.
 * Used to gate APIs by subscription (manual feature toggles per org).
 * If the organization has the feature disabled, returns 403.
 */

const { getDb } = require('./tenantContext');
const { getOrganizationIdFromRequest } = require('../utils/organizationFilter');
const { isFeatureEnabled } = require('../utils/organizationConfig');

function requireFeature(pool, featureCode) {
  return async (req, res, next) => {
    try {
      const orgId = getOrganizationIdFromRequest(req);
      if (!orgId) {
        return res.status(403).json({
          error: 'Feature not available',
          code: 'FEATURE_DISABLED',
          message: 'Organization context required.'
        });
      }
      const db = getDb(req, pool);
      const enabled = await isFeatureEnabled(db, orgId, featureCode);
      if (!enabled) {
        return res.status(403).json({
          error: 'Feature not available',
          code: 'FEATURE_DISABLED',
          message: 'This feature is not included in your plan. Contact your administrator.'
        });
      }
      next();
    } catch (err) {
      console.error('requireFeature error:', err);
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
}

module.exports = { requireFeature };
