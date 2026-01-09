const express = require('express');
const { requireAuth, requireAdmin, isTechnician } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { updateActualQtyInExcel } = require('../utils/inventoryExcelSync');

module.exports = (pool) => {
  const router = express.Router();

  // Get all spare requests (admin/super_admin see all, technicians see their own)
  router.get('/', requireAuth, async (req, res) => {
    try {
      // Check if table exists first (for graceful error handling)
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'spare_requests'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.error('spare_requests table does not exist. Please run migration: add_role_system_and_spare_requests.sql');
        return res.status(500).json({ 
          error: 'Database schema not up to date. Please run migration: add_role_system_and_spare_requests.sql' 
        });
      }

      let query = `
        SELECT sr.*,
               t.task_code, t.task_type, t.status as task_status,
               u1.full_name as requested_by_name,
               u2.full_name as approved_by_name,
               u3.full_name as rejected_by_name
        FROM spare_requests sr
        LEFT JOIN tasks t ON sr.task_id = t.id
        LEFT JOIN users u1 ON sr.requested_by = u1.id
        LEFT JOIN users u2 ON sr.approved_by = u2.id
        LEFT JOIN users u3 ON sr.rejected_by = u3.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      // Technicians can only see their own requests
      if (isTechnician(req)) {
        query += ` AND sr.requested_by = $${paramCount++}`;
        params.push(req.session.userId);
      }

      query += ' ORDER BY sr.requested_at DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching spare requests:', error);
      if (error.code === '42P01') {
        // Table does not exist
        return res.status(500).json({ 
          error: 'Database schema not up to date. Please run migration: add_role_system_and_spare_requests.sql',
          details: 'The spare_requests table does not exist. Run: node server/scripts/run-migration.js add_role_system_and_spare_requests.sql'
        });
      }
      res.status(500).json({ error: 'Failed to fetch spare requests' });
    }
  });

  // Get spare request by ID
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT sr.*,
               t.task_code, t.task_type, t.status as task_status,
               u1.full_name as requested_by_name,
               u2.full_name as approved_by_name,
               u3.full_name as rejected_by_name,
               json_agg(
                 json_build_object(
                   'id', sri.id,
                   'inventory_item_id', sri.inventory_item_id,
                   'item_code', sri.item_code,
                   'quantity', sri.quantity,
                   'approved_quantity', sri.approved_quantity,
                   'reason', sri.reason
                 )
               ) FILTER (WHERE sri.id IS NOT NULL) as items
        FROM spare_requests sr
        LEFT JOIN tasks t ON sr.task_id = t.id
        LEFT JOIN users u1 ON sr.requested_by = u1.id
        LEFT JOIN users u2 ON sr.approved_by = u2.id
        LEFT JOIN users u3 ON sr.rejected_by = u3.id
        LEFT JOIN spare_request_items sri ON sr.id = sri.spare_request_id
        WHERE sr.id = $1
        GROUP BY sr.id, t.task_code, t.task_type, t.status, u1.full_name, u2.full_name, u3.full_name
      `, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Spare request not found' });
      }

      const request = result.rows[0];

      // Technicians can only see their own requests
      if (isTechnician(req) && request.requested_by !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(request);
    } catch (error) {
      console.error('Error fetching spare request:', error);
      res.status(500).json({ error: 'Failed to fetch spare request' });
    }
  });

  // Create spare request (technicians can create requests)
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { task_id, requested_items, notes } = req.body;

      if (!task_id || !requested_items || !Array.isArray(requested_items) || requested_items.length === 0) {
        return res.status(400).json({ error: 'Task ID and requested items are required' });
      }

      // Verify task exists and is assigned to the user (for technicians)
      const taskResult = await pool.query('SELECT id, assigned_to, task_type, status FROM tasks WHERE id = $1', [task_id]);
      if (taskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskResult.rows[0];

      // Technicians can only request spares for their own tasks
      if (isTechnician(req) && task.assigned_to !== req.session.userId) {
        return res.status(403).json({ error: 'You can only request spares for your assigned tasks' });
      }

      // Technicians can only request spares for PM tasks (not use directly)
      if (isTechnician(req) && task.task_type !== 'PM') {
        return res.status(400).json({ error: 'Technicians can only request spares for PM tasks' });
      }

      // Check if there's already a pending request for this task
      const existingRequest = await pool.query(
        'SELECT id FROM spare_requests WHERE task_id = $1 AND status = $2',
        [task_id, 'pending']
      );
      if (existingRequest.rows.length > 0) {
        return res.status(400).json({ error: 'A pending spare request already exists for this task' });
      }

      // Create spare request
      const requestResult = await pool.query(`
        INSERT INTO spare_requests (task_id, requested_by, requested_items, notes, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
      `, [task_id, req.session.userId, JSON.stringify(requested_items), notes || null]);

      const spareRequest = requestResult.rows[0];

      // Create spare request items
      for (const item of requested_items) {
        // Get item_code from inventory_items if item_id is UUID
        let itemCode = item.item_code;
        if (!itemCode && item.item_id) {
          const invResult = await pool.query('SELECT item_code FROM inventory_items WHERE id = $1', [item.item_id]);
          if (invResult.rows.length > 0) {
            itemCode = invResult.rows[0].item_code;
          }
        }
        
        await pool.query(`
          INSERT INTO spare_request_items (spare_request_id, inventory_item_id, item_code, quantity, reason)
          VALUES ($1, $2, $3, $4, $5)
        `, [spareRequest.id, item.item_id, itemCode || null, item.quantity || 1, item.reason || null]);
      }

      res.status(201).json(spareRequest);
    } catch (error) {
      console.error('Error creating spare request:', error);
      res.status(500).json({ error: 'Failed to create spare request' });
    }
  });

  // Approve spare request (admin/super_admin only)
  // When approved, automatically deduct from inventory and create usage records
  router.post('/:id/approve', requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { approved_quantities } = req.body; // { item_id: quantity }

      const requestResult = await client.query('SELECT * FROM spare_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Spare request not found' });
      }

      const request = requestResult.rows[0];
      if (request.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Only pending requests can be approved' });
      }

      // Get all request items with their details
      const itemsResult = await client.query(`
        SELECT sri.*, i.item_code, i.item_description, i.actual_qty
        FROM spare_request_items sri
        LEFT JOIN inventory_items i ON sri.inventory_item_id = i.id
        WHERE sri.spare_request_id = $1
      `, [req.params.id]);

      if (itemsResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No items found in spare request' });
      }

      // Update approved quantities and deduct inventory
      const updates = {}; // For Excel sync: { item_code: new_qty }
      const slipNo = `SLIP-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
      
      // Create inventory slip for this spare request
      const slipRes = await client.query(`
        INSERT INTO inventory_slips (slip_no, task_id, created_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [slipNo, request.task_id, req.session.userId]);
      const slip = slipRes.rows[0];

      // Process each item
      for (const item of itemsResult.rows) {
        // Determine approved quantity
        let approvedQty = item.quantity; // Default to requested quantity
        
        if (approved_quantities) {
          // Check if this item has a specific approved quantity
          const itemIdKey = item.inventory_item_id || item.item_code;
          if (approved_quantities[item.inventory_item_id]) {
            approvedQty = parseInt(approved_quantities[item.inventory_item_id], 10);
          } else if (approved_quantities[item.item_code]) {
            approvedQty = parseInt(approved_quantities[item.item_code], 10);
          }
        }

        if (!Number.isFinite(approvedQty) || approvedQty <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid approved quantity for item ${item.item_code || item.inventory_item_id}` });
        }

        // Update approved_quantity in spare_request_items
        await client.query(`
          UPDATE spare_request_items
          SET approved_quantity = $1
          WHERE id = $2
        `, [approvedQty, item.id]);

        // Get current inventory item with lock
        const invItemResult = await client.query(`
          SELECT * FROM inventory_items 
          WHERE id = $1 OR item_code = $2
          FOR UPDATE
        `, [item.inventory_item_id, item.item_code]);

        if (invItemResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `Inventory item not found: ${item.item_code || item.inventory_item_id}` });
        }

        const invItem = invItemResult.rows[0];
        const available = invItem.actual_qty || 0;

        // Check if sufficient stock
        if (available < approvedQty) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: `Insufficient stock for ${invItem.item_code}`,
            available,
            requested: approvedQty
          });
        }

        // Deduct from inventory
        const newQty = available - approvedQty;
        await client.query(`
          UPDATE inventory_items 
          SET actual_qty = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [newQty, invItem.id]);

        // Create slip line
        await client.query(`
          INSERT INTO inventory_slip_lines (slip_id, item_id, item_code_snapshot, item_description_snapshot, qty_used)
          VALUES ($1, $2, $3, $4, $5)
        `, [slip.id, invItem.id, invItem.item_code, invItem.item_description, approvedQty]);

        // Create transaction record
        await client.query(`
          INSERT INTO inventory_transactions (item_id, task_id, slip_id, tx_type, qty_change, note, created_by)
          VALUES ($1, $2, $3, 'use', $4, $5, $6)
        `, [
          invItem.id,
          request.task_id,
          slip.id,
          -approvedQty,
          `Spare request approved: ${req.params.id}`,
          req.session.userId
        ]);

        updates[invItem.item_code] = newQty;
      }

      // Update spare request status to 'approved' (and mark as fulfilled since inventory is deducted)
      await client.query(`
        UPDATE spare_requests
        SET status = 'approved',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            fulfilled_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.session.userId, req.params.id]);

      await client.query('COMMIT');

      // Sync Excel Actual Qty (after transaction commits)
      try {
        await updateActualQtyInExcel(updates);
      } catch (excelError) {
        console.error('Error syncing to Excel (non-critical):', excelError);
        // Don't fail the request if Excel sync fails
      }

      // Get task details for notification (use pool since transaction is committed)
      const taskResult = await pool.query(
        `SELECT t.*, a.asset_name
         FROM tasks t
         LEFT JOIN assets a ON t.asset_id = a.id
         WHERE t.id = $1`,
        [request.task_id]
      );

      // Send notifications if this is a CM task
      if (taskResult.rows.length > 0) {
        const task = taskResult.rows[0];
        const isCMTask = task.task_type === 'PCM' || task.task_type === 'UCM' || 
                        (task.task_type === 'CM' && task.parent_task_id);
        
        if (isCMTask) {
          // Get approved items details (use pool since transaction is committed)
          const approvedItemsResult = await pool.query(
            `SELECT sri.*, i.item_code, i.item_description
             FROM spare_request_items sri
             LEFT JOIN inventory_items i ON sri.inventory_item_id = i.id
             WHERE sri.spare_request_id = $1`,
            [req.params.id]
          );

          const { notifySpareRequestApproved } = require('../utils/notifications');
          await notifySpareRequestApproved(
            pool,
            { ...request, status: 'approved' },
            task,
            approvedItemsResult.rows
          );
        }
      }

      res.json({ 
        message: 'Spare request approved and inventory deducted',
        slip_no: slipNo,
        updated_items: updates
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error approving spare request:', error);
      res.status(500).json({ error: 'Failed to approve spare request', details: error.message });
    } finally {
      client.release();
    }
  });

  // Reject spare request (admin/super_admin only)
  router.post('/:id/reject', requireAdmin, async (req, res) => {
    try {
      const { rejection_reason } = req.body;

      const requestResult = await pool.query('SELECT * FROM spare_requests WHERE id = $1', [req.params.id]);
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Spare request not found' });
      }

      const request = requestResult.rows[0];
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending requests can be rejected' });
      }

      await pool.query(`
        UPDATE spare_requests
        SET status = 'rejected',
            rejected_by = $1,
            rejected_at = CURRENT_TIMESTAMP,
            rejection_reason = $2
        WHERE id = $3
      `, [req.session.userId, rejection_reason || null, req.params.id]);

      res.json({ message: 'Spare request rejected' });
    } catch (error) {
      console.error('Error rejecting spare request:', error);
      res.status(500).json({ error: 'Failed to reject spare request' });
    }
  });

  // Note: The fulfill endpoint is no longer needed since approval automatically deducts inventory.
  // This endpoint is kept for backward compatibility but does nothing since approval handles everything.
  router.post('/:id/fulfill', requireAdmin, async (req, res) => {
    try {
      const requestResult = await pool.query('SELECT * FROM spare_requests WHERE id = $1', [req.params.id]);
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Spare request not found' });
      }

      const request = requestResult.rows[0];
      if (request.status === 'approved' && request.fulfilled_at) {
        // Already fulfilled during approval
        return res.json({ message: 'Spare request already fulfilled (inventory deducted during approval)' });
      }

      return res.status(400).json({ 
        error: 'Spare request must be approved first. Inventory is automatically deducted when approved.' 
      });
    } catch (error) {
      console.error('Error checking spare request:', error);
      res.status(500).json({ error: 'Failed to check spare request' });
    }
  });

  return router;
};
