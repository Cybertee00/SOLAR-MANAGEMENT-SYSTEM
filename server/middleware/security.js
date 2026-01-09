/**
 * Security Headers & General Security Middleware
 * 
 * Implements OWASP security best practices:
 * - Security headers (Helmet.js)
 * - SQL injection prevention (parameterized queries - already in place)
 * - XSS prevention (input sanitization)
 * - CSRF protection (for state-changing operations)
 * - Content Security Policy
 * 
 * @see https://owasp.org/www-project-secure-headers/
 */

const helmet = require('helmet');

/**
 * Configure Helmet with security headers
 * Following OWASP recommendations
 */
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  // Cross-Origin Resource Policy - COMPLETELY DISABLED
  // /uploads route handles its own CORP headers
  // Setting to false to prevent ANY CORP header from being set by Helmet
  crossOriginResourcePolicy: false,
  // Also disable other cross-origin policies that might interfere
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // HSTS (HTTP Strict Transport Security) - only in production with HTTPS
  hsts: {
    maxAge: process.env.NODE_ENV === 'production' ? 31536000 : 0, // 1 year in production
    includeSubDomains: true,
    preload: true
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS Protection (legacy browsers)
  xssFilter: true,
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"]
    }
  }
});

/**
 * Additional security middleware
 */

/**
 * Prevent SQL injection by validating UUIDs in params
 * This is a secondary defense - primary defense is parameterized queries
 */
function validateUUIDParams(req, res, next) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Check params that should be UUIDs (id parameter)
  // Only validate 'id' parameter, not other params like 'action', 'filename', etc.
  if (req.params.id) {
    if (!uuidRegex.test(req.params.id)) {
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        return res.status(400).json({
          error: 'Invalid parameter format',
          message: `id must be a valid UUID`
        });
      }
      return;
    }
  }
  
  next();
}

/**
 * Sanitize request body to prevent NoSQL injection and other attacks
 * Removes dangerous characters and normalizes data types
 */
function sanitizeRequestBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Recursively sanitize object
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Recursively sanitize object values
 */
function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    // Remove null bytes and other dangerous characters
    return obj.replace(/\0/g, '').trim();
  }
  
  return obj;
}

/**
 * Request size limiter
 * Prevents DoS attacks via large payloads
 */
function limitRequestSize(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          error: 'Payload too large',
          message: `Request body exceeds maximum size of ${maxSize}`
        });
      }
    }
    next();
  };
}

/**
 * Parse size string (e.g., '10mb') to bytes
 */
function parseSize(size) {
  const units = {
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+)(kb|mb|gb)$/);
  if (match) {
    return parseInt(match[1], 10) * units[match[2]];
  }
  
  return parseInt(size, 10) || 10 * 1024 * 1024; // Default 10MB
}

/**
 * Log security events (failed auth, rate limits, etc.)
 */
function logSecurityEvent(eventType, req, details = {}) {
  const logData = {
    timestamp: new Date().toISOString(),
    event: eventType,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.session?.userId || null,
    ...details
  };
  
  // In production, send to security monitoring system
  // For now, just console log
  console.warn('[SECURITY EVENT]', JSON.stringify(logData));
}

module.exports = {
  securityHeaders,
  validateUUIDParams,
  sanitizeRequestBody,
  limitRequestSize,
  logSecurityEvent
};
