/**
 * Permission utilities for frontend RBAC
 * Provides helper functions to check user permissions and roles
 */

/**
 * Check if user has a specific permission
 * System owner (and legacy super_admin) has all permissions
 * @param {string[]} permissions - Array of user permissions
 * @param {string} permissionCode - Permission code to check (e.g., 'tasks:create')
 * @param {string[]} roles - Optional array of user roles to check for system_owner
 * @returns {boolean}
 */
export function hasPermission(permissions, permissionCode, roles = []) {
  // System owner (and legacy super_admin) has all permissions
  if (roles && Array.isArray(roles)) {
    if (roles.includes('system_owner') || roles.includes('super_admin')) {
      return true;
    }
  }
  
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }
  return permissions.includes(permissionCode);
}

/**
 * Check if user has any of the specified permissions
 * System owner (and legacy super_admin) has all permissions
 * @param {string[]} permissions - Array of user permissions
 * @param {...string} permissionCodes - One or more permission codes
 * @param {string[]} roles - Optional array of user roles to check for system_owner
 * @returns {boolean}
 */
export function hasAnyPermission(permissions, ...args) {
  // Last argument might be roles array if passed from usePermissions
  const lastArg = args[args.length - 1];
  const isRolesArray = Array.isArray(lastArg) && lastArg.length > 0 && typeof lastArg[0] === 'string' && !lastArg[0].includes(':');
  const roles = isRolesArray ? lastArg : [];
  const permissionCodes = isRolesArray ? args.slice(0, -1) : args;
  
  // System owner (and legacy super_admin) has all permissions
  if (roles && (roles.includes('system_owner') || roles.includes('super_admin'))) {
    return true;
  }
  
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }
  return permissionCodes.some(code => permissions.includes(code));
}

/**
 * Check if user has all of the specified permissions
 * System owner (and legacy super_admin) has all permissions
 * @param {string[]} permissions - Array of user permissions
 * @param {...string} permissionCodes - One or more permission codes
 * @param {string[]} roles - Optional array of user roles to check for system_owner
 * @returns {boolean}
 */
export function hasAllPermissions(permissions, ...args) {
  // Last argument might be roles array if passed from usePermissions
  const lastArg = args[args.length - 1];
  const isRolesArray = Array.isArray(lastArg) && lastArg.length > 0 && typeof lastArg[0] === 'string' && !lastArg[0].includes(':');
  const roles = isRolesArray ? lastArg : [];
  const permissionCodes = isRolesArray ? args.slice(0, -1) : args;
  
  // System owner (and legacy super_admin) has all permissions
  if (roles && (roles.includes('system_owner') || roles.includes('super_admin'))) {
    return true;
  }
  
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }
  return permissionCodes.every(code => permissions.includes(code));
}

/**
 * Helper function to normalize role codes (maps legacy to RBAC)
 */
function normalizeRole(role) {
  const roleMapping = {
    'super_admin': 'system_owner',
    'admin': 'operations_admin',
    'supervisor': 'supervisor',
    'technician': 'technician'
  };
  return roleMapping[role] || role;
}

/**
 * Check if user has a specific role
 * Supports both legacy roles (super_admin, admin) and RBAC roles (system_owner, operations_admin)
 * @param {string[]} roles - Array of user roles
 * @param {string} roleCode - Role code to check (e.g., 'system_owner')
 * @returns {boolean}
 */
export function hasRole(roles, roleCode) {
  if (!roles || !Array.isArray(roles)) {
    return false;
  }
  const normalizedRole = normalizeRole(roleCode);
  
  // Check if user has the role (either exact match or normalized)
  return roles.some(userRole => {
    const normalizedUserRole = normalizeRole(userRole);
    return normalizedUserRole === normalizedRole || userRole === roleCode;
  });
}

/**
 * Check if user has any of the specified roles
 * Supports both legacy roles and RBAC roles
 * @param {string[]} roles - Array of user roles
 * @param {...string} roleCodes - One or more role codes
 * @returns {boolean}
 */
export function hasAnyRole(roles, ...roleCodes) {
  if (!roles || !Array.isArray(roles)) {
    return false;
  }
  const normalizedRoles = roleCodes.map(normalizeRole);
  
  return roles.some(userRole => {
    const normalizedUserRole = normalizeRole(userRole);
    return normalizedRoles.includes(normalizedUserRole) || roleCodes.includes(userRole);
  });
}

/**
 * Get permission codes for a specific resource
 * @param {string[]} permissions - Array of user permissions
 * @param {string} resource - Resource name (e.g., 'tasks', 'inventory')
 * @returns {string[]} Array of permission codes for the resource
 */
export function getResourcePermissions(permissions, resource) {
  if (!permissions || !Array.isArray(permissions)) {
    return [];
  }
  return permissions.filter(perm => perm.startsWith(`${resource}:`));
}

/**
 * Check if user can perform a specific action on a resource
 * System owner (and legacy super_admin) can perform all actions
 * @param {string[]} permissions - Array of user permissions
 * @param {string} resource - Resource name (e.g., 'tasks')
 * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @param {string[]} roles - Optional array of user roles to check for system_owner
 * @returns {boolean}
 */
export function canPerformAction(permissions, resource, action, roles = []) {
  // System owner (and legacy super_admin) can perform all actions
  if (roles && (roles.includes('system_owner') || roles.includes('super_admin'))) {
    return true;
  }
  return hasPermission(permissions, `${resource}:${action}`, roles);
}

/**
 * Permission constants for easy reference
 */
export const PERMISSIONS = {
  // Tasks
  TASKS_CREATE: 'tasks:create',
  TASKS_READ: 'tasks:read',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_ASSIGN: 'tasks:assign',
  TASKS_APPROVE: 'tasks:approve',
  TASKS_EXECUTE: 'tasks:execute',
  
  // Templates
  TEMPLATES_CREATE: 'templates:create',
  TEMPLATES_READ: 'templates:read',
  TEMPLATES_UPDATE: 'templates:update',
  TEMPLATES_DELETE: 'templates:delete',
  
  // Inventory
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_APPROVE: 'inventory:approve',
  
  // Users
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage_roles',
  
  // CM Letters
  CM_LETTERS_CREATE: 'cm_letters:create',
  CM_LETTERS_READ: 'cm_letters:read',
  CM_LETTERS_UPDATE: 'cm_letters:update',
  CM_LETTERS_DELETE: 'cm_letters:delete',
  CM_LETTERS_DOWNLOAD: 'cm_letters:download',
  
  // Calendar
  CALENDAR_READ: 'calendar:read',
  CALENDAR_UPDATE: 'calendar:update',
  
  // Plant Map
  PLANT_READ: 'plant:read',
  PLANT_UPDATE: 'plant:update',
  PLANT_APPROVE: 'plant:approve',
  
  // Notifications
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_UPDATE: 'notifications:update',
  NOTIFICATIONS_APPROVE: 'notifications:approve',
  
  // Reports
  REPORTS_READ: 'reports:read',
  REPORTS_DOWNLOAD: 'reports:download',
  
  // System
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_SETTINGS: 'system:settings'
};

/**
 * Role constants for easy reference
 */
export const ROLES = {
  SYSTEM_OWNER: 'system_owner',
  OPERATIONS_ADMIN: 'operations_admin',
  SUPERVISOR: 'supervisor',
  TECHNICIAN: 'technician',
  GENERAL_WORKER: 'general_worker',
  INVENTORY_CONTROLLER: 'inventory_controller'
};
