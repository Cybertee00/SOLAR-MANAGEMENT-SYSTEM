/**
 * Cleanup script to remove initial cycles that were created automatically
 * Cycles should only be created when task actually starts (first tracker marked)
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

async function cleanupInitialCycles() {
  console.log('='.repeat(80));
  console.log('CLEANUP INITIAL CYCLES');
  console.log('='.repeat(80));
  console.log('\nRemoving cycles that were created automatically...');
  console.log('Cycles will be created when tasks actually start (first tracker marked).\n');

  try {
    // Check current cycles
    const checkResult = await pool.query(`
      SELECT task_type, cycle_number, started_at, completed_at
      FROM tracker_cycles
      ORDER BY task_type, cycle_number
    `);

    console.log(`Found ${checkResult.rows.length} cycle(s) in database:\n`);
    checkResult.rows.forEach(cycle => {
      console.log(`  - ${cycle.task_type}: Cycle ${cycle.cycle_number} (Started: ${cycle.started_at}, Completed: ${cycle.completed_at || 'No'})`);
    });

    if (checkResult.rows.length === 0) {
      console.log('\n✓ No cycles to clean up. Database is already clean.\n');
      return;
    }

    // Delete all cycles (they will be recreated when tasks start)
    const deleteResult = await pool.query(`
      DELETE FROM tracker_cycles
      RETURNING task_type, cycle_number
    `);

    console.log(`\n✓ Removed ${deleteResult.rows.length} cycle(s):\n`);
    deleteResult.rows.forEach(cycle => {
      console.log(`  - Removed: ${cycle.task_type} Cycle ${cycle.cycle_number}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(80));
    console.log('\nNote: Cycles will be automatically created when:');
    console.log('  - First tracker status is approved for grass_cutting or panel_wash');
    console.log('  - This ensures cycles only count when work actually begins\n');

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupInitialCycles()
  .then(() => {
    console.log('Cleanup script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup script failed:', error);
    process.exit(1);
  });
