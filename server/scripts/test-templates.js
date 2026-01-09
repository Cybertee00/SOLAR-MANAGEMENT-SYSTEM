// Quick test script to check if templates exist in database
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testTemplates() {
  try {
    const result = await pool.query('SELECT id, template_code, template_name, asset_type FROM checklist_templates ORDER BY template_code');
    
    console.log('\n========================================');
    console.log('CHECKLIST TEMPLATES IN DATABASE:');
    console.log('========================================\n');
    
    if (result.rows.length === 0) {
      console.log('❌ No templates found in database!');
      console.log('Run: npm run setup-db\n');
    } else {
      console.log(`✅ Found ${result.rows.length} template(s):\n`);
      result.rows.forEach((template, index) => {
        console.log(`${index + 1}. ${template.template_code} - ${template.template_name}`);
        console.log(`   Asset Type: ${template.asset_type}`);
        console.log(`   ID: ${template.id}\n`);
      });
    }
    
    console.log('========================================\n');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

testTemplates();

