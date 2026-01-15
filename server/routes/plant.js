const express = require('express');
const path = require('path');
const fs = require('fs');
const { parsePlantMap } = require('../utils/plantMapParser');
const { requireAuth, requireAdmin, isAdmin, isSuperAdmin } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

module.exports = (pool) => {
  const router = express.Router();

  // Get parsed plant map data (from Excel - legacy)
  router.get('/map-data', async (req, res) => {
    try {
      console.log('[PLANT] Request received for /map-data');
      const mapData = await parsePlantMap();
      console.log(`[PLANT] Map data parsed successfully: ${mapData.cells.length} cells`);
      res.json(mapData);
    } catch (error) {
      console.error('[PLANT] Error getting map data:', error);
      console.error('[PLANT] Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to parse plant map', details: error.message });
    }
  });

  // Get plant map structure from database
  router.get('/structure', async (req, res) => {
    try {
      console.log('[PLANT] Request received for /structure');
      const result = await pool.query(`
        SELECT structure_data, version, updated_at
        FROM plant_map_structure
        ORDER BY version DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0 || !result.rows[0].structure_data || result.rows[0].structure_data.length === 0) {
        console.log('[PLANT] No structure found in database, returning empty array');
        return res.json({ structure: [], version: 0 });
      }
      
      // structure_data is already a JSON object (not a string) because it's JSONB
      let structure = result.rows[0].structure_data;
      
      // If it's a string, parse it
      if (typeof structure === 'string') {
        try {
          structure = JSON.parse(structure);
        } catch (e) {
          console.error('[PLANT] Error parsing structure_data:', e);
          return res.json({ structure: [], version: 0 });
        }
      }
      
      const version = result.rows[0].version;
      console.log(`[PLANT] Returning structure with ${Array.isArray(structure) ? structure.length : 0} trackers, version ${version}`);
      
      res.json({ structure: Array.isArray(structure) ? structure : [], version });
    } catch (error) {
      console.error('[PLANT] Error getting structure:', error);
      res.status(500).json({ error: 'Failed to get plant map structure', details: error.message });
    }
  });

  // Save plant map structure to database
  router.post('/structure', async (req, res) => {
    try {
      const { structure } = req.body;
      
      if (!Array.isArray(structure)) {
        return res.status(400).json({ error: 'Structure must be an array' });
      }
      
      console.log(`[PLANT] Saving structure with ${structure.length} trackers`);
      
      // Get current version
      const currentResult = await pool.query(`
        SELECT version FROM plant_map_structure ORDER BY version DESC LIMIT 1
      `);
      
      const newVersion = currentResult.rows.length > 0 
        ? currentResult.rows[0].version + 1 
        : 1;
      
      // Insert new version
      await pool.query(`
        INSERT INTO plant_map_structure (structure_data, version)
        VALUES ($1, $2)
      `, [JSON.stringify(structure), newVersion]);
      
      console.log(`[PLANT] Structure saved successfully, version ${newVersion}`);
      
      res.json({ success: true, version: newVersion, count: structure.length });
    } catch (error) {
      console.error('[PLANT] Error saving structure:', error);
      res.status(500).json({ error: 'Failed to save plant map structure', details: error.message });
    }
  });

  // Serve the grasscutting Excel file
  router.get('/grasscutting.xlsx', (req, res) => {
    try {
      const filePath = path.join(__dirname, '../plant/grasscutting.xlsx');
      
      // Security check: prevent directory traversal
      const resolvedPath = path.resolve(filePath);
      const plantDir = path.resolve(__dirname, '../plant');
      
      if (!resolvedPath.startsWith(plantDir)) {
        console.error('[PLANT] Directory traversal blocked');
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('[PLANT] File not found:', filePath);
        return res.status(404).json({ error: 'Plant file not found' });
      }
      
      // Set headers for Excel file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'inline; filename="grasscutting.xlsx"');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (err) => {
        console.error('[PLANT] Error streaming file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error reading plant file' });
        }
      });
    } catch (error) {
      console.error('[PLANT] Error serving plant file:', error);
      res.status(500).json({ error: 'Failed to serve plant file' });
    }
  });

  // ============================================
  // TRACKER STATUS REQUEST ENDPOINTS
  // ============================================

  // Submit tracker status request (any authenticated user)
  router.post('/tracker-status-request', requireAuth, async (req, res) => {
    try {
      const { tracker_ids, task_type, status_type, message } = req.body;
      const userId = req.session.userId;

      console.log('[PLANT] Tracker status request received:', {
        userId,
        tracker_ids,
        task_type,
        status_type,
        hasSession: !!req.session,
        sessionUserId: req.session?.userId
      });

      // Check if user is authenticated
      if (!userId) {
        console.error('[PLANT] No userId in session');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Validation
      if (!Array.isArray(tracker_ids) || tracker_ids.length === 0) {
        return res.status(400).json({ error: 'tracker_ids must be a non-empty array' });
      }
      if (!['grass_cutting', 'panel_wash'].includes(task_type)) {
        return res.status(400).json({ error: 'task_type must be "grass_cutting" or "panel_wash"' });
      }
      if (!['done', 'halfway'].includes(status_type)) {
        return res.status(400).json({ error: 'status_type must be "done" or "halfway"' });
      }

      // Get user info
      const userResult = await pool.query('SELECT full_name, username FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        console.error('[PLANT] User not found in database:', userId);
        return res.status(404).json({ error: 'User not found' });
      }
      const user = userResult.rows[0];

      // Create request
      // Note: tracker_ids is a TEXT[] array in PostgreSQL, so we pass it as an array
      const result = await pool.query(
        `INSERT INTO tracker_status_requests (user_id, tracker_ids, task_type, status_type, message, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [userId, tracker_ids, task_type, status_type, message || null]
      );

      const request = result.rows[0];

      // Get all admins and super admins
      const adminsResult = await pool.query(
        `SELECT id, full_name, username FROM users 
         WHERE (role IN ('admin', 'super_admin') 
            OR (roles IS NOT NULL AND (roles::text LIKE '%admin%' OR roles::text LIKE '%super_admin%')))
         AND is_active = true`
      );

      // Create notifications for all admins/super admins
      const statusText = status_type === 'done' ? 'completed' : 'halfway done';
      const taskText = task_type === 'grass_cutting' ? 'Grass Cutting' : 'Panel Wash';
      const title = `Tracker Status Request - ${taskText}`;
      const messageText = `${user.full_name || user.username} has marked ${tracker_ids.length} tracker(s) as ${statusText} for ${taskText}. Trackers: ${tracker_ids.join(', ')}`;

      for (const admin of adminsResult.rows) {
        await createNotification(pool, {
          user_id: admin.id,
          type: 'tracker_status_request',
          title: title,
          message: messageText,
          metadata: {
            request_id: request.id,
            tracker_ids: tracker_ids,
            task_type: task_type,
            status_type: status_type,
            requested_by: {
              id: userId,
              full_name: user.full_name,
              username: user.username
            },
            message: message || null
          }
        });
      }

      console.log(`[PLANT] ✅ Tracker status request created: ${request.id} by user ${userId}`);
      res.json({ success: true, request: request });
    } catch (error) {
      console.error('[PLANT] ❌ Error creating tracker status request:', error);
      console.error('[PLANT] Error name:', error.name);
      console.error('[PLANT] Error message:', error.message);
      console.error('[PLANT] Error code:', error.code);
      console.error('[PLANT] Error detail:', error.detail);
      console.error('[PLANT] Error stack:', error.stack);
      console.error('[PLANT] Request details:', {
        userId: req.session?.userId,
        hasSession: !!req.session,
        sessionId: req.sessionID,
        body: req.body
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create tracker status request';
      if (error.code === '42P01') {
        errorMessage = 'Database table does not exist. Please run the migration.';
      } else if (error.code === '42703') {
        errorMessage = 'Database column does not exist. Please check the migration.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ 
        error: errorMessage, 
        details: error.detail || error.message,
        code: error.code
      });
    }
  });

  // Get pending tracker status requests (admin/superadmin only)
  router.get('/tracker-status-requests', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      // Check if user is admin or super admin
      const userResult = await pool.query(
        `SELECT role, roles FROM users WHERE id = $1`,
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      const userRoles = user.roles ? (typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles) : [user.role];
      const isAdminUser = userRoles.some(r => r === 'admin' || r === 'super_admin') || user.role === 'admin' || user.role === 'super_admin';

      if (!isAdminUser) {
        return res.status(403).json({ error: 'Only admins can view tracker status requests' });
      }

      const { status = 'pending' } = req.query;

      const result = await pool.query(
        `SELECT tsr.*, 
                u.full_name as user_full_name, 
                u.username as user_username,
                reviewer.full_name as reviewer_full_name,
                reviewer.username as reviewer_username
         FROM tracker_status_requests tsr
         LEFT JOIN users u ON tsr.user_id = u.id
         LEFT JOIN users reviewer ON tsr.reviewed_by = reviewer.id
         WHERE tsr.status = $1
         ORDER BY tsr.created_at DESC`,
        [status]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('[PLANT] Error fetching tracker status requests:', error);
      res.status(500).json({ error: 'Failed to fetch tracker status requests', details: error.message });
    }
  });

  // Approve or reject tracker status request (admin/superadmin only)
  router.patch('/tracker-status-request/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, rejection_reason } = req.body; // action: 'approve' or 'reject'
      const reviewerId = req.session.userId;

      console.log('[PLANT] Review request received:', {
        id,
        action,
        rejection_reason,
        reviewerId,
        body: req.body
      });

      if (!action) {
        return res.status(400).json({ error: 'action is required' });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'action must be "approve" or "reject"' });
      }

      // Check if user is admin or super admin
      const userResult = await pool.query(
        `SELECT role, roles FROM users WHERE id = $1`,
        [reviewerId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      const userRoles = user.roles ? (typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles) : [user.role];
      const isAdminUser = userRoles.some(r => r === 'admin' || r === 'super_admin') || user.role === 'admin' || user.role === 'super_admin';

      if (!isAdminUser) {
        return res.status(403).json({ error: 'Only admins can review tracker status requests' });
      }

      // Get the request
      const requestResult = await pool.query(
        `SELECT * FROM tracker_status_requests WHERE id = $1`,
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tracker status request not found' });
      }

      const request = requestResult.rows[0];

      if (request.status !== 'pending') {
        return res.status(400).json({ 
          error: 'Request has already been reviewed',
          current_status: request.status,
          reviewed_by: request.reviewed_by,
          reviewed_at: request.reviewed_at
        });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update request
      await pool.query(
        `UPDATE tracker_status_requests 
         SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, 
             rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newStatus, reviewerId, action === 'reject' ? (rejection_reason || null) : null, id]
      );

      // If approved, update the plant map structure
      if (action === 'approve') {
        // Get current structure
        const structureResult = await pool.query(
          `SELECT structure_data FROM plant_map_structure ORDER BY version DESC LIMIT 1`
        );

        if (structureResult.rows.length > 0 && structureResult.rows[0].structure_data) {
          let structure = structureResult.rows[0].structure_data;
          if (typeof structure === 'string') {
            structure = JSON.parse(structure);
          }

          // Update tracker colors based on status_type
          const colorKey = request.task_type === 'grass_cutting' ? 'grassCuttingColor' : 'panelWashColor';
          const doneColor = '#90EE90'; // Light green for done
          const halfwayColor = '#FFD700'; // Gold for halfway

          const newColor = request.status_type === 'done' ? doneColor : halfwayColor;

          structure.forEach(tracker => {
            if (request.tracker_ids.includes(tracker.id)) {
              tracker[colorKey] = newColor;
            }
          });

          // Save updated structure
          const currentVersionResult = await pool.query(
            `SELECT version FROM plant_map_structure ORDER BY version DESC LIMIT 1`
          );
          const newVersion = currentVersionResult.rows.length > 0 
            ? currentVersionResult.rows[0].version + 1 
            : 1;

          await pool.query(
            `INSERT INTO plant_map_structure (structure_data, version)
             VALUES ($1, $2)`,
            [JSON.stringify(structure), newVersion]
          );
        }
      }

      // Get requester info
      const requesterResult = await pool.query(
        'SELECT full_name, username FROM users WHERE id = $1',
        [request.user_id]
      );
      const requester = requesterResult.rows[0];

      // Notify the requester
      const statusText = action === 'approve' ? 'approved' : 'rejected';
      const taskText = request.task_type === 'grass_cutting' ? 'Grass Cutting' : 'Panel Wash';
      const statusTypeText = request.status_type === 'done' ? 'completed' : 'halfway done';
      const title = action === 'approve' 
        ? `Tracker Status ${statusText.charAt(0).toUpperCase() + statusText.slice(1)} - ${taskText}`
        : `Tracker Status Request Rejected - ${taskText}`;
      
      const notificationMessage = action === 'approve'
        ? `Your request to mark ${request.tracker_ids.length} tracker(s) as ${statusTypeText} for ${taskText} has been approved. Trackers: ${request.tracker_ids.join(', ')}`
        : `Your request to mark ${request.tracker_ids.length} tracker(s) as ${statusTypeText} for ${taskText} has been rejected.${rejection_reason ? ` Reason: ${rejection_reason}` : ''}`;

      await createNotification(pool, {
        user_id: request.user_id,
        type: `tracker_status_${statusText}`,
        title: title,
        message: notificationMessage,
        metadata: {
          request_id: id,
          tracker_ids: request.tracker_ids,
          task_type: request.task_type,
          status_type: request.status_type,
          action: action,
          rejection_reason: rejection_reason || null
        }
      });

      console.log(`[PLANT] Tracker status request ${id} ${statusText} by user ${reviewerId}`);
      res.json({ success: true, status: newStatus });
    } catch (error) {
      console.error('[PLANT] Error reviewing tracker status request:', error);
      res.status(500).json({ error: 'Failed to review tracker status request', details: error.message });
    }
  });

  return router;
};
