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
 * Get template by code or name
 */
async function getTemplate(identifier) {
  // Try exact match first
  let result = await pool.query(
    `SELECT id, template_code, template_name, checklist_structure 
     FROM checklist_templates 
     WHERE template_code = $1`,
    [identifier]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  
  // Try partial match
  result = await pool.query(
    `SELECT id, template_code, template_name, checklist_structure 
     FROM checklist_templates 
     WHERE template_code LIKE $1 OR LOWER(template_name) LIKE LOWER($2)`,
    [`%${identifier}%`, `%${identifier}%`]
  );
  return result.rows[0];
}

/**
 * Update template structure
 */
async function updateTemplateStructure(templateId, newStructure) {
  await pool.query(
    `UPDATE checklist_templates 
     SET checklist_structure = $1::jsonb, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [JSON.stringify(newStructure), templateId]
  );
  console.log('✅ Template structure updated');
}

/**
 * Fix CT-MV-PM-008 template
 * Issue: Information not extracted well - showing 3 sections but needs better structure
 */
async function fixCTMVTemplate() {
  console.log('\n🔧 Fixing PM-008 (Monthly Inspection for CT building MV side)...');
  
  const template = await getTemplate('PM-008');
  if (!template) {
    console.log('❌ Template not found');
    return;
  }
  
  let structure = template.checklist_structure;
  if (typeof structure === 'string') {
    structure = JSON.parse(structure);
  }
  
  // The current structure has 3 sections but items may be missing
  // We need to ensure all items are properly extracted
  // Since we can't see the Excel, we'll improve the structure based on typical MV side inspections
  
  console.log('Current structure:', JSON.stringify(structure, null, 2));
  console.log('\n⚠️  Manual review needed - please check the Excel file and update structure via UI');
  
  // Ensure metadata exists
  if (!structure.metadata) {
    structure.metadata = {};
  }
  structure.metadata.checklist_made_by = structure.metadata.checklist_made_by || 'and';
  structure.metadata.last_revision_approved_by = structure.metadata.last_revision_approved_by || 'Floridas Moloto';
  
  await updateTemplateStructure(template.id, structure);
}

/**
 * Fix INV-PM-006 template
 * Issue: Only 1 section with 2 items - needs proper analysis with values
 */
async function fixInverterTemplate() {
  console.log('\n🔧 Fixing PM-006 (Monthly Inspection for CT building Inverters)...');
  
  const template = await getTemplate('PM-006');
  if (!template) {
    console.log('❌ Template not found');
    return;
  }
  
  let structure = template.checklist_structure;
  if (typeof structure === 'string') {
    structure = JSON.parse(structure);
  }
  
  console.log('Current structure:', JSON.stringify(structure, null, 2));
  console.log('\n⚠️  This template needs complete re-extraction from Excel');
  console.log('   Current: Only 1 section with 2 items');
  console.log('   Expected: Multiple sections with voltage/current readings for each inverter');
  console.log('   Action: Re-upload the Excel file or manually fix via UI');
  
  // Ensure metadata exists
  if (!structure.metadata) {
    structure.metadata = {};
  }
  structure.metadata.checklist_made_by = structure.metadata.checklist_made_by || 'and';
  structure.metadata.last_revision_approved_by = structure.metadata.last_revision_approved_by || 'Floridas Moloto';
  
  await updateTemplateStructure(template.id, structure);
}

/**
 * Fix SUB-PM-020 template
 * Issue: Missing section 6
 */
async function fixSubstationTemplate() {
  console.log('\n🔧 Fixing PM-020 (Monthly Inspection for Substation)...');
  
  const template = await getTemplate('PM-020');
  if (!template) {
    console.log('❌ Template not found');
    return;
  }
  
  let structure = template.checklist_structure;
  if (typeof structure === 'string') {
    structure = JSON.parse(structure);
  }
  
  // Currently has 5 sections, need to add section 6
  // Since we don't know what section 6 should contain, we'll add a placeholder
  if (!structure.sections) {
    structure.sections = [];
  }
  
  // Check if section 6 already exists
  const hasSection6 = structure.sections.some(s => 
    s.title && (s.title.includes('6') || s.title.toLowerCase().includes('section 6'))
  );
  
  if (!hasSection6 && structure.sections.length === 5) {
    // Add placeholder section 6
    structure.sections.push({
      id: `section_${structure.sections.length + 1}`,
      title: 'Section 6 - [To be filled from Excel]',
      items: []
    });
    console.log('✅ Added placeholder Section 6');
    console.log('⚠️  Please update Section 6 content from the Excel template');
  } else {
    console.log('⚠️  Section 6 may already exist or structure is different');
  }
  
  // Ensure metadata exists
  if (!structure.metadata) {
    structure.metadata = {};
  }
  structure.metadata.checklist_made_by = structure.metadata.checklist_made_by || 'and';
  structure.metadata.last_revision_approved_by = structure.metadata.last_revision_approved_by || 'Floridas Moloto';
  
  await updateTemplateStructure(template.id, structure);
}

/**
 * Fix SUB-BATTERIES-PM-021 template
 * Issue: Only 1 section with 1 item - needs proper extraction with values
 */
async function fixSubstationBTUTemplate() {
  console.log('\n🔧 Fixing PM-021 (Monthly Inspection for Substation BTU)...');
  
  const template = await getTemplate('PM-021');
  if (!template) {
    console.log('❌ Template not found');
    return;
  }
  
  let structure = template.checklist_structure;
  if (typeof structure === 'string') {
    structure = JSON.parse(structure);
  }
  
  console.log('Current structure:', JSON.stringify(structure, null, 2));
  console.log('\n⚠️  This template needs complete re-extraction from Excel');
  console.log('   Current: Only 1 section with 1 item');
  console.log('   Expected: Multiple sections with measurement values for battery inspection');
  console.log('   Action: Re-upload the Excel file or manually fix via UI');
  console.log('   Note: This template mostly looks for values (measurements)');
  
  // Ensure metadata exists
  if (!structure.metadata) {
    structure.metadata = {};
  }
  structure.metadata.checklist_made_by = structure.metadata.checklist_made_by || 'and';
  structure.metadata.last_revision_approved_by = structure.metadata.last_revision_approved_by || 'Floridas Moloto';
  
  await updateTemplateStructure(template.id, structure);
}

/**
 * Set default metadata for all templates
 */
async function setDefaultMetadata() {
  console.log('\n🔧 Setting default metadata for all templates...');
  
  const result = await pool.query('SELECT id, checklist_structure FROM checklist_templates');
  
  for (const template of result.rows) {
    let structure = template.checklist_structure;
    if (typeof structure === 'string') {
      structure = JSON.parse(structure);
    }
    
    if (!structure.metadata) {
      structure.metadata = {};
    }
    
    // Set defaults if not already set
    if (!structure.metadata.checklist_made_by) {
      structure.metadata.checklist_made_by = 'and';
    }
    if (!structure.metadata.last_revision_approved_by) {
      structure.metadata.last_revision_approved_by = 'Floridas Moloto';
    }
    
    await pool.query(
      `UPDATE checklist_templates 
       SET checklist_structure = $1::jsonb, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [JSON.stringify(structure), template.id]
    );
  }
  
  console.log(`✅ Updated metadata for ${result.rows.length} templates`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'ct-mv') {
      await fixCTMVTemplate();
    } else if (command === 'inverter') {
      await fixInverterTemplate();
    } else if (command === 'substation') {
      await fixSubstationTemplate();
    } else if (command === 'substation-btu') {
      await fixSubstationBTUTemplate();
    } else if (command === 'metadata') {
      await setDefaultMetadata();
    } else if (command === 'all') {
      await setDefaultMetadata();
      await fixCTMVTemplate();
      await fixInverterTemplate();
      await fixSubstationTemplate();
      await fixSubstationBTUTemplate();
    } else {
      console.log('Usage:');
      console.log('  node fix-specific-templates.js metadata        - Set default metadata for all templates');
      console.log('  node fix-specific-templates.js ct-mv          - Fix CT-MV-PM-008 template');
      console.log('  node fix-specific-templates.js inverter       - Fix INV-PM-006 template');
      console.log('  node fix-specific-templates.js substation     - Fix SUB-PM-020 template (add section 6)');
      console.log('  node fix-specific-templates.js substation-btu - Fix SUB-BATTERIES-PM-021 template');
      console.log('  node fix-specific-templates.js all           - Run all fixes');
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

module.exports = { 
  fixCTMVTemplate, 
  fixInverterTemplate, 
  fixSubstationTemplate, 
  fixSubstationBTUTemplate,
  setDefaultMetadata 
};
