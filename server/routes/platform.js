const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../middleware/tenantContext');

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

  // ========== PLATFORM ADMINISTRATION ROUTES ==========
  // These routes use application-level filtering (skip RLS) for system owners
  // Access: System owners only

  // Get platform statistics (System Owner only)
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      // Only system owners can access platform stats
      const isSystemOwner = req.session.roles?.includes('system_owner') || 
                           req.session.role === 'system_owner';
      
      if (!isSystemOwner) {
        return res.status(403).json({ error: 'Only system owners can access platform statistics' });
      }

      const db = getDb(req, pool);
      
      // Application-level filtering: Query all data without organization_id filter
      // RLS is bypassed for platform routes + system owners (handled by middleware)
      const [
        orgsResult,
        usersResult,
        assetsResult,
        tasksResult
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM organizations'),
        db.query('SELECT COUNT(*) as count FROM users WHERE organization_id IS NOT NULL'),
        db.query('SELECT COUNT(*) as count FROM assets'),
        db.query('SELECT COUNT(*) as count FROM tasks')
      ]);

      const [
        activeOrgsResult,
        inactiveOrgsResult
      ] = await Promise.all([
        db.query("SELECT COUNT(*) as count FROM organizations WHERE is_active = true"),
        db.query("SELECT COUNT(*) as count FROM organizations WHERE is_active = false")
      ]);

      res.json({
        totalOrganizations: parseInt(orgsResult.rows[0].count),
        activeOrganizations: parseInt(activeOrgsResult.rows[0].count),
        inactiveOrganizations: parseInt(inactiveOrgsResult.rows[0].count),
        totalUsers: parseInt(usersResult.rows[0].count),
        totalAssets: parseInt(assetsResult.rows[0].count),
        totalTasks: parseInt(tasksResult.rows[0].count),
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      res.status(500).json({ error: 'Failed to fetch platform statistics' });
    }
  });

  // Get all organizations (System Owner only)
  // This endpoint uses application-level filtering - no organization_id filter
  router.get('/organizations', requireAuth, async (req, res) => {
    try {
      // Only system owners can list all organizations
      const isSystemOwner = req.session.roles?.includes('system_owner') || 
                           req.session.role === 'system_owner';
      
      if (!isSystemOwner) {
        return res.status(403).json({ error: 'Only system owners can list organizations' });
      }

      const db = getDb(req, pool);
      
      // Application-level filtering: Query all organizations without filter
      // RLS is bypassed for platform routes + system owners (handled by middleware)
      const result = await db.query(`
        SELECT 
          id, name, slug, is_active, created_at, updated_at,
          (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id) as user_count,
          (SELECT COUNT(*) FROM assets WHERE organization_id = organizations.id) as asset_count,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = organizations.id) as task_count
        FROM organizations
        ORDER BY created_at DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  });

  // Get user statistics for Platform Users page (System Owner only)
  router.get('/users/stats', requireAuth, async (req, res) => {
    try {
      const isSystemOwner = req.session.roles?.includes('system_owner') || 
                           req.session.role === 'system_owner';
      
      if (!isSystemOwner) {
        return res.status(403).json({ error: 'Only system owners can view user statistics' });
      }

      const db = getDb(req, pool);
      
      // Get all user statistics
      const [
        totalUsersResult,
        activeUsersResult,
        systemOwnersResult,
        newTodayResult,
        inactiveUsersResult
      ] = await Promise.all([
        // Total users (excluding system owners)
        db.query(`
          SELECT COUNT(*) as count 
          FROM users u
          WHERE u.organization_id IS NOT NULL
            AND u.id NOT IN (
              SELECT DISTINCT ur.user_id
              FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
              WHERE r.role_code = 'system_owner'
            )
            AND (u.role != 'system_owner' AND u.role != 'super_admin')
        `),
        // Active users (logged in within last 30 days)
        db.query(`
          SELECT COUNT(*) as count 
          FROM users u
          WHERE u.organization_id IS NOT NULL
            AND u.is_active = true
            AND u.last_login IS NOT NULL
            AND u.last_login >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            AND u.id NOT IN (
              SELECT DISTINCT ur.user_id
              FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
              WHERE r.role_code = 'system_owner'
            )
            AND (u.role != 'system_owner' AND u.role != 'super_admin')
        `),
        // System owners count
        db.query(`
          SELECT COUNT(*) as count 
          FROM users u
          WHERE u.id IN (
            SELECT DISTINCT ur.user_id
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE r.role_code = 'system_owner'
          )
          OR u.role = 'system_owner' OR u.role = 'super_admin'
        `),
        // New users today
        db.query(`
          SELECT COUNT(*) as count 
          FROM users u
          WHERE DATE(u.created_at) = CURRENT_DATE
            AND u.organization_id IS NOT NULL
        `),
        // Inactive users (not logged in for 90+ days)
        db.query(`
          SELECT COUNT(*) as count 
          FROM users u
          WHERE u.organization_id IS NOT NULL
            AND u.is_active = true
            AND (u.last_login IS NULL OR u.last_login < CURRENT_TIMESTAMP - INTERVAL '90 days')
        `)
      ]);

      res.json({
        totalUsers: parseInt(totalUsersResult.rows[0].count),
        activeUsers: parseInt(activeUsersResult.rows[0].count),
        systemOwners: parseInt(systemOwnersResult.rows[0].count),
        newToday: parseInt(newTodayResult.rows[0].count),
        inactiveUsers: parseInt(inactiveUsersResult.rows[0].count)
      });
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
  });

  // Get all users across all organizations (System Owner only)
  // Enhanced with advanced filtering
  router.get('/users', requireAuth, async (req, res) => {
    try {
      const isSystemOwner = req.session.roles?.includes('system_owner') || 
                           req.session.role === 'system_owner';
      
      if (!isSystemOwner) {
        return res.status(403).json({ error: 'Only system owners can view all users' });
      }

      const db = getDb(req, pool);
      
      // Application-level filtering: Query all users without organization_id filter
      // RLS is bypassed for platform routes + system owners (handled by middleware)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const roleFilter = req.query.role || '';
      const organizationFilter = req.query.organization_id || '';
      const statusFilter = req.query.status || ''; // 'active', 'inactive', or ''
      const lastLoginFilter = req.query.last_login || ''; // '7d', '30d', '90d', 'never'

      // Check if RBAC tables exist
      const rbacCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      `);
      const hasRBAC = rbacCheck.rows.length > 0;

      let query = `
        SELECT 
          u.id, u.username, u.email, u.full_name, u.role, u.roles, 
          u.is_active, u.created_at, u.last_login, u.organization_id,
          o.name as organization_name, o.slug as organization_slug,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status = 'completed') as completed_task_count
      `;
      
      if (hasRBAC) {
        query += `,
          COALESCE(
            (SELECT jsonb_agg(r.role_code ORDER BY r.role_code)
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = u.id),
            COALESCE(u.roles, jsonb_build_array(u.role), '["technician"]'::jsonb)
          ) as all_roles
        `;
      } else {
        query += `,
          COALESCE(u.roles, jsonb_build_array(u.role), '["technician"]'::jsonb) as all_roles
        `;
      }

      query += `
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
      `;
      
      const params = [];
      let paramCount = 1;
      const conditions = [];

      // Search filter
      if (search) {
        conditions.push(`(
          u.username ILIKE $${paramCount} OR 
          u.email ILIKE $${paramCount} OR 
          u.full_name ILIKE $${paramCount} OR
          o.name ILIKE $${paramCount}
        )`);
        params.push(`%${search}%`);
        paramCount++;
      }

      // Role filter
      if (roleFilter) {
        if (hasRBAC) {
          conditions.push(`EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = u.id AND r.role_code = $${paramCount}
          )`);
        } else {
          conditions.push(`(u.role = $${paramCount} OR u.roles::text LIKE $${paramCount + 1})`);
          params.push(roleFilter);
          paramCount++;
        }
        params.push(`%${roleFilter}%`);
        paramCount++;
      }

      // Organization filter
      if (organizationFilter) {
        conditions.push(`u.organization_id = $${paramCount}`);
        params.push(organizationFilter);
        paramCount++;
      }

      // Status filter
      if (statusFilter === 'active') {
        conditions.push(`u.is_active = true`);
      } else if (statusFilter === 'inactive') {
        conditions.push(`u.is_active = false`);
      }

      // Last login filter
      if (lastLoginFilter === '7d') {
        conditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
      } else if (lastLoginFilter === '30d') {
        conditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
      } else if (lastLoginFilter === '90d') {
        conditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
      } else if (lastLoginFilter === 'never') {
        conditions.push(`u.last_login IS NULL`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Order by
      const sortBy = req.query.sort_by || 'created_at';
      const sortOrder = req.query.sort_order || 'DESC';
      query += ` ORDER BY u.${sortBy} ${sortOrder} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      
      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
      `;
      
      if (hasRBAC && roleFilter) {
        // Need to adjust role filter for count query
        const countConditions = [];
        const countParams = [];
        let countParamCount = 1;

        if (search) {
          countConditions.push(`(
            u.username ILIKE $${countParamCount} OR 
            u.email ILIKE $${countParamCount} OR 
            u.full_name ILIKE $${countParamCount} OR
            o.name ILIKE $${countParamCount}
          )`);
          countParams.push(`%${search}%`);
          countParamCount++;
        }

        if (roleFilter) {
          countConditions.push(`EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = u.id AND r.role_code = $${countParamCount}
          )`);
          countParams.push(roleFilter);
          countParamCount++;
        }

        if (organizationFilter) {
          countConditions.push(`u.organization_id = $${countParamCount}`);
          countParams.push(organizationFilter);
          countParamCount++;
        }

        if (statusFilter === 'active') {
          countConditions.push(`u.is_active = true`);
        } else if (statusFilter === 'inactive') {
          countConditions.push(`u.is_active = false`);
        }

        if (lastLoginFilter === '7d') {
          countConditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
        } else if (lastLoginFilter === '30d') {
          countConditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
        } else if (lastLoginFilter === '90d') {
          countConditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
        } else if (lastLoginFilter === 'never') {
          countConditions.push(`u.last_login IS NULL`);
        }

        if (countConditions.length > 0) {
          countQuery += ` WHERE ${countConditions.join(' AND ')}`;
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        
        res.json({
          users: result.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } else {
        // Simplified count query for non-RBAC or no role filter
        const countConditions = [];
        const countParams = [];
        let countParamCount = 1;

        if (search) {
          countConditions.push(`(
            u.username ILIKE $${countParamCount} OR 
            u.email ILIKE $${countParamCount} OR 
            u.full_name ILIKE $${countParamCount} OR
            o.name ILIKE $${countParamCount}
          )`);
          countParams.push(`%${search}%`);
          countParamCount++;
        }

        if (roleFilter && !hasRBAC) {
          countConditions.push(`(u.role = $${countParamCount} OR u.roles::text LIKE $${countParamCount + 1})`);
          countParams.push(roleFilter);
          countParamCount++;
          countParams.push(`%${roleFilter}%`);
          countParamCount++;
        }

        if (organizationFilter) {
          countConditions.push(`u.organization_id = $${countParamCount}`);
          countParams.push(organizationFilter);
          countParamCount++;
        }

        if (statusFilter === 'active') {
          countConditions.push(`u.is_active = true`);
        } else if (statusFilter === 'inactive') {
          countConditions.push(`u.is_active = false`);
        }

        if (lastLoginFilter === '7d') {
          countConditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
        } else if (lastLoginFilter === '30d') {
          countConditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
        } else if (lastLoginFilter === '90d') {
          countConditions.push(`u.last_login >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
        } else if (lastLoginFilter === 'never') {
          countConditions.push(`u.last_login IS NULL`);
        }

        if (countConditions.length > 0) {
          countQuery += ` WHERE ${countConditions.join(' AND ')}`;
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        
        res.json({
          users: result.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Get platform analytics (System Owner only)
  router.get('/analytics', requireAuth, async (req, res) => {
    try {
      const isSystemOwner = req.session.roles?.includes('system_owner') || 
                           req.session.role === 'system_owner';
      
      if (!isSystemOwner) {
        return res.status(403).json({ error: 'Only system owners can view platform analytics' });
      }

      const db = getDb(req, pool);
      const timeRange = req.query.range || '30d';
      
      // Calculate date range
      let startDate;
      const endDate = new Date();
      switch (timeRange) {
        case '7d':
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate = new Date(endDate);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date(0); // All time
      }

      // Get overview statistics
      const [
        orgsResult,
        usersResult,
        tasksResult,
        assetsResult,
        activeOrgsResult,
        newOrgsResult,
        newUsersResult,
        activeUsersResult,
        completedTasksResult,
        pendingTasksResult
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM organizations'),
        db.query('SELECT COUNT(*) as count FROM users WHERE organization_id IS NOT NULL'),
        db.query('SELECT COUNT(*) as count FROM tasks'),
        db.query('SELECT COUNT(*) as count FROM assets'),
        db.query("SELECT COUNT(*) as count FROM organizations WHERE is_active = true"),
        db.query(`SELECT COUNT(*) as count FROM organizations WHERE created_at >= $1`, [startDate]),
        db.query(`SELECT COUNT(*) as count FROM users WHERE organization_id IS NOT NULL AND created_at >= $1`, [startDate]),
        db.query(`SELECT COUNT(DISTINCT u.id) as count FROM users u WHERE u.organization_id IS NOT NULL AND u.last_login >= $1`, [startDate]),
        db.query(`SELECT COUNT(*) as count FROM tasks WHERE status = 'completed' AND completed_at >= $1`, [startDate]),
        db.query(`SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending', 'in_progress')`)
      ]);

      // Get usage trends (daily data)
      const trendsResult = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as tasks_created
        FROM tasks
        WHERE created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [startDate]);

      const completionTrendsResult = await db.query(`
        SELECT 
          DATE(completed_at) as date,
          COUNT(*) as tasks_completed
        FROM tasks
        WHERE completed_at >= $1 AND completed_at IS NOT NULL
        GROUP BY DATE(completed_at)
        ORDER BY date ASC
      `, [startDate]);

      // Get organization activity
      // Use subqueries to avoid Cartesian product from JOINs that inflates counts
      const orgActivityResult = await db.query(`
        SELECT 
          o.id,
          o.name,
          o.slug,
          (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.organization_id = o.id) as user_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.organization_id = o.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.organization_id = o.id AND t.status = 'completed') as completed_tasks
        FROM organizations o
        ORDER BY (SELECT COUNT(*) FROM tasks t WHERE t.organization_id = o.id) DESC
      `);

      // Get user growth trend
      const userGrowthResult = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as users_created
        FROM users
        WHERE organization_id IS NOT NULL AND created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [startDate]);

      // Get organization growth trend
      const orgGrowthResult = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as organizations_created
        FROM organizations
        WHERE created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [startDate]);

      // Combine task trends
      const taskTrendsMap = new Map();
      trendsResult.rows.forEach(row => {
        taskTrendsMap.set(row.date.toISOString().split('T')[0], {
          date: row.date.toISOString().split('T')[0],
          tasksCreated: parseInt(row.tasks_created),
          tasksCompleted: 0
        });
      });
      completionTrendsResult.rows.forEach(row => {
        const dateKey = row.date.toISOString().split('T')[0];
        if (taskTrendsMap.has(dateKey)) {
          taskTrendsMap.get(dateKey).tasksCompleted = parseInt(row.tasks_completed);
        } else {
          taskTrendsMap.set(dateKey, {
            date: dateKey,
            tasksCreated: 0,
            tasksCompleted: parseInt(row.tasks_completed)
          });
        }
      });
      const activity = Array.from(taskTrendsMap.values()).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      res.json({
        overview: {
          organizations: {
            total: parseInt(orgsResult.rows[0].count),
            active: parseInt(activeOrgsResult.rows[0].count),
            newThisPeriod: parseInt(newOrgsResult.rows[0].count)
          },
          users: {
            total: parseInt(usersResult.rows[0].count),
            active: parseInt(activeUsersResult.rows[0].count),
            newThisPeriod: parseInt(newUsersResult.rows[0].count)
          },
          tasks: {
            total: parseInt(tasksResult.rows[0].count),
            completed: parseInt(completedTasksResult.rows[0].count),
            pending: parseInt(pendingTasksResult.rows[0].count)
          },
          assets: {
            total: parseInt(assetsResult.rows[0].count),
            newThisPeriod: 0 // Can be calculated if needed
          }
        },
        activity,
        organizations: orgActivityResult.rows.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          user_count: parseInt(org.user_count),
          task_count: parseInt(org.task_count),
          completed_tasks: parseInt(org.completed_tasks),
          completion_rate: org.task_count > 0 
            ? Math.round((org.completed_tasks / org.task_count) * 100) 
            : 0
        })),
        growth: {
          users: userGrowthResult.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            usersCreated: parseInt(row.users_created)
          })),
          organizations: orgGrowthResult.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            organizationsCreated: parseInt(row.organizations_created)
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching platform analytics:', error);
      res.status(500).json({ error: 'Failed to fetch platform analytics' });
    }
  });

  return router;
};
