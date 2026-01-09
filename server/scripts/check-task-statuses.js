const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTaskStatuses() {
  try {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM tasks
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('\n=== Task Statuses in Database ===');
    if (result.rows.length === 0) {
      console.log('No tasks found in database.');
    } else {
      result.rows.forEach(row => {
        console.log(`  ${row.status}: ${row.count} tasks`);
      });
    }
    
    // Also check a few sample tasks
    const sampleResult = await pool.query(`
      SELECT id, task_code, status, created_at, completed_at
      FROM tasks
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('\n=== Sample Tasks (Last 10) ===');
    sampleResult.rows.forEach(task => {
      console.log(`  ${task.task_code}: ${task.status} (created: ${task.created_at}, completed: ${task.completed_at || 'N/A'})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error checking task statuses:', error);
    await pool.end();
  }
}

checkTaskStatuses();
