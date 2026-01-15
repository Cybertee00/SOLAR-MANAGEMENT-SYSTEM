let redis = null;
let redisClient = null;
let isRedisEnabled = false;

// Try to require redis, but don't fail if it's not installed
try {
  redis = require('redis');
} catch (error) {
  console.log('[REDIS] Redis module not installed. Install with: npm install redis');
  console.log('[REDIS] System will continue without Redis support.');
}

/**
 * Initialize Redis client
 * @returns {Promise<redis.RedisClient>} Redis client instance
 */
async function initRedis() {
  // Check if redis module is available
  if (!redis) {
    console.log('[REDIS] Redis module not available. Install with: npm install redis');
    return null;
  }

  // Check if Redis is enabled via environment variable
  if (process.env.REDIS_ENABLED !== 'true') {
    console.log('[REDIS] Redis is disabled. Set REDIS_ENABLED=true to enable.');
    return null;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  try {
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[REDIS] Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS] Error:', err);
      isRedisEnabled = false;
    });

    redisClient.on('connect', () => {
      console.log('[REDIS] Connected to Redis');
      isRedisEnabled = true;
    });

    redisClient.on('ready', () => {
      console.log('[REDIS] Redis client ready');
      isRedisEnabled = true;
    });

    redisClient.on('end', () => {
      console.log('[REDIS] Connection ended');
      isRedisEnabled = false;
    });

    await redisClient.connect();
    isRedisEnabled = true;
    return redisClient;
  } catch (error) {
    console.error('[REDIS] Failed to connect to Redis:', error.message);
    console.log('[REDIS] Continuing without Redis. Sessions will use memory store.');
    isRedisEnabled = false;
    return null;
  }
}

/**
 * Get Redis client instance
 * @returns {redis.RedisClient|null} Redis client or null if not available
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Check if Redis is enabled and connected
 * @returns {boolean}
 */
function isRedisAvailable() {
  return isRedisEnabled && redisClient !== null;
}

/**
 * Store JWT token in Redis with expiration
 * @param {string} token - JWT token
 * @param {Object} userData - User data to store
 * @param {number} ttlSeconds - Time to live in seconds (default: 24 hours)
 * @returns {Promise<void>}
 */
async function storeToken(token, userData, ttlSeconds = 86400) {
  if (!isRedisAvailable()) {
    return; // Silently fail if Redis is not available
  }

  try {
    const key = `jwt:${token}`;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(userData));
  } catch (error) {
    console.error('[REDIS] Error storing token:', error);
  }
}

/**
 * Get user data from Redis by token
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} User data or null
 */
async function getTokenData(token) {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const key = `jwt:${token}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[REDIS] Error getting token data:', error);
    return null;
  }
}

/**
 * Delete token from Redis
 * @param {string} token - JWT token
 * @returns {Promise<void>}
 */
async function deleteToken(token) {
  if (!isRedisAvailable()) {
    return;
  }

  try {
    const key = `jwt:${token}`;
    await redisClient.del(key);
  } catch (error) {
    console.error('[REDIS] Error deleting token:', error);
  }
}

/**
 * Store active session for a user (single-device-per-session)
 * @param {string} userId - User ID
 * @param {string} token - JWT token
 * @param {number} ttlSeconds - Time to live in seconds (default: 24 hours)
 * @returns {Promise<void>}
 */
async function storeUserSession(userId, token, ttlSeconds = 86400) {
  if (!isRedisAvailable()) {
    return; // Silently fail if Redis is not available
  }

  try {
    const userSessionKey = `user:session:${userId}`;
    // Store the active token for this user
    await redisClient.setEx(userSessionKey, ttlSeconds, token);
    console.log(`[REDIS] Stored active session for user ${userId}`);
  } catch (error) {
    console.error('[REDIS] Error storing user session:', error);
  }
}

/**
 * Get active session token for a user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Active token or null
 */
async function getUserSession(userId) {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const userSessionKey = `user:session:${userId}`;
    const token = await redisClient.get(userSessionKey);
    return token;
  } catch (error) {
    console.error('[REDIS] Error getting user session:', error);
    return null;
  }
}

/**
 * Delete active session for a user (single-device-per-session)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function deleteUserSession(userId) {
  if (!isRedisAvailable()) {
    return;
  }

  try {
    const userSessionKey = `user:session:${userId}`;
    const activeToken = await redisClient.get(userSessionKey);
    
    // Delete the user session
    await redisClient.del(userSessionKey);
    
    // Also delete the token if it exists
    if (activeToken) {
      const tokenKey = `jwt:${activeToken}`;
      await redisClient.del(tokenKey);
      console.log(`[REDIS] Deleted active session for user ${userId}`);
    }
  } catch (error) {
    console.error('[REDIS] Error deleting user session:', error);
  }
}

/**
 * Check if a token is the active session for a user
 * @param {string} userId - User ID
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} True if token matches active session
 */
async function isActiveSession(userId, token) {
  if (!isRedisAvailable()) {
    return true; // If Redis is not available, allow the session (backward compatibility)
  }

  try {
    const activeToken = await getUserSession(userId);
    if (!activeToken) {
      // No active session stored, allow this token (first login or Redis cleared)
      return true;
    }
    return activeToken === token;
  } catch (error) {
    console.error('[REDIS] Error checking active session:', error);
    return true; // On error, allow the session to prevent lockouts
  }
}

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[REDIS] Connection closed');
    } catch (error) {
      console.error('[REDIS] Error closing connection:', error);
    }
    redisClient = null;
    isRedisEnabled = false;
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisAvailable,
  storeToken,
  getTokenData,
  deleteToken,
  storeUserSession,
  getUserSession,
  deleteUserSession,
  isActiveSession,
  closeRedis
};
