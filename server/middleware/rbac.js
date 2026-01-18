/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides permission-based access control for routes and resources
 */

/**
 * Middleware factory to check if user has a specific permission
 * @param {string} permissionCode - The permission code to check (e.g., 'tasks:create')
 * @returns {Function} Express middleware function
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // System owner (and legacy super_admin) has all permissions - skip permission check
    const userRoles = req.session.roles || [];
    if (userRoles.includes('system_owner') || userRoles.includes('super_admin')) {
      return next();
    }

    // Load user permissions if not already loaded
    if (!req.session.permissions) {
      try {
        const permissions = await loadUserPermissions(req.session.userId, req.db);
        req.session.permissions = permissions;
      } catch (error) {
        console.error('Error loading user permissions:', error);
        return res.status(500).json({ error: 'Failed to load permissions' });
      }
    }

    // Check if user has the required permission
    if (!req.session.permissions.includes(permissionCode)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissionCode,
        message: `You do not have permission to ${permissionCode}`
      });
    }

    next();
  };
}

/**
 * Middleware factory to check if user has any of the specified permissions
 * @param {...string} permissionCodes - One or more permission codes
 * @returns {Function} Express middleware function
 */
function requireAnyPermission(...permissionCodes) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // System owner (and legacy super_admin) has all permissions - skip permission check
    const userRoles = req.session.roles || [];
    if (userRoles.includes('system_owner') || userRoles.includes('super_admin')) {
      return next();
    }

    // Load user permissions if not already loaded
    if (!req.session.permissions) {
      try {
        const permissions = await loadUserPermissions(req.session.userId, req.db);
        req.session.permissions = permissions;
      } catch (error) {
        console.error('Error loading user permissions:', error);
        return res.status(500).json({ error: 'Failed to load permissions' });
      }
    }

    // Check if user has any of the required permissions
    const hasPermission = permissionCodes.some(code => 
      req.session.permissions.includes(code)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissionCodes,
        message: `You do not have any of the required permissions`
      });
    }

    next();
  };
}

/**
 * Middleware factory to check if user has all of the specified permissions
 * @param {...string} permissionCodes - One or more permission codes
 * @returns {Function} Express middleware function
 */
function requireAllPermissions(...permissionCodes) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // System owner (and legacy super_admin) has all permissions - skip permission check
    const userRoles = req.session.roles || [];
    if (userRoles.includes('system_owner') || userRoles.includes('super_admin')) {
      return next();
    }

    // Load user permissions if not already loaded
    if (!req.session.permissions) {
      try {
        const permissions = await loadUserPermissions(req.session.userId, req.db);
        req.session.permissions = permissions;
      } catch (error) {
        console.error('Error loading user permissions:', error);
        return res.status(500).json({ error: 'Failed to load permissions' });
      }
    }

    // Check if user has all of the required permissions
    const hasAllPermissions = permissionCodes.every(code => 
      req.session.permissions.includes(code)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissionCodes,
        message: `You do not have all of the required permissions`
      });
    }

    next();
  };
}

/**
 * Middleware factory to check if user has a specific role
 * @param {...string} roleCodes - One or more role codes
 * @returns {Function} Express middleware function
 */
function requireRole(...roleCodes) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Load user roles if not already loaded
    if (!req.session.roles || req.session.roles.length === 0) {
      try {
        const roles = await loadUserRoles(req.session.userId, req.db);
        req.session.roles = roles;
      } catch (error) {
        console.error('Error loading user roles:', error);
        return res.status(500).json({ error: 'Failed to load roles' });
      }
    }

    // Check if user has any of the required roles
    const hasRole = roleCodes.some(code => 
      req.session.roles.includes(code)
    );

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: roleCodes,
        message: `You do not have any of the required roles`
      });
    }

    next();
  };
}

/**
 * Load user permissions from database
 * @param {string} userId - User ID
 * @param {object} pool - Database connection pool
 * @returns {Promise<string[]>} Array of permission codes
 */
async function loadUserPermissions(userId, pool) {
  try {
    // First check if user has system_owner role - if so, grant all permissions
    const systemOwnerCheck = await pool.query(
      `SELECT 1 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND r.role_code = 'system_owner'`,
      [userId]
    );
    
    // If user is system_owner, return all permissions
    if (systemOwnerCheck.rows.length > 0) {
      const allPermissions = await pool.query(
        `SELECT permission_code FROM permissions`
      );
      return allPermissions.rows.map(row => row.permission_code);
    }
    
    // Try to get permissions from user_permissions view first
    try {
      const result = await pool.query(
        `SELECT DISTINCT permission_code 
         FROM user_permissions 
         WHERE user_id = $1`,
        [userId]
      );
      return result.rows.map(row => row.permission_code);
    } catch (viewError) {
      // View doesn't exist, fallback to role_permissions
      const result = await pool.query(
        `SELECT DISTINCT p.permission_code
         FROM user_roles ur
         JOIN role_permissions rp ON ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = $1`,
        [userId]
      );
      return result.rows.map(row => row.permission_code);
    }
  } catch (error) {
    console.error('Error loading user permissions:', error);
    // If RBAC tables don't exist, return empty array (will use legacy role-based checks)
    return [];
  }
}

