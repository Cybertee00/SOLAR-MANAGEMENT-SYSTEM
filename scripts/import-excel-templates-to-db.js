// Import parsed Excel checklist templates into the database
const fs = require('fs');
const path = require('path');

// Try to load dotenv from server directory
try {
  require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
} catch (e) {
  try {
    require('dotenv').config();
  } catch (e2) {
    // dotenv not available, use environment variables directly
  }
}

// Load pg from server node_modules
let Pool;
try {
  Pool = require('../server/node_modules/pg').Pool;
} catch (e) {
  try {
    Pool = require('pg').Pool;
  } catch (e2) {
    console.error('pg module not found. Please install it: cd server && npm install pg');
    process.exit(1);
  }
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function importTemplates() {
  try {
    console.log('='.repeat(80));
    console.log('IMPORTING EXCEL CHECKLIST TEMPLATES TO DATABASE');
    console.log('='.repeat(80));
    
    // Load templates - try server-templates-final.json first, then fallback
    let templatesPath = path.join(__dirname, '../server-templates-final.json');
    
    if (!fs.existsSync(templatesPath)) {
      templatesPath = path.join(__dirname, '../excel-checklist-templates-final.json');
      if (!fs.existsSync(templatesPath)) {
        console.error(`Templates file not found`);
        console.log('Please run the Excel parser first: node scripts/parse-all-server-templates.js');
        process.exit(1);
      }
    }
    
    const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    console.log(`\nLoaded ${templates.length} templates from file\n`);
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const template of templates) {
      try {
        // Check if template already exists
        const existing = await pool.query(
          'SELECT id FROM checklist_templates WHERE template_code = $1',
          [template.template_code]
        );
        
        if (existing.rows.length > 0) {
          // Update existing template
          await pool.query(
            `UPDATE checklist_templates 
             SET template_name = $1,
                 description = $2,
                 asset_type = $3,
                 task_type = $4,
                 frequency = $5,
                 checklist_structure = $6,
                 validation_rules = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE template_code = $8`,
            [
              template.template_name,
              template.description,
              template.asset_type,
              template.task_type,
              template.frequency,
              JSON.stringify(template.checklist_structure),
              JSON.stringify({}), // Empty validation rules for now
              template.template_code
            ]
          );
          updated++;
          console.log(`✓ Updated: ${template.template_code} - ${template.template_name}`);
        } else {
          // Insert new template
          await pool.query(
            `INSERT INTO checklist_templates 
             (template_code, template_name, description, asset_type, task_type, frequency, checklist_structure, validation_rules)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              template.template_code,
              template.template_name,
              template.description,
              template.asset_type,
              template.task_type,
              template.frequency,
              JSON.stringify(template.checklist_structure),
              JSON.stringify({}) // Empty validation rules for now
            ]
          );
          imported++;
          console.log(`✓ Imported: ${template.template_code} - ${template.template_name}`);
        }
        
        // Print summary
        const totalItems = template.checklist_structure.sections.reduce((sum, s) => sum + s.items.length, 0);
        console.log(`  - Sections: ${template.checklist_structure.sections.length}, Items: ${totalItems}`);
        if (template.checklist_structure.metadata.has_ct_buildings) {
          console.log(`  - CT Buildings: ${template.checklist_structure.metadata.ct_buildings.map(c => c.code).join(', ')}`);
        }
        if (template.checklist_structure.metadata.has_inverters) {
          console.log(`  - Inverters: ${template.checklist_structure.metadata.inverters.map(i => i.code).join(', ')}`);
        }
        console.log('');
        
      } catch (error) {
        console.error(`✗ Error importing ${template.template_code}:`, error.message);
        skipped++;
      }
    }
    
    console.log('='.repeat(80));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Imported: ${imported}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${templates.length}`);
    console.log('\n✓ Import complete!');
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  importTemplates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importTemplates };
