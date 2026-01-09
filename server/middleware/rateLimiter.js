/**
 * Rate Limiting Middleware
 * 
 * Implements OWASP-recommended rate limiting with:
 * - IP-based limiting for public endpoints
 * - User-based limiting for authenticated endpoints
 * - Graceful 429 responses with retry-after headers
 * - Configurable limits per endpoint type
 * 
 * @see https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

/**
 * Get client identifier for rate limiting
 * Priority: User ID > IP Address
 */
function getClientIdentifier(req) {
  // If user is authenticated, use user ID for user-based limiting
  if (req.session && req.session.userId) {
    return `user:${req.session.userId}`;
  }
  // Otherwise use IP address
  return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
}

/**
 * Standard rate limiter for general API endpoints
 * Default: 100 requests per 15 minutes per IP/user
 */
const standardLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests
  message: {
    error: 'Too many requests from this IP/user, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000)
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use custom key generator for user-based limiting
  keyGenerator: (req) => getClientIdentifier(req),
  // Graceful error handler
  handler: (req, res) => {
    const retryAfter = Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: retryAfter
    });
  },
  // Skip rate limiting for successful requests (only count failures)
  skipSuccessfulRequests: false,
  // Skip rate limiting for failed requests (count all requests)
  skipFailedRequests: false
});

/**
 * Strict rate limiter for authentication endpoints
 * Default: 5 login attempts per 15 minutes per IP
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10), // 5 attempts
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    retryAfter: Math.ceil(parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Always use IP for auth endpoints (before user is authenticated)
  keyGenerator: (req) => `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`,
  // Count failed requests to prevent brute force
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Too many failed login attempts from this IP. Please try again later.',
      retryAfter: retryAfter
    });
  }
});

/**
 * Strict rate limiter for sensitive operations (user creation, password changes)
 * Default: 10 requests per hour per user
 */
const sensitiveOperationLimiter = rateLimit({
  windowMs: parseInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
  max: parseInt(process.env.SENSITIVE_RATE_LIMIT_MAX || '10', 10), // 10 requests
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded for this operation. Please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS || '3600000', 10) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIdentifier(req),
  handler: (req, res) => {
    const retryAfter = Math.ceil(parseInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS || '3600000', 10) / 1000);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests for this sensitive operation. Please try again later.',
      retryAfter: retryAfter
    });
  }
});

/**
 * Slow down middleware - adds delay after each request
 * Helps prevent rapid-fire attacks while still allowing legitimate use
 * Default: 100ms delay after first request, increases with each subsequent request
 * 
 * Note: express-slow-down v3+ changed delayMs to be a function
 */
const speedLimiter = slowDown({
  windowMs: parseInt(process.env.SPEED_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  delayAfter: parseInt(process.env.SPEED_LIMIT_DELAY_AFTER || '50', 10), // Start delaying after 50 requests
  delayMs: (used, req) => {
    // Calculate delay based on how many requests over the limit
    const delayPerRequest = parseInt(process.env.SPEED_LIMIT_DELAY_MS || '100', 10);
    const maxDelay = parseInt(process.env.SPEED_LIMIT_MAX_DELAY_MS || '2000', 10);
    const delayAfter = parseInt(process.env.SPEED_LIMIT_DELAY_AFTER || '50', 10);
    
    if (used <= delayAfter) {
      return 0; // No delay if under the threshold
    }
    
    // Calculate delay: (used - delayAfter) * delayPerRequest, capped at maxDelay
    const calculatedDelay = (used - delayAfter) * delayPerRequest;
    return Math.min(calculatedDelay, maxDelay);
  },
  keyGenerator: (req) => getClientIdentifier(req),
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  validate: {
    delayMs: false // Disable validation warning since we're using the new API correctly
  }
});

module.exports = {
  standardLimiter,
  authLimiter,
  sensitiveOperationLimiter,
  speedLimiter
};
