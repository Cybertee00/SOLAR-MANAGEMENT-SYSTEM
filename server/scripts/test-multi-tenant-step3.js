/**
 * Test Script: Multi-Tenant Step 3
 * Tests that checklist_templates table is updated for multi-tenant support
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testStep3() {
  try {
    console.log('🧪 Testing Multi-Tenant Step 3...\n');

    // Test 1: Check if columns exist
    console.log('1. Checking checklist_templates columns...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'checklist_templates'
        AND column_name IN ('organization_id', 'is_system_template', 'can_be_cloned')
      ORDER BY column_name
    `);
    
    const requiredColumns = ['organization_id', 'is_system_template', 'can_be_cloned'];
    const foundColumns = columns.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`❌ Missing columns: ${missingColumns.join(', ')}`);
    }
    console.log('✅ All required columns exist:', foundColumns.join(', '));

    // Test 2: Check indexes
    console.log('\n2. Checking indexes...');
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'checklist_templates' 
        AND indexname LIKE '%organization%'
    `);
    
    console.log(`✅ Found ${indexes.rows.length} organization-related indexes`);
    indexes.rows.forEach(idx => console.log(`   - ${idx.indexname}`));

    // Test 3: Create test organization
    console.log('\n3. Creating test organization...');
    const testOrg = await pool.query(`
      INSERT INTO organizations (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, slug
    `, ['Test Org Step3', 'test-org-step3']);
    const orgId = testOrg.rows[0].id;
    console.log('✅ Test organization created:', testOrg.rows[0].slug);

    // Test 4: Create system template (organization_id = NULL)
    console.log('\n4. Testing system template creation...');
    // First check if template already exists
    const existingSysTemplate = await pool.query(`
      SELECT id FROM checklist_templates 
      WHERE template_code = $1 AND organization_id IS NULL
    `, ['SYS-TEST-001']);
    
    let systemTemplate;
    if (existingSysTemplate.rows.length > 0) {
      // Update existing
      systemTemplate = await pool.query(`
        UPDATE checklist_templates 
        SET template_name = $1, is_system_template = true, can_be_cloned = true
        WHERE id = $2
        RETURNING id, template_code, organization_id, is_system_template, can_be_cloned
      `, ['System Test Template', existingSysTemplate.rows[0].id]);
    } else {
      // Insert new
      systemTemplate = await pool.query(`
        INSERT INTO checklist_templates (
          template_code, template_name, asset_type, task_type,
          checklist_structure, is_system_template, can_be_cloned
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, true, true)
        RETURNING id, template_code, organization_id, is_system_template, can_be_cloned
      `, [
        'SYS-TEST-001',
        'System Test Template',
        'inverter',
        'PM',
        JSON.stringify({ sections: [] })
      ]);
    }
    console.log('✅ System template created:', {
      code: systemTemplate.rows[0].template_code,
      is_system: systemTemplate.rows[0].is_system_template,
      can_clone: systemTemplate.rows[0].can_be_cloned
    });

    // Test 5: Create organization-specific template
    console.log('\n5. Testing organization-specific template creation...');
    const orgTemplate = await pool.query(`
      INSERT INTO checklist_templates (
        template_code, template_name, asset_type, task_type,
        checklist_structure, organization_id, is_system_template, can_be_cloned
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, false, false)
      RETURNING id, template_code, organization_id, is_system_template, can_be_cloned
    `, [
      'ORG-TEST-001',
      'Organization Test Template',
      'inverter',
      'PM',
      JSON.stringify({ sections: [] }),
      orgId
    ]);
    console.log('✅ Organization template created:', {
      code: orgTemplate.rows[0].template_code,
      org_id: orgTemplate.rows[0].organization_id,
      is_system: orgTemplate.rows[0].is_system_template
    });

    // Test 6: Test unique constraint (same code in same org should fail)
    console.log('\n6. Testing unique constraint...');
    try {
      await pool.query(`
        INSERT INTO checklist_templates (
          template_code, template_name, asset_type, task_type,
          checklist_structure, organization_id, is_system_template
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, false)
      `, [
        'ORG-TEST-001', // Same code
        'Duplicate Template',
        'inverter',
        'PM',
        JSON.stringify({ sections: [] }),
        orgId // Same organization
      ]);
      throw new Error('❌ Unique constraint not working - duplicate template_code allowed');
    } catch (error) {
      if (error.code === '23505') {
        console.log('✅ Unique constraint working - duplicate template_code rejected');
      } else {
        throw error;
      }
    }

    // Cleanup
    console.log('\n7. Cleaning up test data...');
    await pool.query('DELETE FROM checklist_templates WHERE id = $1', [systemTemplate.rows[0].id]);
    await pool.query('DELETE FROM checklist_templates WHERE id = $1', [orgTemplate.rows[0].id]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    console.log('✅ Test data cleaned up');

    console.log('\n✅✅✅ All Step 3 tests passed! ✅✅✅\n');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testStep3();
