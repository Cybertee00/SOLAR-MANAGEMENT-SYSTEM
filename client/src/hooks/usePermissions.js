/**
 * React hook for checking user permissions and roles
 * Provides easy access to permission checking functions
 */

import { useAuth } from '../context/AuthContext';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  hasRole as checkRole,
  hasAnyRole as checkAnyRole,
  canPerformAction,
  getResourcePermissions
} from '../utils/permissions';

/**
 * Custom hook to access user permissions and roles
 * @returns {object} Permission checking functions and user data
 */
export function usePermissions() {
  const { user } = useAuth();
  
  const permissions = user?.permissions || [];
  const roles = user?.roles || [];
  
  return {
    // Permission checking functions (pass roles for system_owner check)
    hasPermission: (permissionCode) => checkPermission(permissions, permissionCode, roles),
    hasAnyPermission: (...codes) => {
      // System owner has all permissions
      if (roles.includes('system_owner') || roles.includes('super_admin')) {
        return true;
      }
      return checkAnyPermission(permissions, ...codes, roles);
    },
    hasAllPermissions: (...codes) => {
      // System owner has all permissions
      if (roles.includes('system_owner') || roles.includes('super_admin')) {
        return true;
      }
      return checkAllPermissions(permissions, ...codes, roles);
    },
    canPerformAction: (resource, action) => {
      // System owner can perform all actions
      if (roles.includes('system_owner') || roles.includes('super_admin')) {
        return true;
      }
      return canPerformAction(permissions, resource, action, roles);
    },
    getResourcePermissions: (resource) => getResourcePermissions(permissions, resource),
    
    // Role checking functions
    hasRole: (roleCode) => checkRole(roles, roleCode),
    hasAnyRole: (...codes) => checkAnyRole(roles, ...codes),
    
    // Raw data
    permissions,
    roles,
    user
  };
}