/**
 * Load user roles from database
 * @param {string} userId - User ID
 * @param {object} pool - Database connection pool
 * @returns {Promise<string[]>} Array of role codes
 */
async function loadUserRoles(userId, pool) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT r.role_code
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );
    
    if (result.rows.length > 0) {
      return result.rows.map(row => row.role_code);
    }
    
    // Fallback to legacy role column if user_roles table is empty
    const legacyResult = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );
    
    if (legacyResult.rows.length > 0 && legacyResult.rows[0].role) {
      // Map legacy roles to new role codes
      const roleMapping = {
        'super_admin': 'system_owner',
        'admin': 'operations_admin',
        'supervisor': 'supervisor',
        'technician': 'technician'
      };
      const legacyRole = legacyResult.rows[0].role;
      return [roleMapping[legacyRole] || legacyRole];
    }
    
    return ['general_worker']; // Default role
  } catch (error) {
    console.error('Error loading user roles:', error);
    return [];
  }
}

/**
 * Helper function to check if user has permission (for use in route handlers)
 * @param {object} req - Express request object
 * @param {string} permissionCode - Permission code to check
 * @returns {boolean}
 */
function hasPermission(req, permissionCode) {
  if (!req.session || !req.session.userId) {
    return false;
  }
  
  // System owner (and legacy super_admin) has all permissions
  const userRoles = req.session.roles || [];
  if (userRoles.includes('system_owner') || userRoles.includes('super_admin')) {
    return true;
  }
  
  // Check permissions array
  if (req.session.permissions && Array.isArray(req.session.permissions)) {
    return req.session.permissions.includes(permissionCode);
  }
  
  return false;
}

/**
 * Helper function to check if user has any of the specified permissions
 * @param {object} req - Express request object
 * @param {...string} permissionCodes - Permission codes to check
 * @returns {boolean}
 */
function hasAnyPermission(req, ...permissionCodes) {
  if (!req.session || !req.session.userId) {
    return false;
  }
  
  // System owner (and legacy super_admin) has all permissions
  const userRoles = req.session.roles || [];
  if (userRoles.includes('system_owner') || userRoles.includes('super_admin')) {
    return true;
  }
  
  // Check permissions array
  if (req.session.permissions && Array.isArray(req.session.permissions)) {
    return permissionCodes.some(code => req.session.permissions.includes(code));
  }
  
  return false;
}

/**
 * Helper function to check if user has all of the specified permissions
 * @param {object} req - Express request object
 * @param {...string} permissionCodes - Permission codes to check
 * @returns {boolean}
 */
function hasAllPermissions(req, ...permissionCodes) {
  if (!req.session || !req.session.userId) {
    return false;
  }
  
  // System owner (and legacy super_admin) has all permissions
  const userRoles = req.session.roles || [];
  if (userRoles.includes('system_owner') || userRoles.includes('super_admin')) {
    return true;
  }
  
  // Check permissions array
  if (req.session.permissions && Array.isArray(req.session.permissions)) {
    return permissionCodes.every(code => req.session.permissions.includes(code));
  }
  
  return false;
}

/**
 * Helper function to check if user has a specific role
 * @param {object} req - Express request object
 * @param {string} roleCode - Role code to check
 * @returns {boolean}
 */
function hasRole(req, roleCode) {
  if (!req.session || !req.session.roles) {
    return false;
  }
  return req.session.roles.includes(roleCode);
}

/**
 * Middleware to load user permissions and roles into session
 * Should be used after requireAuth middleware
 */
async function loadUserRBAC(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    // Load permissions and roles if not already loaded
    if (!req.session.permissions) {
      req.session.permissions = await loadUserPermissions(req.session.userId, req.db);
    }
    if (!req.session.roles || req.session.roles.length === 0) {
      req.session.roles = await loadUserRoles(req.session.userId, req.db);
      // Also update legacy role for backward compatibility
      if (req.session.roles.length > 0) {
        req.session.role = req.session.roles[0];
      }
    }
  } catch (error) {
    console.error('Error loading RBAC data:', error);
    // Continue anyway - permissions will be checked per route
  }

  next();
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  loadUserRBAC,
  loadUserPermissions,
  loadUserRoles,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole
};
