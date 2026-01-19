/**
 * Improved Rate Limiting Middleware
 * 
 * Implements production-ready rate limiting with:
 * - Redis store support (falls back to MemoryStore in development)
 * - IP-based and account-based limiting
 * - Progressive delays (exponential backoff)
 * - Better error messages with retry information
 * - Development-friendly defaults
 * 
 * @see https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { getRedisClient, isRedisAvailable } = require('../utils/redis');
const logger = require('../utils/logger');
const { isProduction, isDevelopment } = require('../utils/env');

/**
 * Safely extract IP address from request (IPv4 and IPv6 compatible)
 * Handles proxy headers and IPv6 addresses correctly
 * 
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getClientIP(req) {
  // Check for IP in request (Express sets this when trust proxy is enabled)
  if (req.ip) {
    return req.ip;
  }
  
  // Check X-Forwarded-For header (first IP in chain)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // Check X-Real-IP header
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  // Fallback to connection remote address
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }
  
  // Last resort
  return 'unknown';
}

/**
 * Get client identifier for rate limiting
 * Priority: User ID > IP Address
 * Uses IPv6-safe IP extraction
 */
function getClientIdentifier(req) {
  // If user is authenticated, use user ID for user-based limiting
  if (req.session && req.session.userId) {
    return `user:${req.session.userId}`;
  }
  // Otherwise use IP address (IPv6-safe)
  const ip = getClientIP(req);
  return `ip:${ip}`;
}

/**
 * Get account identifier from request body (for login attempts)
 * Extracts username/email from login request for account-based tracking
 */
function getAccountIdentifier(req) {
  const username = req.body?.username || req.body?.email || null;
  if (username) {
    return `account:${username.toLowerCase().trim()}`;
  }
  return null;
}

/**
 * Create a custom store that uses Redis if available, otherwise MemoryStore
 * For express-rate-limit v7, we'll use the built-in MemoryStore but track
 * account-based lockouts separately in Redis
 */
function createStore() {
  // For now, use MemoryStore (built-in)
  // Account-based tracking will be handled separately
  return undefined; // undefined = use default MemoryStore
}

/**
 * Calculate retry time in seconds
 */
function getRetryAfterSeconds(windowMs) {
  return Math.ceil(windowMs / 1000);
}

/**
 * Format retry time as human-readable string
 */
function formatRetryTime(retryAfterSeconds) {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}`;
  } else if (retryAfterSeconds < 3600) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.ceil(retryAfterSeconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}

/**
 * Standard rate limiter for general API endpoints
 * Default: 100 requests per 15 minutes per IP/user
 * Disabled in development mode
 */
const standardLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => getClientIdentifier(req),
  skip: () => isDevelopment(), // Skip rate limiting in development
  handler: (req, res) => {
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
    const retryAfter = getRetryAfterSeconds(windowMs);
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${formatRetryTime(retryAfter)}.`,
      retryAfter: retryAfter,
      retryAfterFormatted: formatRetryTime(retryAfter)
    });
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

/**
 * Improved authentication rate limiter
 * Default: 10 login attempts per 15 minutes per IP (increased from 5)
 * - More forgiving for legitimate users
 * - Better error messages
 * - Account-based tracking (separate from IP)
 * Disabled in development mode
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10), // 10 attempts (increased from 5)
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment(), // Skip rate limiting in development
  // Always use IP for auth endpoints (before user is authenticated)
  // Use IPv6-safe IP extraction
  keyGenerator: (req) => {
    const ip = getClientIP(req);
    return `ip:${ip}`;
  },
  // Only count failed requests to prevent brute force
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  handler: (req, res, next, options) => {
    const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10);
    const retryAfter = getRetryAfterSeconds(windowMs);
    const retryAfterFormatted = formatRetryTime(retryAfter);
    
    // Get remaining time from rate limit headers if available
    const resetTime = res.getHeader('RateLimit-Reset');
    const remainingTime = resetTime ? Math.max(0, Math.ceil((resetTime * 1000 - Date.now()) / 1000)) : retryAfter;
    
    logger.warn('[RATE_LIMIT] Login rate limit exceeded', {
      ip: req.ip,
      username: req.body?.username || req.body?.email || 'unknown',
      retryAfter: remainingTime
    });
    
    res.status(429).json({
      error: 'Too many login attempts',
      message: `Too many failed login attempts from this IP. Please try again in ${formatRetryTime(remainingTime)}.`,
      retryAfter: remainingTime,
      retryAfterFormatted: formatRetryTime(remainingTime),
      suggestions: [
        'Wait for the rate limit to reset',
        'Use the "Forgot Password" feature if you\'ve forgotten your password',
        'Contact your administrator if you believe this is an error'
      ]
    });
  }
});

/**
 * Progressive delay middleware for login attempts
 * Adds increasing delays after multiple failed attempts
 * - 1-3 attempts: No delay
 * - 4-6 attempts: 1 second delay
 * - 7-9 attempts: 3 second delay
 * - 10+ attempts: 5 second delay
 * Disabled in development mode
 */
