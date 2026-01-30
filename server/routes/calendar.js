const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateYearCalendarExcel } = require('../utils/calendarExcelGenerator');

module.exports = (pool) => {
  const router = express.Router();

  // Get all calendar events for a date range
  router.get('/', requireAuth, async (req, res) => {
    try {
      // System owners without a selected company should see no calendar events
      const { isSystemOwnerWithoutCompany } = require('../utils/organizationFilter');
      if (isSystemOwnerWithoutCompany(req)) {
        return res.json([]);
      }
      
      // Get organization ID from request context (for explicit filtering)
      const { getOrganizationIdFromRequest } = require('../utils/organizationFilter');
      const organizationId = getOrganizationIdFromRequest(req);
      
      if (!organizationId) {
        return res.json([]);
      }
      
      const { start_date, end_date, year } = req.query;
      
      // Use getDb to ensure RLS is applied
      const { getDb } = require('../middleware/tenantContext');
      const db = getDb(req, pool);
      
      let query = 'SELECT * FROM calendar_events WHERE organization_id = $1';
      const params = [organizationId];
      let paramCount = 2;
      
      if (year) {
        query += ` AND EXTRACT(YEAR FROM event_date) = $${paramCount++}`;
        params.push(year);
      } else if (start_date && end_date) {
        query += ` AND event_date >= $${paramCount++} AND event_date <= $${paramCount++}`;
        params.push(start_date, end_date);
      } else if (start_date) {
        query += ` AND event_date >= $${paramCount++}`;
        params.push(start_date);
      }
      
      query += ' ORDER BY event_date, task_title';
      
      const result = await db.query(query, params);
      
      // Format dates properly (avoid UTC conversion that shifts days)
      const formatDate = (date) => {
        if (!date) return null;
        // Use local date parts to avoid timezone shift
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const events = result.rows.map(event => ({
        ...event,
        event_date: formatDate(event.event_date)
      }));
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  // Get calendar events for a specific date
  router.get('/date/:date', requireAuth, async (req, res) => {
    try {
      // System owners without a selected company should see no calendar events
      const { isSystemOwnerWithoutCompany, getOrganizationIdFromRequest } = require('../utils/organizationFilter');
      if (isSystemOwnerWithoutCompany(req)) {
        return res.json([]);
      }
      
      // Get organization ID from request context (for explicit filtering)
      const organizationId = getOrganizationIdFromRequest(req);
      if (!organizationId) {
        return res.json([]);
      }
      
      const { date } = req.params;
      
      // Use getDb to ensure RLS is applied
      const { getDb } = require('../middleware/tenantContext');
      const db = getDb(req, pool);
      
      // Explicitly filter by organization_id (backup to RLS)
      const result = await db.query(
        'SELECT * FROM calendar_events WHERE organization_id = $1 AND event_date = $2 ORDER BY task_title',
        [organizationId, date]
      );
      
      // Format dates properly (avoid UTC conversion that shifts days)
      const formatDate = (date) => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const events = result.rows.map(event => ({
        ...event,
        event_date: formatDate(event.event_date)
      }));
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching calendar events for date:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  // Create a new calendar event
  router.post('/', requireAuth, async (req, res) => {
    try {
      // System owners without a selected company cannot create calendar events
      const { isSystemOwnerWithoutCompany } = require('../utils/organizationFilter');
      if (isSystemOwnerWithoutCompany(req)) {
        return res.status(403).json({ error: 'Please select a company to create calendar events' });
      }
      
      const {
        event_date,
        task_title,
        procedure_code,
        description,
        task_id,
        checklist_template_id,
        asset_id,
        frequency
      } = req.body;

      if (!event_date || !task_title) {
        return res.status(400).json({ error: 'event_date and task_title are required' });
      }

      // Use getDb to ensure RLS is applied
      const { getDb } = require('../middleware/tenantContext');
      const db = getDb(req, pool);
      
      const result = await db.query(
        `INSERT INTO calendar_events 
         (event_date, task_title, procedure_code, description, task_id, checklist_template_id, asset_id, frequency, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          event_date,
          task_title,
          procedure_code || null,
          description || null,
          task_id || null,
          checklist_template_id || null,
          asset_id || null,
          frequency || null,
          req.session.userId
        ]
      );

      const event = result.rows[0];
      // Format date without UTC conversion
      const d = event.event_date;
      event.event_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  });

  // Update a calendar event
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      // System owners without a selected company cannot update calendar events
      const { isSystemOwnerWithoutCompany } = require('../utils/organizationFilter');
      if (isSystemOwnerWithoutCompany(req)) {
        return res.status(403).json({ error: 'Please select a company to update calendar events' });
      }
      
      const { id } = req.params;
      const {
        event_date,
        task_title,
        procedure_code,
        description,
        task_id,
        checklist_template_id,
        asset_id,
        frequency
      } = req.body;

      // Use getDb to ensure RLS is applied
      const { getDb } = require('../middleware/tenantContext');
      const db = getDb(req, pool);
      
      const result = await db.query(
        `UPDATE calendar_events 
         SET event_date = $1,
             task_title = $2,
             procedure_code = $3,
             description = $4,
             task_id = $5,
             checklist_template_id = $6,
             asset_id = $7,
             frequency = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [
          event_date,
          task_title,
          procedure_code || null,
          description || null,
          task_id || null,
          checklist_template_id || null,
          asset_id || null,
          frequency || null,
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Calendar event not found' });
      }

      const event = result.rows[0];
      // Format date without UTC conversion
      const d = event.event_date;
      event.event_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      res.json(event);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      res.status(500).json({ error: 'Failed to update calendar event' });
    }
  });

  // Delete a calendar event
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      // System owners without a selected company cannot delete calendar events
      const { isSystemOwnerWithoutCompany } = require('../utils/organizationFilter');
      if (isSystemOwnerWithoutCompany(req)) {
        return res.status(403).json({ error: 'Please select a company to delete calendar events' });
      }
      
      const { id } = req.params;
      
      // Use getDb to ensure RLS is applied
      const { getDb } = require('../middleware/tenantContext');
      const db = getDb(req, pool);
      
      const result = await db.query(
        'DELETE FROM calendar_events WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Calendar event not found' });
      }

      res.json({ message: 'Calendar event deleted successfully' });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      res.status(500).json({ error: 'Failed to delete calendar event' });
    }
  });

  // Download Year Calendar as Excel
  router.get('/download', requireAuth, async (req, res) => {
    try {
      const { year } = req.query;
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      
      const { buffer, filename } = await generateYearCalendarExcel(pool, targetYear);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Error downloading calendar Excel:', error);
      res.status(500).json({ error: 'Failed to generate calendar Excel file', details: error.message });
    }
  });

  return router;
};
