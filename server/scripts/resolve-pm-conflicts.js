require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function resolveConflicts() {
  try {
    console.log('🔍 Checking current template codes...\n');
    
    // Get all templates
    const result = await pool.query(`
      SELECT id, template_code, template_name, asset_type
      FROM checklist_templates
      ORDER BY template_code
    `);
    
    // Find templates that still have old format
    const oldFormatTemplates = result.rows.filter(t => 
      t.template_code.includes('-PM-') || 
      t.template_code.match(/^[A-Z]+-PM-\d+$/)
    );
    
    // Get all current PM numbers
    const currentPMNumbers = new Set();
    result.rows.forEach(t => {
      const match = t.template_code.match(/^PM-(\d+)$/);
      if (match) {
        currentPMNumbers.add(parseInt(match[1]));
      }
    });
    
    console.log('Current PM numbers in use:', Array.from(currentPMNumbers).sort((a, b) => a - b).join(', '));
    console.log('\nTemplates with old format:');
    oldFormatTemplates.forEach(t => {
      console.log(`  ${t.template_code} - ${t.template_name}`);
    });
    
    // Find next available PM numbers
    function getNextAvailablePM(startFrom = 1) {
      for (let i = startFrom; i <= 999; i++) {
        const num = i.toString().padStart(3, '0');
        if (!currentPMNumbers.has(i)) {
          return `PM-${num}`;
        }
      }
      return null;
    }
    
    console.log('\n🔧 Resolving conflicts...\n');
    
    // Resolve conflicts based on template type and frequency
    const assignments = [];
    
    for (const template of oldFormatTemplates) {
      let newCode = null;
      
      // SCB-PM-003 (String Combiner Box - Bi-monthly)
      if (template.template_code === 'SCB-PM-003') {
        newCode = getNextAvailablePM(22); // Assign PM-022 or next available
        assignments.push({ template, newCode, reason: 'String Combiner Box - assign next available' });
      }
      // TRACKER-PM-005 (Tracker - Quarterly)
      else if (template.template_code === 'TRACKER-PM-005') {
        newCode = getNextAvailablePM(22); // Assign PM-022 or next available
        assignments.push({ template, newCode, reason: 'Tracker - assign next available' });
      }
      // EM-PM-14 (duplicate of PM-014)
      else if (template.template_code === 'EM-PM-14') {
        newCode = getNextAvailablePM(15); // Assign PM-015 or next available
        assignments.push({ template, newCode, reason: 'Energy Meter duplicate - assign next available' });
      }
      // Any other old format
      else {
        const match = template.template_code.match(/(PM|CM)-(\d+)/i);
        if (match) {
          const num = parseInt(match[2]);
          if (currentPMNumbers.has(num)) {
            // Conflict - assign next available
            newCode = getNextAvailablePM(Math.max(22, num + 1));
            assignments.push({ template, newCode, reason: 'Conflict - assign next available' });
          } else {
            // No conflict - can use the number
            newCode = `PM-${match[2].padStart(3, '0')}`;
            assignments.push({ template, newCode, reason: 'No conflict - use existing number' });
          }
        }
      }
    }
    
    if (assignments.length === 0) {
      console.log('✅ No conflicts to resolve!\n');
      return;
    }
    
    console.log('Proposed assignments:');
    assignments.forEach(({ template, newCode, reason }) => {
      console.log(`  ${template.template_code} -> ${newCode}`);
      console.log(`    Template: ${template.template_name}`);
      console.log(`    Reason: ${reason}\n`);
    });
    
    // Apply changes
    console.log('Applying changes...\n');
    for (const { template, newCode } of assignments) {
      // Check if new code already exists
      const existing = await pool.query(
        'SELECT id FROM checklist_templates WHERE template_code = $1 AND id != $2',
        [newCode, template.id]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⚠️  ${template.template_code}: ${newCode} already exists, skipping...`);
        continue;
      }
      
      await pool.query(
        'UPDATE checklist_templates SET template_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newCode, template.id]
      );
      
      console.log(`✅ ${template.template_code} -> ${newCode}`);
    }
    
    console.log('\n✅ Conflicts resolved!\n');
    
    // Show final state
    const finalResult = await pool.query(`
      SELECT template_code, template_name
      FROM checklist_templates
      WHERE template_code LIKE 'PM-%'
      ORDER BY template_code
    `);
    
    console.log('Final PM template codes:');
    finalResult.rows.forEach(t => {
      console.log(`  ${t.template_code} - ${t.template_name}`);
    });
    
  } catch (error) {
    console.error('Error resolving conflicts:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  resolveConflicts();
}

module.exports = { resolveConflicts };
