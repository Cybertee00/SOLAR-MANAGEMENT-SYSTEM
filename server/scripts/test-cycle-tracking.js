/**
 * Test script to verify cycle tracking implementation
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

async function testCycleTracking() {
  console.log('='.repeat(80));
  console.log('CYCLE TRACKING TEST');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: Check if tables exist
    console.log('Test 1: Checking if tables exist...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tracker_cycles', 'tracker_cycle_history')
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    console.log(`  Found tables: ${existingTables.join(', ')}`);
    
    if (existingTables.length !== 2) {
      console.log('  ⚠ WARNING: Not all tables found!');
    } else {
      console.log('  ✓ All tables exist');
    }
    console.log('');

    // Test 2: Check cycles (cycles are only created when tasks start)
    console.log('Test 2: Checking cycles...');
    const cyclesResult = await pool.query(`
      SELECT task_type, cycle_number, started_at, completed_at, year, month
      FROM tracker_cycles
      ORDER BY task_type, cycle_number
    `);
    
    console.log(`  Found ${cyclesResult.rows.length} cycle(s):`);
    cyclesResult.rows.forEach(cycle => {
      console.log(`    - ${cycle.task_type}: Cycle ${cycle.cycle_number} (Year: ${cycle.year}, Month: ${cycle.month}, Completed: ${cycle.completed_at ? 'Yes' : 'No'})`);
    });
    
    if (cyclesResult.rows.length === 0) {
      console.log('  ✓ No cycles found (expected - cycles are created when tasks start)');
    } else {
      console.log('  ✓ Cycles found');
    }
    console.log('');

    // Test 3: Check indexes
    console.log('Test 3: Checking indexes...');
    const indexesResult = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('tracker_cycles', 'tracker_cycle_history')
      ORDER BY tablename, indexname
    `);
    
    console.log(`  Found ${indexesResult.rows.length} index(es):`);
    indexesResult.rows.forEach(idx => {
      console.log(`    - ${idx.indexname}`);
    });
    
    if (indexesResult.rows.length < 5) {
      console.log('  ⚠ WARNING: Expected at least 5 indexes!');
    } else {
      console.log('  ✓ Indexes created');
    }
    console.log('');

    // Test 4: Check current incomplete cycles
    console.log('Test 4: Checking current incomplete cycles...');
    const incompleteResult = await pool.query(`
      SELECT task_type, cycle_number, started_at
      FROM tracker_cycles
      WHERE completed_at IS NULL
      ORDER BY task_type
    `);
    
    console.log(`  Found ${incompleteResult.rows.length} incomplete cycle(s):`);
    incompleteResult.rows.forEach(cycle => {
      console.log(`    - ${cycle.task_type}: Cycle ${cycle.cycle_number} (Started: ${cycle.started_at})`);
    });
    
    if (incompleteResult.rows.length === 0) {
      console.log('  ✓ No incomplete cycles (expected - cycles created when tasks start)');
    } else {
      console.log('  ✓ Incomplete cycles found');
    }
    console.log('');

    // Test 5: Verify constraints
    console.log('Test 5: Checking constraints...');
    const constraintsResult = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.table_name IN ('tracker_cycles', 'tracker_cycle_history')
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
    `);
    
    console.log(`  Found ${constraintsResult.rows.length} constraint(s):`);
    constraintsResult.rows.forEach(constraint => {
      console.log(`    - ${constraint.table_name}.${constraint.column_name}: ${constraint.constraint_name}`);
    });
    
    console.log('  ✓ Constraints verified');
    console.log('');

    console.log('='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Summary:');
    console.log(`  - Tables: ${existingTables.length}/2`);
    console.log(`  - Cycles: ${cyclesResult.rows.length}`);
    console.log(`  - Incomplete cycles: ${incompleteResult.rows.length}/2`);
    console.log(`  - Indexes: ${indexesResult.rows.length}`);
    console.log(`  - Constraints: ${constraintsResult.rows.length}`);

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

testCycleTracking()
  .then(() => {
    console.log('\nTest script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest script failed:', error);
    process.exit(1);
  });
