/**
 * Organization Filter Utilities
 * Helper functions to ensure system owners see no data when no company is selected
 */

/**
 * Check if the current request has an organization context
 * For system owners: returns true only if a company is selected
 * For regular users: returns true (they always have an organization)
 * @param {Object} req - Express request object
 * @returns {boolean} True if organization context exists
 */
function hasOrganizationContext(req) {
  // Check tenant context
  if (req.tenantContext) {
    // For system owners, organizationId must be set (company selected)
    if (req.tenantContext.isSystemOwner) {
      return !!req.tenantContext.organizationId;
    }
    // For regular users, they always have an organization
    return !!req.tenantContext.organizationId;
  }
  
  // Fallback: check session
  if (req.session) {
    const isSystemOwner = req.session.roles?.includes('system_owner') || 
                         req.session.role === 'system_owner' ||
                         req.session.roles?.includes('super_admin') ||
                         req.session.role === 'super_admin';
    
    if (isSystemOwner) {
      // System owner must have selected a company
      return !!req.session.selectedOrganizationId;
    }
    // Regular user always has organization
    return true;
  }
  
  return false;
}

/**
 * Get organization ID from request context
 * Returns null if system owner hasn't selected a company
 * @param {Object} req - Express request object
 * @returns {string|null} Organization ID or null
 */
function getOrganizationIdFromRequest(req) {
  if (req.tenantContext && req.tenantContext.organizationId) {
    return req.tenantContext.organizationId;
  }
  
  if (req.session) {
    const isSystemOwner = req.session.roles?.includes('system_owner') || 
                         req.session.role === 'system_owner' ||
                         req.session.roles?.includes('super_admin') ||
                         req.session.role === 'super_admin';
    
    if (isSystemOwner) {
      // System owner must have selected a company
      return req.session.selectedOrganizationId || null;
    }
    // Regular user - get from user record (would need to fetch)
    return null; // Will be handled by RLS
  }
  
  return null;
}

/**
 * Check if current user is a system owner without a selected company
 * @param {Object} req - Express request object
 * @returns {boolean} True if system owner with no company selected
 */
function isSystemOwnerWithoutCompany(req) {
  if (!req.tenantContext) {
    return false;
  }
  
  if (req.tenantContext.isSystemOwner && !req.tenantContext.organizationId) {
    return true;
  }
  
  return false;
}

module.exports = {
  hasOrganizationContext,
  getOrganizationIdFromRequest,
  isSystemOwnerWithoutCompany
};
