// Authentication middleware

/**
 * Middleware to check if user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to check if user has admin role
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Middleware to check if user has admin or supervisor role
 */
function requireAdminOrSupervisor(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.role !== 'admin' && req.session.role !== 'supervisor') {
    return res.status(403).json({ error: 'Admin or supervisor access required' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminOrSupervisor
};

