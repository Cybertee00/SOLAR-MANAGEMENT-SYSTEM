require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Update template codes to PM-XXX format
 */
async function updateTemplateCodes() {
  try {
    console.log('Updating template codes to PM-XXX format...\n');
    
    const result = await pool.query(`
      SELECT id, template_code, template_name 
      FROM checklist_templates 
      WHERE template_code LIKE '%-PM-%' OR template_code LIKE '%-CM-%'
      ORDER BY template_code
    `);
    
    console.log(`Found ${result.rows.length} templates to update:\n`);
    
    for (const template of result.rows) {
      // Extract PM/CM number (e.g., "SCADA-STRINGS-PM-003" -> "PM-003")
      const match = template.template_code.match(/(PM|CM)-(\d{3})/i);
      if (match) {
        const newCode = `${match[1].toUpperCase()}-${match[2]}`;
        
        if (template.template_code !== newCode) {
          console.log(`  ${template.template_code} -> ${newCode} (${template.template_name})`);
          
          // Check if new code already exists
          const existing = await pool.query(
            'SELECT id FROM checklist_templates WHERE template_code = $1 AND id != $2',
            [newCode, template.id]
          );
          
          if (existing.rows.length > 0) {
            console.log(`    ⚠️  Warning: ${newCode} already exists, skipping...`);
            continue;
          }
          
          await pool.query(
            'UPDATE checklist_templates SET template_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newCode, template.id]
          );
        }
      }
    }
    
    console.log('\n✅ Template codes updated!\n');
  } catch (error) {
    console.error('Error updating template codes:', error);
    throw error;
  }
}

/**
 * List all templates with their structure info
 */
async function listTemplates() {
  try {
    console.log('Listing all templates...\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        template_code,
        template_name,
        asset_type,
        frequency,
        checklist_structure
      FROM checklist_templates
      ORDER BY template_code
    `);
    
    for (const template of result.rows) {
      let structure = template.checklist_structure;
      if (typeof structure === 'string') {
        structure = JSON.parse(structure);
      }
      
      const sections = structure?.sections || [];
      const metadata = structure?.metadata || {};
      
      console.log(`\n${template.template_code} - ${template.template_name}`);
      console.log(`  Asset Type: ${template.asset_type}`);
      console.log(`  Frequency: ${template.frequency || 'N/A'}`);
      console.log(`  Sections: ${sections.length}`);
      sections.forEach((section, idx) => {
        console.log(`    ${idx + 1}. ${section.title} (${section.items?.length || 0} items)`);
      });
      console.log(`  Metadata:`);
      console.log(`    - Last Revision Date: ${metadata.last_revision_date || 'N/A'}`);
      console.log(`    - Checklist Made By: ${metadata.checklist_made_by || 'N/A'}`);
      console.log(`    - Last Revision Approved By: ${metadata.last_revision_approved_by || 'N/A'}`);
    }
    
    console.log(`\n✅ Total templates: ${result.rows.length}\n`);
  } catch (error) {
    console.error('Error listing templates:', error);
    throw error;
  }
}

/**
 * Fix specific template by ID
 */
async function fixTemplate(templateId, fixes) {
  try {
    const result = await pool.query(
      'SELECT id, template_code, template_name, checklist_structure FROM checklist_templates WHERE id = $1',
      [templateId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Template with ID ${templateId} not found`);
    }
    
    const template = result.rows[0];
    let structure = template.checklist_structure;
    if (typeof structure === 'string') {
      structure = JSON.parse(structure);
    }
    
    if (!structure.sections) {
      structure.sections = [];
    }
    
    // Apply fixes
    if (fixes.sections) {
      structure.sections = fixes.sections;
    }
    
    if (fixes.metadata) {
      if (!structure.metadata) {
        structure.metadata = {};
      }
      Object.assign(structure.metadata, fixes.metadata);
    }
    
    await pool.query(
      'UPDATE checklist_templates SET checklist_structure = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(structure), templateId]
    );
    
    console.log(`✅ Fixed template: ${template.template_code} - ${template.template_name}`);
  } catch (error) {
    console.error('Error fixing template:', error);
    throw error;
  }
}

/**
 * Find templates by name pattern
 */
async function findTemplates(pattern) {
  try {
    const result = await pool.query(
      `SELECT id, template_code, template_name, asset_type 
       FROM checklist_templates 
       WHERE LOWER(template_name) LIKE LOWER($1) OR LOWER(template_code) LIKE LOWER($1)
       ORDER BY template_code`,
      [`%${pattern}%`]
    );
    
    console.log(`\nFound ${result.rows.length} templates matching "${pattern}":\n`);
    result.rows.forEach(t => {
      console.log(`  ${t.template_code} - ${t.template_name} (ID: ${t.id})`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('Error finding templates:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'list') {
      await listTemplates();
    } else if (command === 'update-codes') {
      await updateTemplateCodes();
    } else if (command === 'find') {
      const pattern = args[1];
      if (!pattern) {
        console.error('Usage: node fix-templates.js find <pattern>');
        process.exit(1);
      }
      await findTemplates(pattern);
    } else if (command === 'fix') {
      const templateId = args[1];
      if (!templateId) {
        console.error('Usage: node fix-templates.js fix <template-id>');
        process.exit(1);
      }
      // This would need the fixes object - for now just show structure
      const result = await pool.query(
        'SELECT id, template_code, template_name, checklist_structure FROM checklist_templates WHERE id = $1',
        [templateId]
      );
      if (result.rows.length === 0) {
        console.error(`Template with ID ${templateId} not found`);
        process.exit(1);
      }
      const template = result.rows[0];
      let structure = template.checklist_structure;
      if (typeof structure === 'string') {
        structure = JSON.parse(structure);
      }
      console.log(JSON.stringify(structure, null, 2));
    } else {
      console.log('Usage:');
      console.log('  node fix-templates.js list              - List all templates');
      console.log('  node fix-templates.js update-codes      - Update template codes to PM-XXX format');
      console.log('  node fix-templates.js find <pattern>    - Find templates by name/code pattern');
      console.log('  node fix-templates.js fix <template-id>  - Show template structure for fixing');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateTemplateCodes, listTemplates, fixTemplate, findTemplates };
