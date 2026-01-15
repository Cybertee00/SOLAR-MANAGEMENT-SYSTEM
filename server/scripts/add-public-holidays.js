/**
 * Add South African Public Holidays to the calendar_events table
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

// South African Public Holidays for 2026
const SA_PUBLIC_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-03-21', name: 'Human Rights Day' },
  { date: '2026-03-23', name: 'Human Rights Day (Observed)' }, // Mar 21 is Saturday, observed Monday
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Family Day (Easter Monday)' },
  { date: '2026-04-27', name: 'Freedom Day' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-06-16', name: 'Youth Day' },
  { date: '2026-08-09', name: "National Women's Day" },
  { date: '2026-08-10', name: "National Women's Day (Observed)" }, // Aug 9 is Sunday, observed Monday
  { date: '2026-09-24', name: 'Heritage Day' },
  { date: '2026-12-16', name: 'Day of Reconciliation' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Day of Goodwill' },
];

async function addPublicHolidays() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'checksheets_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('Connecting to database...\n');
    
    // Check existing holidays
    const existing = await pool.query(`
      SELECT event_date, task_title 
      FROM calendar_events 
      WHERE LOWER(task_title) LIKE '%holiday%'
        AND EXTRACT(YEAR FROM event_date) = 2026
      ORDER BY event_date
    `);
    
    console.log('Existing holidays in database:');
    if (existing.rows.length === 0) {
      console.log('  (none)');
    } else {
      existing.rows.forEach(row => {
        const d = new Date(row.event_date);
        console.log(`  ${row.event_date.toISOString().split('T')[0]}: ${row.task_title}`);
      });
    }
    
    console.log('\n--- Adding/Updating South African Public Holidays ---\n');
    
    let added = 0;
    let updated = 0;
    
    for (const holiday of SA_PUBLIC_HOLIDAYS_2026) {
      // Check if holiday already exists
      const check = await pool.query(`
        SELECT id FROM calendar_events 
        WHERE event_date = $1 
          AND (LOWER(task_title) LIKE '%holiday%' OR LOWER(task_title) = LOWER($2))
      `, [holiday.date, holiday.name]);
      
      if (check.rows.length > 0) {
        // Update existing
        await pool.query(`
          UPDATE calendar_events 
          SET task_title = $1, frequency = 'public holiday', updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [`Public Holiday - ${holiday.name}`, check.rows[0].id]);
        console.log(`  ✓ Updated: ${holiday.date} - ${holiday.name}`);
        updated++;
      } else {
        // Insert new
        await pool.query(`
          INSERT INTO calendar_events (event_date, task_title, frequency, description)
          VALUES ($1, $2, 'public holiday', $3)
        `, [holiday.date, `Public Holiday - ${holiday.name}`, `South African Public Holiday: ${holiday.name}`]);
        console.log(`  + Added: ${holiday.date} - ${holiday.name}`);
        added++;
      }
    }
    
    console.log(`\n--- Summary ---`);
    console.log(`  Added: ${added} holidays`);
    console.log(`  Updated: ${updated} holidays`);
    
    // Show final list
    const final = await pool.query(`
      SELECT event_date, task_title, frequency
      FROM calendar_events 
      WHERE frequency = 'public holiday'
        AND EXTRACT(YEAR FROM event_date) = 2026
      ORDER BY event_date
    `);
    
    console.log(`\n--- All Public Holidays in 2026 ---`);
    final.rows.forEach(row => {
      const d = new Date(row.event_date);
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      console.log(`  ${dateStr} (${dayName}): ${row.task_title}`);
    });
    
    console.log('\n✓ Public holidays added successfully!');
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addPublicHolidays();
