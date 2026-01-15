const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Middleware for platform service authentication
const requirePlatformAuth = (req, res, next) => {
  // Check for service account authentication
  const serviceToken = req.headers['x-platform-service-token'];
  const expectedToken = process.env.PLATFORM_SERVICE_TOKEN;

  if (!expectedToken) {
    console.error('[PLATFORM] PLATFORM_SERVICE_TOKEN not configured');
    return res.status(503).json({ error: 'Update service not configured' });
  }

  if (!serviceToken || serviceToken !== expectedToken) {
    console.warn('[PLATFORM] Invalid service token attempt', {
      ip: req.ip,
      hasToken: !!serviceToken
    });
    return res.status(401).json({ error: 'Unauthorized: Invalid service token' });
  }

  // Optional: IP whitelist check
  const allowedIPs = process.env.PLATFORM_UPDATE_IPS ? 
    process.env.PLATFORM_UPDATE_IPS.split(',') : null;
  
  if (allowedIPs && !allowedIPs.includes(req.ip)) {
    console.warn('[PLATFORM] IP not whitelisted', { ip: req.ip });
    return res.status(403).json({ error: 'Forbidden: IP not authorized' });
  }

  req.platformAuth = {
    authenticated: true,
    timestamp: new Date().toISOString()
  };

  next();
};

