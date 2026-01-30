/**
 * Script to wipe all tracker status requests and reset map colors
 * This ensures a fresh start - all approvals are removed and map is reset to white
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getCompanySubDir } = require('../utils/organizationStorage');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const pool = new Pool(config);

async function wipeTrackerApprovals() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🗑️  Wiping all tracker status requests and related notifications...');
    
    // Delete all notifications related to tracker status requests
    const notifResult = await client.query(`
      DELETE FROM notifications 
      WHERE type = 'tracker_status_request' 
         OR type = 'tracker_status_approved' 
         OR type = 'tracker_status_rejected'
         OR (metadata IS NOT NULL AND (metadata->>'request_id')::text IS NOT NULL)
      RETURNING id
    `);
    console.log(`✅ Deleted ${notifResult.rowCount} notification(s)`);
    
    // Delete all tracker status requests
    const requestResult = await client.query(`
      DELETE FROM tracker_status_requests
      RETURNING id
    `);
    console.log(`✅ Deleted ${requestResult.rowCount} tracker status request(s)`);
    
    await client.query('COMMIT');
    console.log('✅ All tracker status requests and notifications wiped successfully');
    
    // Now reset all map structures to white colors
    console.log('\n🔄 Resetting all map structures to white colors...');
    
    // Get all organizations
    const orgsResult = await client.query('SELECT id, slug FROM organizations');
    const organizations = orgsResult.rows;
    
    console.log(`Found ${organizations.length} organization(s)`);
    
    for (const org of organizations) {
      try {
        // Load structure from file
        const plantDir = getCompanySubDir(org.slug, 'plant');
        const mapFilePath = path.join(plantDir, 'map-structure.json');
        
        if (fs.existsSync(mapFilePath)) {
          const fileContent = fs.readFileSync(mapFilePath, 'utf8');
          const mapData = JSON.parse(fileContent);
          
          if (mapData && Array.isArray(mapData.structure)) {
            let resetCount = 0;
            mapData.structure.forEach(tracker => {
              if (tracker.id && tracker.id.startsWith('M') && /^M\d{2}$/.test(tracker.id)) {
                const hadGrassColor = tracker.grassCuttingColor && tracker.grassCuttingColor !== '#ffffff';
                const hadPanelColor = tracker.panelWashColor && tracker.panelWashColor !== '#ffffff';
                
                delete tracker.grassCuttingColor;
                delete tracker.panelWashColor;
                tracker.grassCuttingColor = '#ffffff';
                tracker.panelWashColor = '#ffffff';
                
                if (hadGrassColor || hadPanelColor) {
                  resetCount++;
                }
              }
            });
            
            // Update version
            mapData.version = (mapData.version || 0) + 1;
            mapData.updated_at = new Date().toISOString();
            
            // Save back to file
            fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 2), { encoding: 'utf8', flag: 'w' });
            console.log(`  ✅ ${org.slug}: Reset ${resetCount} tracker(s) to white (version ${mapData.version})`);
            
            // Also update database
            await client.query(`
              INSERT INTO plant_map_structure (structure_data, version, organization_id)
              VALUES ($1, $2, $3)
            `, [JSON.stringify(mapData.structure), mapData.version, org.id]);
          }
        } else {
          console.log(`  ⚠️  ${org.slug}: No map file found, skipping`);
        }
      } catch (error) {
        console.error(`  ❌ ${org.slug}: Error resetting map - ${error.message}`);
      }
    }
    
    console.log('\n✅ Complete! All tracker approvals wiped and maps reset to white.');
    console.log('   The map will now wait for new tracker status updates.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

wipeTrackerApprovals()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
