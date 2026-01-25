/**
 * Quick verification that Earthwire section now has only 1 item
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'checksheets_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function verify() {
  try {
    const result = await pool.query(`
      SELECT id, section, item_code, item_description, part_type, min_level, actual_qty
      FROM inventory_items
      WHERE section ILIKE '%earthwire%'
      ORDER BY section, item_code
    `);

    console.log('='.repeat(80));
    console.log('EARTHWIRE SECTION VERIFICATION');
    console.log('='.repeat(80));
    console.log(`\nFound ${result.rows.length} item(s) under Earthwire section:\n`);
    
    if (result.rows.length === 0) {
      console.log('✓ No items found (section may be empty)');
    } else if (result.rows.length === 1) {
      console.log('✓ SUCCESS: Only 1 item found (as expected)\n');
      result.rows.forEach((item, idx) => {
        console.log(`${idx + 1}. Item Code: ${item.item_code}`);
        console.log(`   Description: ${item.item_description || '-'}`);
        console.log(`   Section: ${item.section || '-'}`);
      });
    } else {
      console.log(`⚠ WARNING: Found ${result.rows.length} items (expected 1)\n`);
      result.rows.forEach((item, idx) => {
        console.log(`${idx + 1}. Item Code: ${item.item_code}`);
        console.log(`   Description: ${item.item_description || '-'}`);
        console.log(`   Section: ${item.section || '-'}`);
        console.log('');
      });
    }

    // Check for any remaining invalid items
    const invalidResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM inventory_items
      WHERE item_code = '0' OR item_description = '0'
    `);

    const invalidCount = parseInt(invalidResult.rows[0].count, 10);
    if (invalidCount === 0) {
      console.log('\n✓ No invalid items (item_code="0" or description="0") found in database');
    } else {
      console.log(`\n⚠ WARNING: Found ${invalidCount} invalid item(s) still in database`);
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('\nERROR:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
