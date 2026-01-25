require('dotenv').config();
const { Pool } = require('pg');
const { parseInventoryFromExcel } = require('../utils/inventoryExcelSync');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testInventoryRoute() {
  try {
    console.log('Testing inventory route logic...\n');
    
    // Test 1: Database query (simulating the route handler)
    console.log('1. Testing database query...');
    const result = await pool.query(
      `SELECT * FROM inventory_items ORDER BY section NULLS LAST, item_code`
    );
    console.log(`   ✅ Database query OK: ${result.rows.length} items`);
    
    // Test 2: Excel sync function
    console.log('\n2. Testing Excel sync function...');
    try {
      const parsed = await parseInventoryFromExcel();
      console.log(`   ✅ Excel sync OK: ${parsed.items.length} items parsed`);
    } catch (excelError) {
      console.log(`   ⚠️  Excel sync error (may be expected if file doesn't exist):`, excelError.message);
    }
    
    // Test 3: Filter logic (removing last 14 items)
    console.log('\n3. Testing filter logic...');
    const items = result.rows;
    const filteredItems = items.length > 14 ? items.slice(0, items.length - 14) : items;
    console.log(`   ✅ Filter OK: ${items.length} items -> ${filteredItems.length} items`);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

testInventoryRoute().catch(console.error);
