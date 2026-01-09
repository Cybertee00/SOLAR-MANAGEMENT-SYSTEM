const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const { parseInventoryFromExcel, updateActualQtyInExcel, DEFAULT_INVENTORY_XLSX } = require('../utils/inventoryExcelSync');
const { v4: uuidv4 } = require('uuid');

module.exports = (pool) => {
  const router = express.Router();

  // Automatic Excel -> DB sync (safe, only runs when Excel file changes)
  // This makes "Sync from Excel" effectively automatic for all users.
  let lastSyncedMtimeMs = null;
  let syncInFlight = null;

  async function syncInventoryFromExcel() {
    const parsed = await parseInventoryFromExcel();
    const items = parsed.items || [];

    let upserts = 0;
    for (const item of items) {
      await pool.query(
        `INSERT INTO inventory_items (section, item_code, item_description, part_type, min_level, actual_qty)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (item_code) DO UPDATE SET
           section = EXCLUDED.section,
           item_description = EXCLUDED.item_description,
           part_type = EXCLUDED.part_type,
           min_level = EXCLUDED.min_level,
           -- IMPORTANT: actual_qty stays in sync with Excel as the "source"
           actual_qty = EXCLUDED.actual_qty,
           updated_at = CURRENT_TIMESTAMP`,
        [item.section || null, item.item_code, item.item_description || null, item.part_type || null, item.min_level || 0, item.actual_qty || 0]
      );
      upserts++;
    }

    return { message: 'Imported inventory from Excel', items: upserts, file: parsed.filePath };
  }

  async function ensureInventorySyncedIfNeeded() {
    // Default: enabled (user requested automatic sync). Can be disabled via env if ever needed.
    const enabled = String(process.env.INVENTORY_AUTO_SYNC ?? 'true').toLowerCase() !== 'false';
    if (!enabled) return;

    let stat;
    try {
      stat = fs.statSync(DEFAULT_INVENTORY_XLSX);
    } catch (e) {
      // If file missing/unreadable, don't block inventory reads; existing DB data still works.
      return;
    }

    const mtimeMs = stat.mtimeMs;
    if (lastSyncedMtimeMs !== null && mtimeMs <= lastSyncedMtimeMs) return;

    if (!syncInFlight) {
      syncInFlight = (async () => {
        try {
          await syncInventoryFromExcel();
          lastSyncedMtimeMs = mtimeMs;
        } finally {
          syncInFlight = null;
        }
      })();
    }

    await syncInFlight;
  }

  // List inventory items
  router.get('/items', requireAuth, async (req, res) => {
    try {
      await ensureInventorySyncedIfNeeded();
      const lowStock = String(req.query.low_stock || '').toLowerCase() === 'true';
      const q = String(req.query.q || '').trim();

      const params = [];
      let where = 'WHERE 1=1';
      if (lowStock) where += ' AND actual_qty <= min_level';
      if (q) {
        params.push(`%${q}%`);
        // Search by section number OR description (not item_code)
        where += ` AND (item_description ILIKE $${params.length} OR section ILIKE $${params.length})`;
      }

      const result = await pool.query(
        `SELECT * FROM inventory_items ${where} ORDER BY section NULLS LAST, item_code`,
        params
      );
      
      // Remove the last 14 items from the list (they are not supposed to be counted as spares)
      const items = result.rows;
      const filteredItems = items.length > 14 ? items.slice(0, items.length - 14) : items;
      
      res.json(filteredItems);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch inventory items', details: e.message });
    }
  });

  // Import/refresh items from Excel (admin only)
  router.post('/import', requireAdmin, async (req, res) => {
    try {
      const out = await syncInventoryFromExcel();
      // Also update the mtime checkpoint so GET /items won't immediately re-sync.
      try {
        const stat = fs.statSync(DEFAULT_INVENTORY_XLSX);
        lastSyncedMtimeMs = stat.mtimeMs;
      } catch (e) {
        // ignore
      }
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: 'Failed to import inventory from Excel', details: e.message });
    }
  });

  // Admin: restock/adjust (updates DB + writes back only Actual Qty in Excel)
  router.post('/adjust', requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const { item_code, qty_change, note, tx_type } = req.body || {};
      if (!item_code) return res.status(400).json({ error: 'item_code is required' });
      const delta = parseInt(qty_change, 10);
      if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'qty_change must be a non-zero integer' });

      await client.query('BEGIN');
      const itemRes = await client.query('SELECT * FROM inventory_items WHERE item_code = $1 FOR UPDATE', [item_code]);
      if (itemRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const item = itemRes.rows[0];
      const newQty = (item.actual_qty || 0) + delta;
      if (newQty < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient stock', available: item.actual_qty, requested_change: delta });
      }

      await client.query(
        `UPDATE inventory_items SET actual_qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newQty, item.id]
      );

      await client.query(
        `INSERT INTO inventory_transactions (item_id, tx_type, qty_change, note, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.id, tx_type || (delta > 0 ? 'restock' : 'adjust'), delta, note || null, req.session.userId || null]
      );

      await client.query('COMMIT');

      // Sync to Excel (only Actual Qty changes)
      await updateActualQtyInExcel({ [item_code]: newQty });

      res.json({ item_code, actual_qty: newQty });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Failed to adjust inventory', details: e.message });
    } finally {
      client.release();
    }
  });

  // Consume spares for a task (technician/admin). Creates a slip + transactions.
  // Body: { task_id, items: [{ item_code, qty_used }] }
  router.post('/consume', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const { task_id, items } = req.body || {};
      if (!task_id) return res.status(400).json({ error: 'task_id is required' });
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items[] is required' });

      await client.query('BEGIN');

      const slipNo = `SLIP-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
      const slipRes = await client.query(
        `INSERT INTO inventory_slips (slip_no, task_id, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [slipNo, task_id, req.session.userId || null]
      );
      const slip = slipRes.rows[0];

      const updates = {};

      for (const line of items) {
        const code = String(line.item_code || '').trim();
        const qty = parseInt(line.qty_used, 10);
        if (!code || !Number.isFinite(qty) || qty <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Each item must have item_code and qty_used > 0' });
        }

        const itemRes = await client.query(
          'SELECT * FROM inventory_items WHERE item_code = $1 FOR UPDATE',
          [code]
        );
        if (itemRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `Inventory item not found: ${code}` });
        }

        const item = itemRes.rows[0];
        const available = item.actual_qty || 0;
        if (available - qty < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Insufficient stock for ${code}`, available, requested: qty });
        }

        const newQty = available - qty;
        await client.query('UPDATE inventory_items SET actual_qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newQty, item.id]);

        await client.query(
          `INSERT INTO inventory_slip_lines (slip_id, item_id, item_code_snapshot, item_description_snapshot, qty_used)
           VALUES ($1, $2, $3, $4, $5)`,
          [slip.id, item.id, item.item_code, item.item_description, qty]
        );

        await client.query(
          `INSERT INTO inventory_transactions (item_id, task_id, slip_id, tx_type, qty_change, created_by)
           VALUES ($1, $2, $3, 'use', $4, $5)`,
          [item.id, task_id, slip.id, -qty, req.session.userId || null]
        );

        updates[code] = newQty;
      }

      await client.query('COMMIT');

      // Sync Excel Actual Qty
      await updateActualQtyInExcel(updates);

      res.status(201).json({ slip, updated_items: updates });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Failed to consume spares', details: e.message });
    } finally {
      client.release();
    }
  });

  // List slips
  router.get('/slips', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT s.*, u.full_name as created_by_name
         FROM inventory_slips s
         LEFT JOIN users u ON s.created_by = u.id
         ORDER BY s.created_at DESC
         LIMIT 200`
      );
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch slips', details: e.message });
    }
  });

  router.get('/slips/:id', requireAuth, async (req, res) => {
    try {
      const slipRes = await pool.query('SELECT * FROM inventory_slips WHERE id = $1', [req.params.id]);
      if (slipRes.rows.length === 0) return res.status(404).json({ error: 'Slip not found' });
      const linesRes = await pool.query('SELECT * FROM inventory_slip_lines WHERE slip_id = $1 ORDER BY created_at ASC', [req.params.id]);
      res.json({ slip: slipRes.rows[0], lines: linesRes.rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch slip', details: e.message });
    }
  });

  // Get spares usage with time period filter (daily, weekly, monthly)
  router.get('/usage', requireAuth, async (req, res) => {
    try {
      const period = String(req.query.period || 'monthly').toLowerCase(); // daily, weekly, monthly
      
      let dateFilter = '';
      const params = [];
      
      switch (period) {
        case 'daily':
          dateFilter = 'WHERE DATE(t.created_at) = CURRENT_DATE';
          break;
        case 'weekly':
          dateFilter = 'WHERE t.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
          break;
        case 'monthly':
          dateFilter = 'WHERE t.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
          break;
        default:
          dateFilter = 'WHERE t.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
      }

      const result = await pool.query(
        `SELECT 
          i.section,
          i.item_code,
          i.item_description,
          SUM(ABS(t.qty_change)) as total_qty_used,
          COUNT(DISTINCT t.slip_id) as usage_count,
          MAX(t.created_at) as last_used_at
         FROM inventory_transactions t
         INNER JOIN inventory_items i ON t.item_id = i.id
         INNER JOIN inventory_slips s ON t.slip_id = s.id
         ${dateFilter}
         AND t.tx_type = 'use'
         GROUP BY i.section, i.item_code, i.item_description
         ORDER BY total_qty_used DESC, i.section, i.item_code
         LIMIT 500`,
        params
      );

      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch spares usage', details: e.message });
    }
  });

  return router;
};


