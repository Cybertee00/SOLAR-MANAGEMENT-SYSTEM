/**
 * Remove invalid inventory items from database
 * Removes items with item_code = "0" or description = "0" (parsing errors)
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

async function removeInvalidItems() {
  console.log('='.repeat(80));
  console.log('REMOVING INVALID INVENTORY ITEMS');
  console.log('='.repeat(80));
  console.log('\nSearching for invalid items (item_code = "0" or description = "0")...\n');

  try {
    // Find invalid items
    const findResult = await pool.query(`
      SELECT id, section, item_code, item_description, part_type, min_level, actual_qty
      FROM inventory_items
      WHERE item_code = '0' OR item_description = '0' OR (item_code = '0' AND item_description = '0')
      ORDER BY section, item_code
    `);

    const invalidItems = findResult.rows;
    
    if (invalidItems.length === 0) {
      console.log('✓ No invalid items found. Database is clean.\n');
      return;
    }

    console.log(`Found ${invalidItems.length} invalid item(s):\n`);
    invalidItems.forEach((item, idx) => {
      console.log(`${idx + 1}. ID: ${item.id}`);
      console.log(`   Item Code: "${item.item_code}"`);
      console.log(`   Description: "${item.item_description || '-'}"`);
      console.log(`   Section: ${item.section || '-'}`);
      console.log(`   Part Type: ${item.part_type || '-'}`);
      console.log(`   Min Level: ${item.min_level}`);
      console.log(`   Actual Qty: ${item.actual_qty}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('REMOVING INVALID ITEMS');
    console.log('='.repeat(80));
    console.log('');

    // Remove invalid items
    const deleteResult = await pool.query(`
      DELETE FROM inventory_items
      WHERE item_code = '0' OR item_description = '0' OR (item_code = '0' AND item_description = '0')
      RETURNING id, item_code, item_description, section
    `);

    console.log(`✓ Removed ${deleteResult.rows.length} invalid item(s):\n`);
    deleteResult.rows.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Removed: ${item.item_code} - ${item.item_description || '-'} (Section: ${item.section || '-'})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

removeInvalidItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
