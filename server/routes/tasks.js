const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { mapTaskDataToTemplate } = require('../utils/dataMapper');
const { generateWordDocument } = require('../utils/wordGenerator');
const { generateExcelDocument } = require('../utils/excelGenerator');
const { emitEvent } = require('../utils/webhookEmitter');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateCreateTask } = require('../middleware/inputValidation');

module.exports = (pool) => {
  const router = express.Router();

  // Get all tasks (authenticated users can see their tasks, admins see all)
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { status, task_type, asset_id, completed_date } = req.query;
      let query = `
        SELECT t.*, 
               a.asset_code, a.asset_name,
               u.full_name as assigned_to_name,
               ct.template_name, ct.template_code
        FROM tasks t
        LEFT JOIN assets a ON t.asset_id = a.id
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN checklist_templates ct ON t.checklist_template_id = ct.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      // Non-admin users can only see tasks assigned to them
      if (req.session && req.session.role !== 'admin') {
        query += ` AND t.assigned_to = $${paramCount++}`;
        params.push(req.session.userId);
      }

      if (status) {
        query += ` AND t.status = $${paramCount++}`;
        params.push(status);
      }
      if (task_type) {
        query += ` AND t.task_type = $${paramCount++}`;
        params.push(task_type);
      }
      if (asset_id) {
        query += ` AND t.asset_id = $${paramCount++}`;
        params.push(asset_id);
      }
      if (completed_date) {
        query += ` AND t.completed_at IS NOT NULL AND DATE(t.completed_at) = $${paramCount++}`;
        params.push(completed_date);
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get task by ID
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.*, 
               a.asset_code, a.asset_name, a.asset_type,
               u.full_name as assigned_to_name,
               ct.*
        FROM tasks t
        LEFT JOIN assets a ON t.asset_id = a.id
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN checklist_templates ct ON t.checklist_template_id = ct.id
        WHERE t.id = $1
      `, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Parse JSONB fields if they exist
      const task = result.rows[0];
      if (task.checklist_structure && typeof task.checklist_structure === 'string') {
        task.checklist_structure = JSON.parse(task.checklist_structure);
      }
      if (task.validation_rules && typeof task.validation_rules === 'string') {
        task.validation_rules = JSON.parse(task.validation_rules);
      }
      if (task.cm_generation_rules && typeof task.cm_generation_rules === 'string') {
        task.cm_generation_rules = JSON.parse(task.cm_generation_rules);
      }
      
      res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create task (admin only)
  router.post('/', requireAdmin, validateCreateTask, async (req, res) => {
    try {
      const {
        checklist_template_id,
        asset_id,
        assigned_to,
        task_type,
        scheduled_date
      } = req.body;

      // Validate required fields
      if (!checklist_template_id) {
        return res.status(400).json({ error: 'checklist_template_id is required' });
      }
      if (!asset_id) {
        return res.status(400).json({ error: 'asset_id is required' });
      }

      const taskType = task_type || 'PM';
      
      // Validate task type
      const validTaskTypes = ['PM', 'PCM', 'UCM'];
      if (!validTaskTypes.includes(taskType)) {
        return res.status(400).json({ error: `task_type must be one of: ${validTaskTypes.join(', ')}` });
      }
      
      // PM tasks: Use current date as scheduled_date
      // PCM tasks: Use provided scheduled_date (required)
      // UCM tasks: scheduled_date is optional (can be set later)
      let finalScheduledDate;
      if (taskType === 'PM') {
        // PM tasks automatically get today's date
        finalScheduledDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      } else if (taskType === 'PCM') {
        // PCM tasks must have a scheduled_date provided
        if (!scheduled_date) {
          return res.status(400).json({ error: 'scheduled_date is required for PCM tasks' });
        }
        finalScheduledDate = scheduled_date;
      } else if (taskType === 'UCM') {
        // UCM tasks can have scheduled_date set later (optional for creation)
        finalScheduledDate = scheduled_date || null;
      } else {
        // Default to current date if task type is unknown
        finalScheduledDate = scheduled_date || new Date().toISOString().split('T')[0];
      }

      const task_code = `${taskType}-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const result = await pool.query(
        `INSERT INTO tasks (
          task_code, checklist_template_id, asset_id, assigned_to, task_type, scheduled_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
        [task_code, checklist_template_id, asset_id, assigned_to || null, taskType, finalScheduledDate]
      );
      
      console.log(`Task created: ${task_code}, Type: ${taskType}, Scheduled: ${finalScheduledDate}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating task:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint
      });
      
      // Provide more specific error messages
      if (error.code === '23503') {
        return res.status(400).json({ 
          error: 'Invalid reference', 
          details: 'The checklist_template_id or asset_id does not exist' 
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to create task',
        details: error.message 
      });
    }
  });

  // Start task
  router.patch('/:id/start', async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE tasks 
         SET status = 'in_progress', started_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND status = 'pending' 
         RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found or cannot be started' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error starting task:', error);
      res.status(500).json({ error: 'Failed to start task' });
    }
  });

  // Complete task
  router.patch('/:id/complete', requireAuth, async (req, res) => {
    try {
      const { overall_status, duration_minutes, cm_occurred_at, started_at, completed_at } = req.body;
      
      const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      if (taskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskResult.rows[0];
      
      // For UCM tasks, use provided timestamps or current time
      let finalStartedAt = started_at ? new Date(started_at) : (task.started_at ? new Date(task.started_at) : new Date());
      let finalCompletedAt = completed_at ? new Date(completed_at) : new Date();
      let finalCmOccurredAt = cm_occurred_at ? new Date(cm_occurred_at) : null;
      
      // For other task types, use current time if not provided
      if (task.task_type !== 'UCM') {
        finalStartedAt = task.started_at ? new Date(task.started_at) : new Date();
        finalCompletedAt = new Date();
      }
      
      const duration = duration_minutes || (finalStartedAt 
        ? Math.round((finalCompletedAt - finalStartedAt) / 60000)
        : null);

      // Build update query dynamically for UCM
      let updateFields = [
        'status = $1',
        'completed_at = $2',
        'overall_status = $3',
        'duration_minutes = $4'
      ];
      let updateValues = ['completed', finalCompletedAt, overall_status, duration];
      let paramCount = 5;

      // For UCM, update cm_occurred_at and started_at if provided
      if (task.task_type === 'UCM') {
        if (finalCmOccurredAt) {
          updateFields.push(`cm_occurred_at = $${paramCount++}`);
          updateValues.push(finalCmOccurredAt);
        }
        if (started_at) {
          updateFields.push(`started_at = $${paramCount++}`);
          updateValues.push(finalStartedAt);
        }
      }

      updateValues.push(req.params.id);
      const updateQuery = `UPDATE tasks 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount} 
         RETURNING *`;

      const result = await pool.query(updateQuery, updateValues);

      // If PM task failed, generate PCM task
      if (task.task_type === 'PM' && overall_status === 'fail' && task.checklist_template_id) {
        await generateCMTask(pool, task.id, task.checklist_template_id, task.asset_id);
      }

      // Webhook event: task completed
      emitEvent(pool, 'task.completed', {
        task_id: req.params.id,
        task_code: task.task_code,
        task_type: task.task_type,
        overall_status,
        completed_at: completedAt.toISOString()
      }).catch(() => {});

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error completing task:', error);
      res.status(500).json({ error: 'Failed to complete task' });
    }
  });

  // Generate report from template (Word or Excel)
  router.get('/:id/report', requireAuth, async (req, res) => {
    try {
      const taskId = req.params.id;
      const requestedFormat = req.query.format ? req.query.format.toLowerCase() : null; // Optional
      
      if (!taskId) {
        return res.status(400).json({ error: 'Task ID is required' });
      }

      if (requestedFormat && !['word', 'excel'].includes(requestedFormat)) {
        return res.status(400).json({ error: 'Invalid format. Must be "word" or "excel"' });
      }

      console.log(`Report request for task ID: ${taskId}, format: ${requestedFormat || 'auto'}`);

      // Get task details with location
      const taskResult = await pool.query(`
        SELECT t.*, 
               a.asset_code, a.asset_name, a.asset_type, a.location,
               u.full_name as assigned_to_name,
               ct.*
        FROM tasks t
        LEFT JOIN assets a ON t.asset_id = a.id
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN checklist_templates ct ON t.checklist_template_id = ct.id
        WHERE t.id = $1
      `, [taskId]);

      if (taskResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Task not found',
          requested_id: taskId
        });
      }

      const task = taskResult.rows[0];

      // Parse JSONB fields
      if (task.checklist_structure && typeof task.checklist_structure === 'string') {
        task.checklist_structure = JSON.parse(task.checklist_structure);
      }

      // Only allow report generation for completed tasks
      if (task.status !== 'completed') {
        return res.status(400).json({ 
          error: 'Report can only be generated for completed tasks',
          current_status: task.status 
        });
      }

      // Get checklist response with metadata
      const responseResult = await pool.query(
        `SELECT cr.*, u.full_name as submitted_by_name 
         FROM checklist_responses cr 
         LEFT JOIN users u ON cr.submitted_by = u.id 
         WHERE cr.task_id = $1 
         ORDER BY cr.submitted_at DESC LIMIT 1`,
        [taskId]
      );

      // Get failed item images for this task
      const imagesResult = await pool.query(
        'SELECT * FROM failed_item_images WHERE task_id = $1 ORDER BY uploaded_at ASC',
        [taskId]
      );
      const taskImages = imagesResult.rows;

      let checklistResponse = null;
      if (responseResult.rows.length > 0) {
        checklistResponse = responseResult.rows[0];
        // Parse JSONB response_data
        if (checklistResponse.response_data && typeof checklistResponse.response_data === 'string') {
          checklistResponse.response_data = JSON.parse(checklistResponse.response_data);
        }
      }

      // Map data to template format (format-agnostic)
      const templateData = mapTaskDataToTemplate(task, checklistResponse, taskImages);

      // Determine available template format automatically
      const templateCode = task.template_code || 'WS-PM-013';
      const assetType = task.asset_type || 'weather_station';

      // Probe availability
      const { getTemplatePath } = require('../utils/templateMapper');
      const wordPath = getTemplatePath('word', templateCode, assetType);
      const excelPath = getTemplatePath('excel', templateCode, assetType);

      // Decide final format:
      // 1) If client requested a format, ensure it's available, otherwise error.
      // 2) If no format requested, pick Word if available, else Excel, else error.
      let finalFormat = null;
      if (requestedFormat) {
        if (requestedFormat === 'word' && wordPath) finalFormat = 'word';
        else if (requestedFormat === 'excel' && excelPath) finalFormat = 'excel';
        else {
          return res.status(400).json({
            error: `Requested format '${requestedFormat}' not available for this template`,
            available: {
              word: !!wordPath,
              excel: !!excelPath
            }
          });
        }
      } else {
        if (wordPath) finalFormat = 'word';
        else if (excelPath) finalFormat = 'excel';
        else {
          return res.status(404).json({
            error: 'No template found for this task',
            template_code: templateCode,
            asset_type: assetType
          });
        }
      }

      // Generate document based on resolved format
      let documentBuffer;
      let fileExtension;
      let contentType;

      if (finalFormat === 'word') {
        documentBuffer = generateWordDocument(templateData, templateCode, assetType);
        fileExtension = 'docx';
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else {
        documentBuffer = await generateExcelDocument(templateData, templateCode, assetType);
        fileExtension = 'xlsx';
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      // Generate filename
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Task_${task.task_code}_${dateStr}.${fileExtension}`;
      
      // Save to server's reports directory: D:\PJs\ChecksheetsApp\server\reports\
      const fs = require('fs');
      const path = require('path');
      const reportsDir = path.join(__dirname, '../reports');
      
      // Ensure the reports directory exists
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
        console.log('Created reports directory:', reportsDir);
      }
      
      // Save file to server - ALL REPORTS MUST BE SAVED HERE
      const filePath = path.join(reportsDir, filename);
      try {
        fs.writeFileSync(filePath, documentBuffer);
        console.log(`✓ ${finalFormat.toUpperCase()} REPORT SAVED TO: ${filePath}`);
        console.log(`  Full path: ${path.resolve(filePath)}`);
      } catch (saveError) {
        console.error(`Error saving ${finalFormat} report to server:`, saveError);
        // Continue even if save fails - still send to browser
      }

      // Webhook event: report generated
      emitEvent(pool, 'report.generated', {
        task_id: taskId,
        task_code: task.task_code,
        format: finalFormat,
        filename,
        saved_path: filePath
      }).catch(() => {});

      // Send document to browser for download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', documentBuffer.length);

      res.send(documentBuffer);
    } catch (error) {
      console.error(`Error generating ${req.query.format || 'auto'} report:`, error);
      res.status(500).json({ 
        error: `Failed to generate ${req.query.format || 'auto'} report`, 
        details: error.message 
      });
    }
  });

  return router;
};