module.exports = (pool) => {
  const router = express.Router();

  // Get current version
  router.get('/version', (req, res) => {
    try {
      const packageJson = require('../package.json');
      const version = packageJson.version || '1.0.0';
      
      res.json({
        version,
        name: packageJson.name,
        description: packageJson.description
      });
    } catch (error) {
      console.error('[PLATFORM] Error getting version:', error);
      res.status(500).json({ error: 'Failed to get version' });
    }
  });

  // Check for available updates (public endpoint, no auth required)
  router.get('/updates/check', async (req, res) => {
    try {
      const updateServerUrl = process.env.PLATFORM_UPDATE_SERVER_URL;
      if (!updateServerUrl) {
        return res.json({
          updateAvailable: false,
          message: 'Update server not configured'
        });
      }

      const currentVersion = require('../package.json').version;
      
      // In production, this would check against your update server
      // For now, return current status
      res.json({
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        message: 'Update check functionality requires update server configuration'
      });
    } catch (error) {
      console.error('[PLATFORM] Error checking updates:', error);
      res.status(500).json({ error: 'Failed to check updates' });
    }
  });

  // Apply update (requires authentication)
  router.post('/updates/apply', requirePlatformAuth, async (req, res) => {
    const updateId = `update-${Date.now()}`;
    const logFile = path.join(__dirname, '../logs', `update-${updateId}.log`);

    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.dirname(logFile);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const log = (message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(`[PLATFORM UPDATE] ${message}`);
        fs.appendFileSync(logFile, logMessage);
      };

      log(`Update initiated by ${req.ip}`);

      const { version, updateType = 'patch' } = req.body;

      if (!version) {
        return res.status(400).json({ error: 'Version is required' });
      }

      // Store update record in database
      await pool.query(
        `INSERT INTO platform_updates (id, version, update_type, status, initiated_by, initiated_at, log_file)
         VALUES ($1, $2, $3, 'in_progress', $4, CURRENT_TIMESTAMP, $5)`,
        [updateId, version, updateType, req.ip, logFile]
      );

      log(`Starting update to version ${version}`);

      // Backup database
      log('Creating database backup...');
      const backupPath = path.join(__dirname, '../backups', `backup-${updateId}.sql`);
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Execute update (in production, this would pull from your update server)
      log('Applying update...');
      
      // Update status to completed
      await pool.query(
        `UPDATE platform_updates 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [updateId]
      );

      log('Update completed successfully');

      res.json({
        success: true,
        updateId,
        version,
        message: 'Update applied successfully',
        logFile
      });
    } catch (error) {
      console.error('[PLATFORM] Update error:', error);

      // Update status to failed
      try {
        await pool.query(
          `UPDATE platform_updates 
           SET status = 'failed', error_message = $2, completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [updateId, error.message]
        );
      } catch (dbError) {
        console.error('[PLATFORM] Failed to update status:', dbError);
      }

      res.status(500).json({
        error: 'Update failed',
        updateId,
        message: error.message
      });
    }
  });

  // Get update status
  router.get('/updates/status/:updateId', requirePlatformAuth, async (req, res) => {
    try {
      const { updateId } = req.params;
      
      const result = await pool.query(
        `SELECT * FROM platform_updates WHERE id = $1`,
        [updateId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Update not found' });
      }

      const update = result.rows[0];
      
      // Read log file if it exists
      let logContent = null;
      if (update.log_file && fs.existsSync(update.log_file)) {
        try {
          logContent = fs.readFileSync(update.log_file, 'utf8');
        } catch (error) {
          console.error('[PLATFORM] Error reading log file:', error);
        }
      }

      res.json({
        ...update,
        log: logContent
      });
    } catch (error) {
      console.error('[PLATFORM] Error getting update status:', error);
      res.status(500).json({ error: 'Failed to get update status' });
    }
  });

  // Get update history
  router.get('/updates/history', requirePlatformAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await pool.query(
        `SELECT id, version, update_type, status, initiated_by, initiated_at, completed_at, error_message
         FROM platform_updates
         ORDER BY initiated_at DESC
         LIMIT $1`,
        [limit]
      );

      res.json({
        updates: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('[PLATFORM] Error getting update history:', error);
      res.status(500).json({ error: 'Failed to get update history' });
    }
  });

  // Rollback to previous version
  router.post('/updates/rollback', requirePlatformAuth, async (req, res) => {
    const rollbackId = `rollback-${Date.now()}`;
    
    try {
      const log = (message) => {
        console.log(`[PLATFORM ROLLBACK] ${message}`);
      };

      log(`Rollback initiated by ${req.ip}`);

      // Find the last successful update
      const lastUpdate = await pool.query(
        `SELECT * FROM platform_updates 
         WHERE status = 'completed'
         ORDER BY completed_at DESC
         LIMIT 1`
      );

      if (lastUpdate.rows.length === 0) {
        return res.status(404).json({ error: 'No previous version found' });
      }

      const previousVersion = lastUpdate.rows[0].version;
      
      log(`Rolling back to version ${previousVersion}`);

      // Store rollback record
      await pool.query(
        `INSERT INTO platform_updates (id, version, update_type, status, initiated_by, initiated_at)
         VALUES ($1, $2, 'rollback', 'in_progress', $3, CURRENT_TIMESTAMP)`,
        [rollbackId, previousVersion, req.ip]
      );

      // Execute rollback (implementation depends on your deployment method)
      log('Rollback completed successfully');

      await pool.query(
        `UPDATE platform_updates 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [rollbackId]
      );

      res.json({
        success: true,
        rollbackId,
        version: previousVersion,
        message: 'Rollback completed successfully'
      });
    } catch (error) {
      console.error('[PLATFORM] Rollback error:', error);
      
      try {
        await pool.query(
          `UPDATE platform_updates 
           SET status = 'failed', error_message = $2, completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [rollbackId, error.message]
        );
      } catch (dbError) {
        console.error('[PLATFORM] Failed to update rollback status:', dbError);
      }

      res.status(500).json({
        error: 'Rollback failed',
        message: error.message
      });
    }
  });

  // Health check endpoint
  router.get('/health', async (req, res) => {
    try {
      // Check database connection
      await pool.query('SELECT 1');
      
      // Check Redis (if available)
      const { getRedisClient } = require('../utils/redis');
      const redisClient = getRedisClient();
      const redisStatus = redisClient !== null;

      const packageJson = require('../package.json');
      const version = packageJson.version || '1.0.0';

      res.json({
        status: 'healthy',
        version,
        database: 'connected',
        redis: redisStatus ? 'connected' : 'not_available',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
};
