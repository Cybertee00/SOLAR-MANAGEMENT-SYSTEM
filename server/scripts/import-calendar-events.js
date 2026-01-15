// Import parsed calendar events from Excel into the database
// Run from server directory: node scripts/import-calendar-events.js

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function importCalendarEvents() {
  try {
    console.log('='.repeat(80));
    console.log('IMPORTING CALENDAR EVENTS FROM EXCEL');
    console.log('='.repeat(80));
    
    // Load parsed events
    const eventsPath = path.join(__dirname, '../../calendar-events-parsed.json');
    
    if (!fs.existsSync(eventsPath)) {
      console.error(`Events file not found: ${eventsPath}`);
      console.log('Please run the calendar parser first: node scripts/parse-calendar-tasks.js');
      process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    const events = data.events || [];
    
    console.log(`\nLoaded ${events.length} events from file\n`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const event of events) {
      try {
        // Check if event already exists (same date and task title)
        const existing = await pool.query(
          'SELECT id FROM calendar_events WHERE event_date = $1 AND task_title = $2',
          [event.date, event.task_title]
        );
        
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }
        
        // Insert new event
        await pool.query(
          `INSERT INTO calendar_events 
           (event_date, task_title, procedure_code, frequency, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [
            event.date,
            event.task_title,
            event.procedure_code || null,
            event.frequency || null
          ]
        );
        
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`  Imported ${imported} events...`);
        }
        
      } catch (error) {
        console.error(`✗ Error importing event ${event.date}: ${event.task_title.substring(0, 50)}...`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Imported: ${imported}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total: ${events.length}`);
    console.log('\n✓ Import complete!');
    console.log('\nRefresh your browser to see the events in the Calendar.');
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  importCalendarEvents()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importCalendarEvents };
