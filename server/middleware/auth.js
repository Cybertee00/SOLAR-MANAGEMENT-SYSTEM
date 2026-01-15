// Authentication middleware
const { verifyToken, extractToken } = require('../utils/jwt');
const { getTokenData, isRedisAvailable, isActiveSession } = require('../utils/redis');

/**
 * Middleware factory to check if password change is required
 * Returns a middleware function that uses the provided pool
 */
function requirePasswordChange(pool) {
  return async (req, res, next) => {
    // Skip password check for password change and logout endpoints
    if (req.path.includes('/change-password') || req.path.includes('/logout') || req.path.includes('/auth/login')) {
      return next();
    }

    const userId = req.session?.userId;
    if (!userId) {
      return next(); // Let requireAuth handle authentication
    }

    try {
      const passwordCheck = await pool.query(
        'SELECT password_changed FROM users WHERE id = $1',
        [userId]
      );
      
      if (passwordCheck.rows.length > 0) {
        const passwordChanged = passwordCheck.rows[0].password_changed;
        if (passwordChanged === false) {
          return res.status(403).json({ 
            error: 'Password change required',
            requires_password_change: true,
            message: 'You must change your default password before accessing the application.'
          });
        }
      }
    } catch (error) {
      console.error('Error checking password change status:', error);
      // Continue if column doesn't exist (backward compatibility)
    }

    next();
  };
}

/**
 * Middleware to check if user is authenticated
 * Supports both JWT tokens (Bearer token) and session-based authentication
 */
async function requireAuth(req, res, next) {
  // Try JWT token first (Bearer token in Authorization header)
  const token = extractToken(req);
  
  if (token) {
    try {
      // Verify JWT token
      const decoded = verifyToken(token);
      
      // Check if token exists in Redis (if Redis is available)
      if (isRedisAvailable()) {
        const tokenData = await getTokenData(token);
        if (!tokenData) {
          return res.status(401).json({ error: 'Token not found or expired' });
        }
        
        // Single-Device-Per-Session: Verify this is the active session for the user
        const isActive = await isActiveSession(decoded.userId, token);
        if (!isActive) {
          return res.status(401).json({ 
            error: 'Session expired', 
            message: 'You have logged in from another device. Please log in again.'
          });
        }
        
        // Populate session-like context from token data
        req.session = req.session || {};
        req.session.userId = decoded.userId;
        req.session.username = decoded.username;
        req.session.roles = decoded.roles;
        req.session.role = decoded.role;
        req.session.fullName = decoded.fullName;
        req.session.isJWT = true; // Flag to indicate JWT authentication
      } else {
        // If Redis is not available, use decoded token data directly
        req.session = req.session || {};
        req.session.userId = decoded.userId;
        req.session.username = decoded.username;
        req.session.roles = decoded.roles;
        req.session.role = decoded.role;
        req.session.fullName = decoded.fullName;
        req.session.isJWT = true;
      }
      
      return next();
    } catch (error) {
      console.log('JWT authentication failed:', error.message);
      // Fall through to session-based authentication
    }
  }

  // Fallback to session-based authentication
  // Debug session information
  console.log('Auth check (session):', {
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
  requirePasswordChange,
  requireSuperAdmin,
  requireAdmin,
  requireAdminOrSupervisor,
  isSuperAdmin,
  isAdmin,
  isTechnician
};