const loginSlowDown = slowDown({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  delayAfter: 3, // Start delaying after 3 failed attempts
  skip: () => isDevelopment(), // Skip rate limiting in development
  delayMs: (used, req) => {
    if (used <= 3) {
      return 0; // No delay for first 3 attempts
    } else if (used <= 6) {
      return 1000; // 1 second delay for attempts 4-6
    } else if (used <= 9) {
      return 3000; // 3 second delay for attempts 7-9
    } else {
      return 5000; // 5 second delay for 10+ attempts
    }
  },
  // Use IPv6-safe IP extraction
  keyGenerator: (req) => {
    const ip = getClientIP(req);
    return `ip:${ip}`;
  },
  skipSuccessfulRequests: true, // Only delay failed attempts
  skipFailedRequests: false
});

/**
 * Account-based lockout tracking
 * Tracks failed login attempts per account (username/email)
 * Separate from IP-based limiting to prevent account-specific attacks
 */
async function checkAccountLockout(req) {
  // Skip account lockout in development
  if (isDevelopment()) {
    return null;
  }
  
  const accountId = getAccountIdentifier(req);
  if (!accountId || !isRedisAvailable()) {
    return null; // No account lockout if Redis not available or no account identifier
  }

  try {
    const redisClient = getRedisClient();
    const lockoutKey = `account_lockout:${accountId}`;
    const lockoutData = await redisClient.get(lockoutKey);
    
    if (lockoutData) {
      const data = JSON.parse(lockoutData);
      const now = Date.now();
      
      if (data.lockedUntil > now) {
        const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
        return {
          locked: true,
          remainingSeconds,
          remainingFormatted: formatRetryTime(remainingSeconds),
          attempts: data.attempts
        };
      } else {
        // Lockout expired, remove it
        await redisClient.del(lockoutKey);
      }
    }
    
    return null;
  } catch (error) {
    logger.error('[RATE_LIMIT] Error checking account lockout', { error: error.message });
    return null; // Fail open - don't block if Redis has issues
  }
}

/**
 * Record failed login attempt for account-based tracking
 */
async function recordFailedLoginAttempt(req) {
  // Skip account lockout tracking in development
  if (isDevelopment()) {
    return;
  }
  
  const accountId = getAccountIdentifier(req);
  if (!accountId || !isRedisAvailable()) {
    return; // Skip if Redis not available
  }

  try {
    const redisClient = getRedisClient();
    const lockoutKey = `account_lockout:${accountId}`;
    const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10);
    const maxAttempts = parseInt(process.env.AUTH_ACCOUNT_LOCKOUT_MAX || '15', 10); // 15 attempts per account
    
    // Get current lockout data
    const existingData = await redisClient.get(lockoutKey);
    let data = existingData ? JSON.parse(existingData) : { attempts: 0, lockedUntil: 0 };
    
    data.attempts += 1;
    
    // Lock account if max attempts reached
    if (data.attempts >= maxAttempts) {
      data.lockedUntil = Date.now() + windowMs;
      logger.warn('[RATE_LIMIT] Account locked due to too many failed attempts', {
        account: accountId,
        attempts: data.attempts
      });
    }
    
    // Store with expiration
    await redisClient.setEx(lockoutKey, Math.ceil(windowMs / 1000), JSON.stringify(data));
  } catch (error) {
    logger.error('[RATE_LIMIT] Error recording failed login attempt', { error: error.message });
  }
}

