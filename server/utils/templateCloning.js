/**
 * Template Cloning Utility
 *
 * Clones system templates to a new organization when it is created.
 * System templates have is_system_template = true and can_be_cloned = true.
 * Cloned templates get a new UUID, the target organization_id, and
 * is_system_template = false.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Clone all eligible system templates to a new organization.
 *
 * @param {object} db - Database connection (pool or request-scoped client)
 * @param {string} organizationId - The UUID of the target organization
 * @returns {object} { cloned: number, skipped: number, errors: string[] }
 */
async function cloneSystemTemplatesToOrganization(db, organizationId) {
  const result = { cloned: 0, skipped: 0, errors: [] };

  try {
    // Find all system templates that can be cloned
    const systemTemplates = await db.query(
      `SELECT * FROM checklist_templates
       WHERE is_system_template = true AND can_be_cloned = true`
    );

    if (systemTemplates.rows.length === 0) {
      console.log(`[TEMPLATE_CLONE] No system templates found to clone for org ${organizationId}`);
      return result;
    }

    console.log(`[TEMPLATE_CLONE] Found ${systemTemplates.rows.length} system templates to clone for org ${organizationId}`);

    for (const template of systemTemplates.rows) {
      try {
        // Check if this template_code already exists for this organization
        const existing = await db.query(
          `SELECT id FROM checklist_templates
           WHERE organization_id = $1 AND template_code = $2`,
          [organizationId, template.template_code]
        );

        if (existing.rows.length > 0) {
          result.skipped++;
          continue;
        }

        const newId = uuidv4();
        await db.query(
          `INSERT INTO checklist_templates (
            id, template_code, template_name, description, asset_type,
            task_type, frequency, checklist_structure, validation_rules,
            cm_generation_rules, organization_id, is_system_template, can_be_cloned,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, false, false,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            newId,
            template.template_code,
            template.template_name,
            template.description,
            template.asset_type,
            template.task_type,
            template.frequency,
            JSON.stringify(template.checklist_structure),
            template.validation_rules ? JSON.stringify(template.validation_rules) : null,
            template.cm_generation_rules ? JSON.stringify(template.cm_generation_rules) : null,
            organizationId
          ]
        );

        result.cloned++;
      } catch (templateError) {
        const msg = `Failed to clone template ${template.template_code}: ${templateError.message}`;
        console.error(`[TEMPLATE_CLONE] ${msg}`);
        result.errors.push(msg);
      }
    }

    console.log(`[TEMPLATE_CLONE] Cloning complete for org ${organizationId}: ${result.cloned} cloned, ${result.skipped} skipped, ${result.errors.length} errors`);
  } catch (error) {
    console.error(`[TEMPLATE_CLONE] Error cloning templates for org ${organizationId}:`, error);
    result.errors.push(`Top-level error: ${error.message}`);
  }

  return result;
}

module.exports = { cloneSystemTemplatesToOrganization };
