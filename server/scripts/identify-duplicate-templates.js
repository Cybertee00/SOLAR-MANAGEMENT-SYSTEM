require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function identifyDuplicates() {
  try {
    console.log('🔍 Identifying Duplicate Templates\n');
    console.log('='.repeat(80));
    
    const result = await pool.query(`
      SELECT id, template_code, template_name, asset_type, frequency, 
             created_at, (SELECT COUNT(*) FROM tasks WHERE checklist_template_id = checklist_templates.id) as task_count
      FROM checklist_templates
      ORDER BY asset_type, frequency, created_at
    `);
    
    console.log(`\nTotal templates in database: ${result.rows.length}\n`);
    console.log('Expected: 13 templates (from Excel folder)\n');
    console.log('Difference: ' + (result.rows.length - 13) + ' extra templates\n');
    
    // Group by asset_type to find duplicates
    const byAssetType = {};
    result.rows.forEach(t => {
      if (!byAssetType[t.asset_type]) {
        byAssetType[t.asset_type] = [];
      }
      byAssetType[t.asset_type].push(t);
    });
    
    console.log('Templates by Asset Type:\n');
    Object.keys(byAssetType).sort().forEach(assetType => {
      const templates = byAssetType[assetType];
      console.log(`  ${assetType.toUpperCase()} (${templates.length} template${templates.length > 1 ? 's' : ''}):`);
      templates.forEach(t => {
        console.log(`    ${t.template_code} - ${t.template_name}`);
        console.log(`      Frequency: ${t.frequency}`);
        console.log(`      Created: ${t.created_at.toISOString().split('T')[0]}`);
        console.log(`      Tasks using this template: ${t.task_count}`);
        if (templates.length > 1 && templates.filter(tt => tt.frequency === t.frequency).length > 1) {
          console.log(`      ⚠️  POTENTIAL DUPLICATE (same frequency)`);
        }
        console.log('');
      });
    });
    
    // Specifically check Energy Meter
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 Energy Meter Templates Analysis:\n');
    const energyMeters = result.rows.filter(t => t.asset_type === 'energy_meter');
    if (energyMeters.length > 1) {
      console.log(`Found ${energyMeters.length} Energy Meter templates (likely duplicates):\n`);
      energyMeters.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.template_code} - ${t.template_name}`);
        console.log(`   Created: ${t.created_at.toISOString()}`);
        console.log(`   Tasks: ${t.task_count}`);
        console.log(`   ID: ${t.id}`);
        console.log('');
      });
      console.log('💡 Recommendation: These appear to be duplicates.');
      console.log('   Keep the one with more tasks, or merge them if needed.\n');
    }
    
    console.log('='.repeat(80));
    console.log('\n✅ Analysis Complete\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  identifyDuplicates();
}

module.exports = { identifyDuplicates };
