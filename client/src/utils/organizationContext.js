/**
 * Organization Context Utility
 * Helper functions to check if a system owner has selected a company
 */

/**
 * Check if current user is a system owner without a selected company
 * @param {Object} user - User object from AuthContext
 * @returns {boolean} True if system owner without company selected
 */
export function isSystemOwnerWithoutCompany(user) {
  if (!user) return false;
  
  const roles = user.roles || (user.role ? [user.role] : []);
  const isSystemOwner = roles.includes('system_owner') || roles.includes('super_admin') || 
                        user.role === 'system_owner' || user.role === 'super_admin';
  
  if (!isSystemOwner) {
    // Regular users always have an organization
    return false;
  }
  
  // System owner: check if company is selected
  const selectedOrgId = sessionStorage.getItem('selectedOrganizationId');
  const selectedOrgSlug = sessionStorage.getItem('selectedOrganizationSlug');
  
  // If no organization selected in sessionStorage, and user doesn't have organization_id
  return !selectedOrgId && !selectedOrgSlug && !user.organization_id;
}

/**
 * Get the current organization slug
 * For system owners: from sessionStorage
 * For regular users: from user object
 * @param {Object} user - User object from AuthContext
 * @returns {string|null} Organization slug or null
 */
export function getCurrentOrganizationSlug(user) {
  // Check sessionStorage first (for system owners who selected a company)
  const selectedSlug = sessionStorage.getItem('selectedOrganizationSlug');
  if (selectedSlug) {
    return selectedSlug;
  }
  
  // For regular users, get from user object
  if (user) {
    if (user.organization_slug) {
      return user.organization_slug;
    }
  }
  
  return null;
}

/**
 * Check if user has organization context (can see company data)
 * @param {Object} user - User object from AuthContext
 * @returns {boolean} True if user has organization context
 */
export function hasOrganizationContext(user) {
  if (!user) return false;
  
  const roles = user.roles || (user.role ? [user.role] : []);
  const isSystemOwner = roles.includes('system_owner') || roles.includes('super_admin') || 
                        user.role === 'system_owner' || user.role === 'super_admin';
  
  if (!isSystemOwner) {
    // Regular users always have organization context
    return !!user.organization_id;
  }
  
  // System owner: must have selected a company
  const selectedOrgId = sessionStorage.getItem('selectedOrganizationId');
  const selectedOrgSlug = sessionStorage.getItem('selectedOrganizationSlug');
  
  return !!(selectedOrgId || selectedOrgSlug);
}
