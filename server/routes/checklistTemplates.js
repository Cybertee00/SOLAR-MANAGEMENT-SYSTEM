const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  // Get all checklist templates
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM checklist_templates ORDER BY template_code');
      // Parse JSONB fields for all templates
      const templates = result.rows.map(template => {
        if (template.checklist_structure && typeof template.checklist_structure === 'string') {
          template.checklist_structure = JSON.parse(template.checklist_structure);
        }
        if (template.validation_rules && typeof template.validation_rules === 'string') {
          template.validation_rules = JSON.parse(template.validation_rules);
        }
        if (template.cm_generation_rules && typeof template.cm_generation_rules === 'string') {
          template.cm_generation_rules = JSON.parse(template.cm_generation_rules);
        }
        return template;
      });
      res.json(templates);
    } catch (error) {
      console.error('Error fetching checklist templates:', error);
      res.status(500).json({ error: 'Failed to fetch checklist templates' });
    }
  });

  // Get checklist template by ID
  router.get('/:id', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM checklist_templates WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist template not found' });
      }
      
      // Parse JSONB fields
      const template = result.rows[0];
      if (template.checklist_structure && typeof template.checklist_structure === 'string') {
        template.checklist_structure = JSON.parse(template.checklist_structure);
      }
      if (template.validation_rules && typeof template.validation_rules === 'string') {
        template.validation_rules = JSON.parse(template.validation_rules);
      }
      if (template.cm_generation_rules && typeof template.cm_generation_rules === 'string') {
        template.cm_generation_rules = JSON.parse(template.cm_generation_rules);
      }
      
      res.json(template);
    } catch (error) {
      console.error('Error fetching checklist template:', error);
      res.status(500).json({ error: 'Failed to fetch checklist template' });
    }
  });

  // Get checklist templates by asset type
  router.get('/asset-type/:assetType', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM checklist_templates WHERE asset_type = $1 ORDER BY template_code',
        [req.params.assetType]
      );
      // Parse JSONB fields for all templates
      const templates = result.rows.map(template => {
        if (template.checklist_structure && typeof template.checklist_structure === 'string') {
          template.checklist_structure = JSON.parse(template.checklist_structure);
        }
        if (template.validation_rules && typeof template.validation_rules === 'string') {
          template.validation_rules = JSON.parse(template.validation_rules);
        }
        if (template.cm_generation_rules && typeof template.cm_generation_rules === 'string') {
          template.cm_generation_rules = JSON.parse(template.cm_generation_rules);
        }
        return template;
      });
      res.json(templates);
    } catch (error) {
      console.error('Error fetching checklist templates by asset type:', error);
      res.status(500).json({ error: 'Failed to fetch checklist templates' });
    }
  });

  // Create checklist template
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const {
        template_code,
        template_name,
        description,
        asset_type,
        task_type,
        frequency,
        checklist_structure,
        validation_rules,
        cm_generation_rules
      } = req.body;

      const result = await pool.query(
        `INSERT INTO checklist_templates (
          template_code, template_name, description, asset_type, task_type, frequency,
          checklist_structure, validation_rules, cm_generation_rules
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb) RETURNING *`,
        [
          template_code,
          template_name,
          description,
          asset_type,
          task_type || 'PM',
          frequency,
          JSON.stringify(checklist_structure),
          JSON.stringify(validation_rules || {}),
          JSON.stringify(cm_generation_rules || {})
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating checklist template:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Template code already exists' });
      }
      res.status(500).json({ error: 'Failed to create checklist template' });
    }
  });

  /**
   * Update template metadata (admin only)
   * Allows manual edits like last_revision_date without changing checklist items.
   */
  router.patch('/:id/metadata', requireAdmin, async (req, res) => {
    try {
      const { last_revision_date } = req.body;
      const templateId = req.params.id;

      const result = await pool.query(
        'SELECT id, checklist_structure FROM checklist_templates WHERE id = $1',
        [templateId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist template not found' });
      }

      let checklistStructure = result.rows[0].checklist_structure;
      if (checklistStructure && typeof checklistStructure === 'string') {
        checklistStructure = JSON.parse(checklistStructure);
      }
      if (!checklistStructure || typeof checklistStructure !== 'object') {
        checklistStructure = {};
      }
      if (!checklistStructure.metadata || typeof checklistStructure.metadata !== 'object') {
        checklistStructure.metadata = {};
      }

      // Manual template-level revision date (e.g. "Date of Last Revision" in the Excel header)
      checklistStructure.metadata.last_revision_date = last_revision_date || '';

      const update = await pool.query(
        `UPDATE checklist_templates
         SET checklist_structure = $1::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(checklistStructure), templateId]
      );

      const updatedTemplate = update.rows[0];
      if (updatedTemplate.checklist_structure && typeof updatedTemplate.checklist_structure === 'string') {
        updatedTemplate.checklist_structure = JSON.parse(updatedTemplate.checklist_structure);
      }

      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating checklist template metadata:', error);
      res.status(500).json({ error: 'Failed to update template metadata', details: error.message });
    }
  });

  return router;
};

