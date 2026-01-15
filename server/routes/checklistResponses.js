const express = require('express');
const { body } = require('express-validator');
const { validateChecklistResponse } = require('../utils/validation');
const { v4: uuidv4 } = require('uuid');
const { validateUUID, validateJSONB, validateString, validateDateTime, handleValidationErrors, removeUnexpectedFields } = require('../middleware/inputValidation');
const { isTechnician, requireAuth } = require('../middleware/auth');
const { notifyTaskFlagged } = require('../utils/notifications');

module.exports = (pool) => {
  const router = express.Router();

  // Get all checklist responses
  router.get('/', async (req, res) => {
    try {
      const { task_id } = req.query;
      let query = `
        SELECT cr.*, 
               t.task_code, t.overall_status,
               u.full_name as submitted_by_name
        FROM checklist_responses cr
        LEFT JOIN tasks t ON cr.task_id = t.id
        LEFT JOIN users u ON cr.submitted_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (task_id) {
        query += ' AND cr.task_id = $1';
        params.push(task_id);
      }

      query += ' ORDER BY cr.submitted_at DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching checklist responses:', error);
      res.status(500).json({ error: 'Failed to fetch checklist responses' });
    }
  });

  // Get checklist response by ID
  router.get('/:id', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT cr.*, 
               t.task_code, t.overall_status,
               u.full_name as submitted_by_name
        FROM checklist_responses cr
        LEFT JOIN tasks t ON cr.task_id = t.id
        LEFT JOIN users u ON cr.submitted_by = u.id
        WHERE cr.id = $1
      `, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist response not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching checklist response:', error);
      res.status(500).json({ error: 'Failed to fetch checklist response' });
    }
  });

  // Submit checklist response
  // Input validation applied
  router.post('/', [
    removeUnexpectedFields([
      'task_id', 'checklist_template_id', 'response_data', 'submitted_by',
      'maintenance_team', 'inspected_by', 'approved_by', 'images',
      'spares_used', 'cm_occurred_at', 'started_at', 'completed_at'
    ]),
    validateUUID('task_id', 'body'),
    validateUUID('checklist_template_id', 'body'),
    validateJSONB('response_data'),
    validateUUID('submitted_by', 'body').optional(),
    validateString('maintenance_team', 255).optional(),
    validateString('inspected_by', 255).optional(),
    validateString('approved_by', 255).optional(),
    body('images')
      .optional()
      .isArray()
      .withMessage('Images must be an array'),
    body('spares_used')
      .optional()
      .isArray()
      .withMessage('Spares used must be an array'),
    validateDateTime('cm_occurred_at').optional(),
    validateDateTime('started_at').optional(),
    validateDateTime('completed_at').optional(),
    handleValidationErrors
  ], async (req, res) => {
    try {
      const { 
        task_id, 
        checklist_template_id, 
        response_data, 
        submitted_by,
        maintenance_team,
        inspected_by,
        approved_by,
        images,
        spares_used,
        hours_worked,
        cm_occurred_at,
        started_at,
        completed_at
      } = req.body;

      // Get task and template for validation
      const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [task_id]);
      if (taskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const templateResult = await pool.query(
        'SELECT * FROM checklist_templates WHERE id = $1',
        [checklist_template_id]
      );
      if (templateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist template not found' });
      }

      const template = templateResult.rows[0];
      const task = taskResult.rows[0];

      // Check if user is assigned to this task (admins/super_admins can submit any task)
      const role = req.session?.role;
      const isAdminOrSuperAdmin = role === 'admin' || role === 'super_admin';
      
      if (!isAdminOrSuperAdmin) {
        const assignmentCheck = await pool.query(
          `SELECT 1 FROM task_assignments WHERE task_id = $1 AND user_id = $2`,
          [task_id, req.session.userId]
        );
        
        if (assignmentCheck.rows.length === 0) {
          return res.status(403).json({ 
            error: 'You can only submit checklists for tasks assigned to you.' 
          });
        }
      }

      // Spares are now directly selected and automatically deducted - no restrictions

      // Parse JSONB fields if they're strings
      let checklistStructure = template.checklist_structure;
      let validationRules = template.validation_rules;
      
      if (typeof checklistStructure === 'string') {
        try {
          checklistStructure = JSON.parse(checklistStructure);
        } catch (e) {
          console.error('Error parsing checklist_structure:', e);
          return res.status(500).json({ error: 'Invalid checklist structure format' });
        }
      }
      
      if (validationRules && typeof validationRules === 'string') {
        try {
          validationRules = JSON.parse(validationRules);
        } catch (e) {
          console.error('Error parsing validation_rules:', e);
          // Validation rules are optional, so continue without them
        }
      }

      // Validate response using backend validation
      const validationResult = validateChecklistResponse(
        response_data,
        checklistStructure,
        validationRules
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.errors
        });
      }

      // Save response with metadata and spares_used (for PM tasks, spares are stored but not deducted until CM starts)
      const result = await pool.query(
        `INSERT INTO checklist_responses (
          task_id, checklist_template_id, response_data, submitted_by,
          maintenance_team, inspected_by, approved_by, spares_used
        ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
        [
          task_id, 
          checklist_template_id, 
          JSON.stringify(response_data), 
          submitted_by,
          maintenance_team || null,
          inspected_by || null,
          approved_by || null,
          spares_used && Array.isArray(spares_used) ? JSON.stringify(spares_used) : null
        ]
      );

      // Update task overall status based on validation
      const overallStatus = validationResult.overallStatus;
      
      // Update task with metadata
      if (maintenance_team || inspected_by || approved_by) {
        await pool.query(
          `UPDATE tasks 
           SET maintenance_team = COALESCE($1, maintenance_team),
               inspected_by = COALESCE($2, inspected_by),
               approved_by = COALESCE($3, approved_by),
               inspection_date = CURRENT_DATE,
               inspection_time = CURRENT_TIME
           WHERE id = $4`,
          [maintenance_team, inspected_by, approved_by, task_id]
        );
      }

      // Link images to CM letters if task failed
      if (overallStatus === 'fail') {
        // Get CM letter for this task (check if CM task was generated from this PM task)
        const cmLetterResult = await pool.query(
          `SELECT id FROM cm_letters 
           WHERE parent_pm_task_id = $1 
           OR task_id IN (SELECT id FROM tasks WHERE parent_task_id = $1)
           ORDER BY created_at DESC LIMIT 1`,
          [task_id]
        );
        
        if (cmLetterResult.rows.length > 0) {
          // Fetch all images from failed_item_images table for this task
          const failedImagesResult = await pool.query(
            `SELECT image_path, image_filename, item_id, section_id, comment 
             FROM failed_item_images 
             WHERE task_id = $1 
             ORDER BY uploaded_at ASC`,
            [task_id]
          );
          
          const failedImages = failedImagesResult.rows;
          
          // Also include images from the submission if any
          let allImages = [];
          
          // Add images from failed_item_images table (most reliable)
          if (failedImages.length > 0) {
            allImages = failedImages.map(img => ({
              path: img.image_path,
              filename: img.image_filename,
              item_id: img.item_id,
              section_id: img.section_id,
              comment: img.comment || ''
            }));
          }
          
          // Also add images from submission if they're not already in the list
          if (images && images.length > 0) {
            const existingPaths = new Set(allImages.map(img => img.path));
            images.forEach(img => {
              const imgPath = img.image_path || img.path;
              if (imgPath && !existingPaths.has(imgPath)) {
                allImages.push({
                  path: imgPath,
                  filename: img.image_filename || img.filename || imgPath.split('/').pop(),
                  item_id: img.itemId || img.item_id || img.sectionId?.split('_')[1],
                  section_id: img.sectionId || img.section_id || img.sectionId?.split('_')[0],
                  comment: img.comment || ''
                });
              }
            });
          }
          
          if (allImages.length > 0) {
            await pool.query(
              'UPDATE cm_letters SET images = $1::jsonb, failure_comments = $2::jsonb WHERE id = $3',
              [
                JSON.stringify(allImages),
                JSON.stringify(allImages.map(img => ({ 
                  item_id: img.item_id, 
                  comment: img.comment || '' 
                }))),
                cmLetterResult.rows[0].id
              ]
            );
            console.log(`Linked ${allImages.length} images to CM letter ${cmLetterResult.rows[0].id} for task ${task_id}`);
          } else {
            console.log(`No images found to link to CM letter for task ${task_id}`);
          }
        } else {
          console.log(`No CM letter found for task ${task_id}`);
        }
      }
      // Update task status and overall status
      // For Unplanned CM tasks, include time fields if provided
      // Note: 'task' variable is already declared above at line 123
      let taskUpdateQuery = `UPDATE tasks 
         SET overall_status = $1, 
             status = 'completed'`;
      let taskUpdateParams = [overallStatus];
      let paramCount = 2;
      
      // Update hours_worked if provided
      if (hours_worked !== undefined && hours_worked !== null) {
        taskUpdateQuery += `, hours_worked = $${paramCount++}`;
        taskUpdateParams.push(parseFloat(hours_worked) || 0);
      }

      // For UCM tasks, update time fields
      if (task.task_type === 'UCM') {
        if (cm_occurred_at) {
          taskUpdateQuery += `, cm_occurred_at = $${paramCount++}`;
          taskUpdateParams.push(new Date(cm_occurred_at));
        }
        if (started_at) {
          taskUpdateQuery += `, started_at = $${paramCount++}`;
          taskUpdateParams.push(new Date(started_at));
        }
        if (completed_at) {
          taskUpdateQuery += `, completed_at = $${paramCount++}`;
          taskUpdateParams.push(new Date(completed_at));
        } else {
          taskUpdateQuery += `, completed_at = CURRENT_TIMESTAMP`;
        }
      } else {
        taskUpdateQuery += `, completed_at = CURRENT_TIMESTAMP`;
      }

      taskUpdateQuery += ` WHERE id = $${paramCount} RETURNING *`;
      taskUpdateParams.push(task_id);

      const taskUpdateResult = await pool.query(taskUpdateQuery, taskUpdateParams);
      
      const updatedTask = taskUpdateResult.rows[0];

      // For PM tasks: Store spares_used but don't deduct yet (will be deducted when CM starts)
      // For CM/PCM/UCM tasks: Deduct spares immediately
      let inventorySlip = null;
      if (Array.isArray(spares_used) && spares_used.length > 0 && task.task_type !== 'PM') {
        // Only deduct for non-PM tasks (CM/PCM/UCM)
        try {
          const { v4: uuidv4 } = require('uuid');
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const slipNo = `SLIP-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
            const slipRes = await client.query(
              `INSERT INTO inventory_slips (slip_no, task_id, created_by)
               VALUES ($1, $2, $3) RETURNING *`,
              [slipNo, task_id, req.session?.userId || submitted_by || null]
            );
            inventorySlip = slipRes.rows[0];

            const updates = {};
            for (const line of spares_used) {
              const code = String(line.item_code || '').trim();
              const qty = parseInt(line.qty_used, 10);
              if (!code || !Number.isFinite(qty) || qty <= 0) continue;

              const itemRes = await client.query(
                'SELECT * FROM inventory_items WHERE item_code = $1 FOR UPDATE',
                [code]
              );
              if (itemRes.rows.length === 0) continue;
              const item = itemRes.rows[0];
              const available = item.actual_qty || 0;
              if (available - qty < 0) continue;

              const newQty = available - qty;
              await client.query('UPDATE inventory_items SET actual_qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newQty, item.id]);
              await client.query(
                `INSERT INTO inventory_slip_lines (slip_id, item_id, item_code_snapshot, item_description_snapshot, qty_used)
                 VALUES ($1, $2, $3, $4, $5)`,
                [inventorySlip.id, item.id, item.item_code, item.item_description, qty]
              );
              await client.query(
                `INSERT INTO inventory_transactions (item_id, task_id, slip_id, tx_type, qty_change, created_by)
                 VALUES ($1, $2, $3, 'use', $4, $5)`,
                [item.id, task_id, inventorySlip.id, -qty, req.session?.userId || submitted_by || null]
              );

              updates[code] = newQty;
            }

            await client.query('COMMIT');

            // Update Excel Actual Qty (best-effort)
            try {
              const { updateActualQtyInExcel } = require('../utils/inventoryExcelSync');
              await updateActualQtyInExcel(updates);
            } catch (e) {}
          } catch (e) {
            await client.query('ROLLBACK');
            inventorySlip = null;
          } finally {
            client.release();
          }
        } catch (e) {
          inventorySlip = null;
        }
      }
      
      // If PM task failed, generate CM task
      if (updatedTask.task_type === 'PM' && overallStatus === 'fail' && updatedTask.checklist_template_id) {
        try {
          // Get checklist template to find CM generation rules
          const cmRulesResult = await pool.query(
            'SELECT cm_generation_rules FROM checklist_templates WHERE id = $1',
            [updatedTask.checklist_template_id]
          );
          
          if (cmRulesResult.rows.length > 0) {
            const cmRules = cmRulesResult.rows[0].cm_generation_rules;
            if (cmRules && typeof cmRules === 'string') {
              try {
                cmRules = JSON.parse(cmRules);
              } catch (e) {
                console.error('Error parsing cm_generation_rules:', e);
              }
            }
            
            if (cmRules && cmRules.auto_generate) {
              // Find CM template for the same asset type
              const cmTemplateResult = await pool.query(
                `SELECT * FROM checklist_templates 
                 WHERE asset_type = (SELECT asset_type FROM assets WHERE id = $1) 
                 AND task_type = 'CM' 
                 LIMIT 1`,
                [updatedTask.asset_id]
              );
              
              const cmTemplateId = cmTemplateResult.rows.length > 0 
                ? cmTemplateResult.rows[0].id 
                : updatedTask.checklist_template_id;
              
              const taskCode = `CM-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
              
              // Get who performed the PM task (submitted_by from this response)
              const pmPerformedBy = submitted_by || req.session?.userId || null;
              
              // Create CM task (use PCM as task type, not CM)
              const cmTaskResult = await pool.query(
                `INSERT INTO tasks (
                  task_code, checklist_template_id, asset_id, task_type, 
                  status, parent_task_id, scheduled_date, pm_performed_by
                ) VALUES ($1, $2, $3, 'PCM', 'pending', $4, CURRENT_DATE, $5) RETURNING *`,
                [taskCode, cmTemplateId, updatedTask.asset_id, task_id, pmPerformedBy]
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
                  task_id,
                  letterNumber,
                  updatedTask.asset_id,
                  `Corrective maintenance required due to failed PM task: ${updatedTask.task_code}`,
                  (cmRules.default_priority || 'medium')
                ]
              );
              
              console.log(`CM task ${cmTask.task_code} generated from failed PM task ${updatedTask.task_code}`);
            }
          }
        } catch (cmError) {
          console.error('Error generating CM task:', cmError);
          // Don't fail the submission if CM generation fails
        }
      }

      // Parse response_data if it's a string for the response
      const responseData = result.rows[0];
      if (responseData.response_data && typeof responseData.response_data === 'string') {
        responseData.response_data = JSON.parse(responseData.response_data);
      }

      res.status(201).json({
        ...responseData,
        validation: validationResult,
        inventory_slip: inventorySlip
      });
    } catch (error) {
      console.error('Error submitting checklist response:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Failed to submit checklist response',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Save draft checklist response (auto-save)
  router.post('/draft', async (req, res) => {
    try {
      const { 
        task_id, 
        checklist_template_id, 
        response_data,
        maintenance_team,
        inspected_by,
        approved_by,
        images,
        spares_used
      } = req.body;

      if (!task_id) {
        return res.status(400).json({ error: 'task_id is required' });
      }

      // Upsert draft response
      const result = await pool.query(
        `INSERT INTO draft_checklist_responses (
          task_id, checklist_template_id, response_data,
          maintenance_team, inspected_by, approved_by, images, spares_used, saved_at
        ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (task_id) DO UPDATE SET
          checklist_template_id = EXCLUDED.checklist_template_id,
          response_data = EXCLUDED.response_data,
          maintenance_team = EXCLUDED.maintenance_team,
          inspected_by = EXCLUDED.inspected_by,
          approved_by = EXCLUDED.approved_by,
          images = EXCLUDED.images,
          spares_used = EXCLUDED.spares_used,
          saved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [
          task_id,
          checklist_template_id || null,
          JSON.stringify(response_data || {}),
          maintenance_team || null,
          inspected_by || null,
          approved_by || null,
          JSON.stringify(images || null),
          JSON.stringify(spares_used || null)
        ]
      );

      res.json({ 
        success: true, 
        draft: result.rows[0],
        message: 'Draft saved successfully'
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      res.status(500).json({ error: 'Failed to save draft' });
    }
  });

  // Get draft checklist response
  router.get('/draft/:taskId', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM draft_checklist_responses WHERE task_id = $1',
        [req.params.taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No draft found' });
      }

      const draft = result.rows[0];
      // Parse JSONB response_data
      if (draft.response_data && typeof draft.response_data === 'string') {
        draft.response_data = JSON.parse(draft.response_data);
      }
      if (draft.images && typeof draft.images === 'string') {
        draft.images = JSON.parse(draft.images);
      }
      if (draft.spares_used && typeof draft.spares_used === 'string') {
        draft.spares_used = JSON.parse(draft.spares_used);
      }

      res.json(draft);
    } catch (error) {
      console.error('Error fetching draft:', error);
      res.status(500).json({ error: 'Failed to fetch draft' });
    }
  });

  // Delete draft checklist response (after successful submission)
  router.delete('/draft/:taskId', async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM draft_checklist_responses WHERE task_id = $1',
        [req.params.taskId]
      );
      res.json({ success: true, message: 'Draft deleted successfully' });
    } catch (error) {
      console.error('Error deleting draft:', error);
      res.status(500).json({ error: 'Failed to delete draft' });
    }
  });

  return router;
};

