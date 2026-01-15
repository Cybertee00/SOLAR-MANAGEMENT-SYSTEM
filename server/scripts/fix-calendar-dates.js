/**
 * Fix calendar event dates that were shifted by timezone conversion
 * This script adds 1 day to all calendar events to correct for UTC conversion issues
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

async function fixCalendarDates() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'checksheets_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('Connecting to database...');
    
    // First, let's see the current state
    const beforeResult = await pool.query(`
      SELECT id, event_date, task_title 
      FROM calendar_events 
      WHERE EXTRACT(YEAR FROM event_date) = 2026
      ORDER BY event_date 
      LIMIT 20
    `);
    
    console.log('\n=== BEFORE FIX (first 20 events) ===');
    beforeResult.rows.forEach(row => {
      const date = new Date(row.event_date);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      console.log(`  ${row.event_date.toISOString().split('T')[0]} (${dayName}): ${row.task_title.substring(0, 50)}`);
    });

    // Check if events are on Sunday (which shouldn't happen for most tasks)
    const sundayCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM calendar_events 
      WHERE EXTRACT(DOW FROM event_date) = 0 
        AND EXTRACT(YEAR FROM event_date) = 2026
        AND task_title NOT LIKE '%Holiday%'
    `);
    
    console.log(`\nEvents on Sunday (excluding holidays): ${sundayCount.rows[0].count}`);

    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    const answer = await new Promise(resolve => {
      rl.question('\nDo you want to add 1 day to ALL calendar events? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('Aborted. No changes made.');
      await pool.end();
      return;
    }

    // Fix all calendar events by adding 1 day
    console.log('\nFixing calendar dates...');
    const updateResult = await pool.query(`
      UPDATE calendar_events 
      SET event_date = event_date + INTERVAL '1 day',
          updated_at = CURRENT_TIMESTAMP
      WHERE EXTRACT(YEAR FROM event_date) >= 2026
    `);
    
    console.log(`Updated ${updateResult.rowCount} calendar events`);

    // Show the result
    const afterResult = await pool.query(`
      SELECT id, event_date, task_title 
      FROM calendar_events 
      WHERE EXTRACT(YEAR FROM event_date) = 2026
      ORDER BY event_date 
      LIMIT 20
    `);
    
    console.log('\n=== AFTER FIX (first 20 events) ===');
    afterResult.rows.forEach(row => {
      const date = new Date(row.event_date);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      console.log(`  ${row.event_date.toISOString().split('T')[0]} (${dayName}): ${row.task_title.substring(0, 50)}`);
    });

    // Verify Sunday count after fix
    const sundayAfter = await pool.query(`
      SELECT COUNT(*) as count 
      FROM calendar_events 
      WHERE EXTRACT(DOW FROM event_date) = 0 
        AND EXTRACT(YEAR FROM event_date) = 2026
        AND task_title NOT LIKE '%Holiday%'
    `);
    
    console.log(`\nEvents on Sunday after fix (excluding holidays): ${sundayAfter.rows[0].count}`);
    console.log('\n✓ Calendar dates fixed successfully!');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixCalendarDates();