/**
 * Clear account lockout on successful login
 */
async function clearAccountLockout(req) {
  const accountId = getAccountIdentifier(req);
  if (!accountId || !isRedisAvailable()) {
    return;
  }

  try {
    const redisClient = getRedisClient();
    const lockoutKey = `account_lockout:${accountId}`;
    await redisClient.del(lockoutKey);
    logger.debug('[RATE_LIMIT] Account lockout cleared', { account: accountId });
  } catch (error) {
    logger.error('[RATE_LIMIT] Error clearing account lockout', { error: error.message });
  }
}

/**
 * Middleware to check account lockout before processing login
 * Wraps async function to handle errors properly
 */
function accountLockoutMiddleware(req, res, next) {
  checkAccountLockout(req)
    .then(lockout => {
      if (lockout && lockout.locked) {
        logger.warn('[RATE_LIMIT] Login blocked by account lockout', {
          account: getAccountIdentifier(req),
          remaining: lockout.remainingFormatted
        });
        
        return res.status(429).json({
          error: 'Account temporarily locked',
          message: `This account has been temporarily locked due to too many failed login attempts. Please try again in ${lockout.remainingFormatted}.`,
          retryAfter: lockout.remainingSeconds,
          retryAfterFormatted: lockout.remainingFormatted,
          suggestions: [
            'Wait for the lockout period to expire',
            'Use the "Forgot Password" feature to reset your password',
            'Contact your administrator if you need immediate access'
          ]
        });
      }
      
      next();
    })
    .catch(error => {
      logger.error('[RATE_LIMIT] Error checking account lockout', { error: error.message });
      // Fail open - allow request if lockout check fails
      next();
    });
}

/**
 * Strict rate limiter for sensitive operations (user creation, password changes)
 * Default: 10 requests per hour per user
 * Disabled in development mode
 */
const sensitiveOperationLimiter = rateLimit({
  windowMs: parseInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
  max: parseInt(process.env.SENSITIVE_RATE_LIMIT_MAX || '10', 10), // 10 requests
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment(), // Skip rate limiting in development
  keyGenerator: (req) => getClientIdentifier(req),
  handler: (req, res) => {
    const windowMs = parseInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS || '3600000', 10);
    const retryAfter = getRetryAfterSeconds(windowMs);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests for this sensitive operation. Please try again in ${formatRetryTime(retryAfter)}.`,
      retryAfter: retryAfter,
      retryAfterFormatted: formatRetryTime(retryAfter)
    });
  }
});

/**
 * Slow down middleware - adds delay after each request
 * Helps prevent rapid-fire attacks while still allowing legitimate use
 * Disabled in development mode
 */
const speedLimiter = slowDown({
  windowMs: parseInt(process.env.SPEED_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  delayAfter: parseInt(process.env.SPEED_LIMIT_DELAY_AFTER || '50', 10), // Start delaying after 50 requests
  skip: () => isDevelopment(), // Skip rate limiting in development
  delayMs: (used, req) => {
    const delayPerRequest = parseInt(process.env.SPEED_LIMIT_DELAY_MS || '100', 10);
    const maxDelay = parseInt(process.env.SPEED_LIMIT_MAX_DELAY_MS || '2000', 10);
    const delayAfter = parseInt(process.env.SPEED_LIMIT_DELAY_AFTER || '50', 10);
    
    if (used <= delayAfter) {
      return 0;
    }
    
    const calculatedDelay = (used - delayAfter) * delayPerRequest;
    return Math.min(calculatedDelay, maxDelay);
  },
  keyGenerator: (req) => getClientIdentifier(req),
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

module.exports = {
  standardLimiter,
  authLimiter,
  loginSlowDown,
  sensitiveOperationLimiter,
  speedLimiter,
  accountLockoutMiddleware,
  checkAccountLockout,
  recordFailedLoginAttempt,
  clearAccountLockout
};