// Helper function to generate CM task from failed PM
async function generateCMTask(pool, pmTaskId, checklistTemplateId, assetId) {
  try {
    // Get checklist template to find CM generation rules
    const templateResult = await pool.query(
      'SELECT cm_generation_rules FROM checklist_templates WHERE id = $1',
      [checklistTemplateId]
    );

    if (templateResult.rows.length === 0) return;

    const cmRules = templateResult.rows[0].cm_generation_rules;
    if (!cmRules || !cmRules.auto_generate) return;

    // Get the PM task details
    const pmTaskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [pmTaskId]
    );
    const pmTask = pmTaskResult.rows[0];

    // Find CM template for the same asset type
    const cmTemplateResult = await pool.query(
      `SELECT * FROM checklist_templates 
       WHERE asset_type = (SELECT asset_type FROM assets WHERE id = $1) 
       AND task_type IN ('PCM', 'UCM') 
       LIMIT 1`,
      [assetId]
    );

    const cmTemplateId = cmTemplateResult.rows.length > 0 
      ? cmTemplateResult.rows[0].id 
      : checklistTemplateId; // Fallback to PM template if no CM template exists

    const taskCode = `CM-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create CM task
    const cmTaskResult = await pool.query(
      `INSERT INTO tasks (
        task_code, checklist_template_id, asset_id, task_type, 
        status, parent_task_id, scheduled_date
      ) VALUES ($1, $2, $3, 'PCM', 'pending', $4, CURRENT_DATE) RETURNING *`,
      [taskCode, cmTemplateId, assetId, pmTaskId]
    );

    const cmTask = cmTaskResult.rows[0];

    // Generate CM letter
    const letterNumber = `CM-LTR-${Date.now()}`;
    await pool.query(
      `INSERT INTO cm_letters (
        task_id, parent_pm_task_id, letter_number, asset_id,
        issue_description, priority, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
      [
        cmTask.id,
        pmTaskId,
        letterNumber,
        assetId,
        `Corrective maintenance required due to failed PM task: ${pmTask.task_code}`,
        cmRules.default_priority || 'medium',
      ]
    );

    console.log(`CM task ${cmTask.task_code} generated from failed PM task ${pmTask.task_code}`);
  } catch (error) {
    console.error('Error generating CM task:', error);
  }
}

