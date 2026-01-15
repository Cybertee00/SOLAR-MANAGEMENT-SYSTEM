/**
 * Test script for Fault Log Generator
 * Tests if the generator correctly retrieves CM letters and maps fault log data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const { generateFaultLogExcel } = require('../utils/faultLogGenerator');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'checksheets_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function testFaultLogGenerator() {
  try {
    console.log('=== TESTING FAULT LOG GENERATOR ===\n');
    
    // Test 1: Check CM letters in database
    console.log('Test 1: Checking CM letters in database...');
    const cmCheck = await pool.query(`
      SELECT 
        id, 
        letter_number, 
        generated_at,
        plant,
        fault_description,
        affected_plant_functionality,
        main_affected_item,
        production_affected,
        affected_item_line,
        affected_item_cabinet,
        affected_item_inverter,
        affected_item_comb_box,
        affected_item_bb_tracker,
        code_error,
        failure_cause,
        action_taken
      FROM cm_letters 
      ORDER BY generated_at DESC 
      LIMIT 5
    `);
    
    console.log(`Found ${cmCheck.rows.length} CM letters (showing latest 5):`);
    cmCheck.rows.forEach((cm, idx) => {
      const hasFaultLog = cm.plant || cm.fault_description || cm.main_affected_item;
      console.log(`  ${idx + 1}. ${cm.letter_number} - ${hasFaultLog ? 'HAS' : 'NO'} fault log data`);
      if (hasFaultLog) {
        console.log(`     Plant: ${cm.plant || '(empty)'}`);
        console.log(`     Fault: ${cm.fault_description || '(empty)'}`);
        console.log(`     Main Item: ${cm.main_affected_item || '(empty)'}`);
      }
    });
    console.log('');
    
    // Test 2: Generate fault log for "all" period
    console.log('Test 2: Generating fault log Excel for "all" period...');
    const buffer = await generateFaultLogExcel(pool, { period: 'all' });
    console.log(`✓ Excel generated successfully! Size: ${buffer.length} bytes\n`);
    
    // Test 3: Save test file
    const testOutputPath = path.join(__dirname, '../test_fault_log_output.xlsx');
    fs.writeFileSync(testOutputPath, buffer);
    console.log(`Test 3: Saved test Excel file to: ${testOutputPath}`);
    console.log(`✓ You can open this file to verify the data is correctly mapped\n`);
    
    // Test 4: Test different periods
    console.log('Test 4: Testing different periods...');
    const periods = ['weekly', 'monthly', 'yearly'];
    for (const period of periods) {
      try {
        const periodBuffer = await generateFaultLogExcel(pool, { period });
        console.log(`  ✓ ${period}: Generated ${periodBuffer.length} bytes`);
      } catch (err) {
        console.log(`  ✗ ${period}: Error - ${err.message}`);
      }
    }
    console.log('');
    
    // Test 5: Verify data mapping by checking query results
    console.log('Test 5: Verifying data retrieval...');
    const queryTest = await pool.query(`
      SELECT 
        cm.id,
        cm.letter_number,
        cm.plant,
        cm.fault_description,
        cm.affected_plant_functionality,
        cm.main_affected_item,
        cm.production_affected,
        cm.affected_item_line,
        cm.affected_item_cabinet,
        cm.affected_item_inverter,
        cm.affected_item_comb_box,
        cm.affected_item_bb_tracker,
        cm.code_error,
        cm.failure_cause,
        cm.action_taken,
        cm.generated_at,
        t.started_at,
        t.completed_at
      FROM cm_letters cm
      LEFT JOIN tasks t ON cm.task_id = t.id
      WHERE cm.plant IS NOT NULL OR cm.fault_description IS NOT NULL
      ORDER BY cm.generated_at DESC
      LIMIT 3
    `);
    
    console.log(`Retrieved ${queryTest.rows.length} CM letters with fault log data:`);
    queryTest.rows.forEach((cm, idx) => {
      console.log(`  ${idx + 1}. ${cm.letter_number}:`);
      console.log(`     - Plant: ${cm.plant || '(empty)'}`);
      console.log(`     - Fault Description: ${cm.fault_description || '(empty)'}`);
      console.log(`     - Main Affected Item: ${cm.main_affected_item || '(empty)'}`);
      console.log(`     - Affected Items: Cabinet=${cm.affected_item_cabinet || ''}, Inverter=${cm.affected_item_inverter || ''}, BB/Tracker=${cm.affected_item_bb_tracker || ''}`);
      console.log(`     - Failure Cause: ${cm.failure_cause || '(empty)'}`);
      console.log(`     - Action Taken: ${cm.action_taken || '(empty)'}`);
    });
    console.log('');
    
    console.log('=== TEST SUMMARY ===');
    console.log('✓ All tests completed successfully!');
    console.log(`✓ Test Excel file saved to: ${testOutputPath}`);
    console.log('✓ Please open the test file to verify:');
    console.log('  1. All CM letters are included');
    console.log('  2. All fault log fields are mapped to correct columns');
    console.log('  3. Template structure is preserved');
    console.log('  4. Data appears in the correct rows (starting from row 6)');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('=== TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

testFaultLogGenerator();
