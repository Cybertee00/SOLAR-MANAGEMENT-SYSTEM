// Authentication middleware

/**
 * Middleware to check if user is authenticated
 */
function requireAuth(req, res, next) {
  // Debug session information
  console.log('Auth check:', {
    hasSession: !!req.session,
    hasUserId: !!(req.session && req.session.userId),
    sessionId: req.sessionID,
    userId: req.session?.userId,
    username: req.session?.username,
    role: req.session?.role,
    cookies: req.headers.cookie
  });

  if (!req.session || !req.session.userId) {
    console.log('Authentication failed - no session or userId');
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Helper function to get user roles from session
 * Supports both single role (backward compatibility) and multiple roles
 */
function getUserRoles(req) {
  if (!req.session || !req.session.userId) {
    return [];
  }
  
  // Check if roles array exists (new format)
  if (req.session.roles && Array.isArray(req.session.roles)) {
    return req.session.roles;
  }
  
  // Fallback to single role (backward compatibility)
  if (req.session.role) {
    return [req.session.role];
  }
  
  return [];
}

/**
 * Helper function to check if user has a specific role
 */
function hasRole(req, role) {
  const roles = getUserRoles(req);
  return roles.includes(role);
}

/**
 * Helper function to check if user has any of the specified roles
 */
function hasAnyRole(req, ...roles) {
  const userRoles = getUserRoles(req);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Middleware to check if user has super_admin role
 */
function requireSuperAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!hasRole(req, 'super_admin')) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

/**
 * Middleware to check if user has admin or super_admin role
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!hasAnyRole(req, 'admin', 'super_admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Middleware to check if user has admin, super_admin, or supervisor role
 */
function requireAdminOrSupervisor(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!hasAnyRole(req, 'admin', 'super_admin', 'supervisor')) {
    return res.status(403).json({ error: 'Admin or supervisor access required' });
  }
  next();
}

/**
 * Helper function to check if user is super admin
 */
function isSuperAdmin(req) {
  return hasRole(req, 'super_admin');
}

/**
 * Helper function to check if user is admin or super admin
 */
function isAdmin(req) {
  return hasAnyRole(req, 'admin', 'super_admin');
}

/**
 * Helper function to check if user is technician
 */
function isTechnician(req) {
  return hasRole(req, 'technician');
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireAdmin,
  requireAdminOrSupervisor,
  isSuperAdmin,
  isAdmin,
  isTechnician
};

