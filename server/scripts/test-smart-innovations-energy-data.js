/**
 * Test Script: Verify Smart Innovations Energy Data
 * Checks what data exists for Smart Innovations Energy organization
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '0000',
});

async function testSmartInnovationsEnergyData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing Smart Innovations Energy Data Access...\n');
    
    // Get Smart Innovations Energy organization
    const orgResult = await client.query(`
      SELECT id, name, slug 
      FROM organizations 
      WHERE slug = 'smart-innovations-energy' 
      LIMIT 1
    `);
    
    if (orgResult.rows.length === 0) {
      console.error('❌ Smart Innovations Energy organization not found');
      process.exit(1);
    }
    
    const org = orgResult.rows[0];
    console.log(`✅ Found Organization: ${org.name} (${org.slug})`);
    console.log(`   ID: ${org.id}\n`);
    
    // Test data counts
    const tests = [
      { name: 'Tasks', query: 'SELECT COUNT(*) as count FROM tasks WHERE organization_id = $1', table: 'tasks' },
      { name: 'Inventory Items', query: 'SELECT COUNT(*) as count FROM inventory_items WHERE organization_id = $1', table: 'inventory_items' },
      { name: 'Calendar Events', query: 'SELECT COUNT(*) as count FROM calendar_events WHERE organization_id = $1', table: 'calendar_events' },
      { name: 'CM Letters', query: 'SELECT COUNT(*) as count FROM cm_letters WHERE organization_id = $1', table: 'cm_letters' },
      { name: 'Templates', query: 'SELECT COUNT(*) as count FROM checklist_templates WHERE organization_id = $1', table: 'checklist_templates' },
      { name: 'Users', query: 'SELECT COUNT(*) as count FROM users WHERE organization_id = $1', table: 'users' },
      { name: 'Plant Map Structure', query: 'SELECT COUNT(*) as count FROM plant_map_structure WHERE organization_id = $1', table: 'plant_map_structure' }
    ];
    
    console.log('📊 Data Counts for Smart Innovations Energy:\n');
    for (const test of tests) {
      try {
        const result = await client.query(test.query, [org.id]);
        const count = parseInt(result.rows[0].count, 10);
        console.log(`   ${test.name}: ${count} records`);
      } catch (error) {
        console.log(`   ${test.name}: ERROR - ${error.message}`);
      }
    }
    
    // Check file system
    console.log('\n📁 File System Check:\n');
    const serverDir = path.join(__dirname, '..');
    const companyDir = path.join(serverDir, 'uploads', 'companies', 'smart-innovations-energy');
    
    if (fs.existsSync(companyDir)) {
      console.log(`   ✅ Company directory exists: ${companyDir}`);
      
      const subdirs = ['templates', 'inventory', 'cm_letters', 'plant', 'logos', 'profiles', 'reports'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(companyDir, subdir);
        if (fs.existsSync(subdirPath)) {
          const files = fs.readdirSync(subdirPath);
          console.log(`   ✅ ${subdir}/: ${files.length} file(s)`);
          if (files.length > 0 && files.length <= 5) {
            files.forEach(file => console.log(`      - ${file}`));
          } else if (files.length > 5) {
            console.log(`      - ${files.slice(0, 5).join(', ')} ... and ${files.length - 5} more`);
          }
        } else {
          console.log(`   ⚠️  ${subdir}/: Directory not found`);
        }
      }
      
      // Check for logo
      const logoPath = path.join(companyDir, 'logos', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const stats = fs.statSync(logoPath);
        console.log(`   ✅ logos/logo.png: ${(stats.size / 1024).toFixed(2)} KB`);
      } else {
        console.log(`   ⚠️  logos/logo.png: Not found`);
      }
      
      // Check for plant map
      const plantMapPath = path.join(companyDir, 'plant', 'map-structure.json');
      if (fs.existsSync(plantMapPath)) {
        const stats = fs.statSync(plantMapPath);
        const content = JSON.parse(fs.readFileSync(plantMapPath, 'utf8'));
        const trackerCount = Array.isArray(content.structure) ? content.structure.length : 0;
        console.log(`   ✅ plant/map-structure.json: ${(stats.size / 1024).toFixed(2)} KB, ${trackerCount} trackers`);
      } else {
        console.log(`   ⚠️  plant/map-structure.json: Not found`);
      }
    } else {
      console.log(`   ❌ Company directory not found: ${companyDir}`);
    }
    
    // Check branding
    console.log('\n🎨 Branding Check:\n');
    const brandingResult = await client.query(`
      SELECT primary_color, secondary_color, company_name_display, logo_url
      FROM organization_branding
      WHERE organization_id = $1
    `, [org.id]);
    
    if (brandingResult.rows.length > 0) {
      const branding = brandingResult.rows[0];
      console.log(`   Primary Color: ${branding.primary_color || 'NULL'}`);
      console.log(`   Secondary Color: ${branding.secondary_color || 'NULL'}`);
      console.log(`   Display Name: ${branding.company_name_display || 'NULL'}`);
      console.log(`   Logo URL: ${branding.logo_url || 'NULL'}`);
    } else {
      console.log('   ⚠️  No branding record found');
    }
    
    console.log('\n✅ Test Complete\n');
    console.log('📝 Expected Behavior When Entering Smart Innovations Energy:');
    console.log('   1. Dashboard: Shows all Smart Innovations Energy data (tasks, inventory, calendar, plant map)');
    console.log('   2. Tasks: Shows only Smart Innovations Energy tasks');
    console.log('   3. Templates: Shows only Smart Innovations Energy templates');
    console.log('   4. CM Letters: Shows only Smart Innovations Energy CM letters');
    console.log('   5. Inventory: Shows only Smart Innovations Energy inventory items');
    console.log('   6. Calendar: Shows only Smart Innovations Energy calendar events');
    console.log('   7. Plant: Shows Smart Innovations Energy plant map (Witkop solar farm)');
    console.log('   8. Users: Shows all users (system owners + Smart Innovations Energy users)');
    console.log('   9. Notifications: Shows notifications for current logged-in user');
    console.log('   10. Logo: Loads from uploads/companies/smart-innovations-energy/logos/logo.png');
    console.log('   11. Colors: Applies Smart Innovations Energy colors (#1A73E8 / #4285F4)');
    
  } catch (error) {
    console.error('❌ Error testing data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await testSmartInnovationsEnergyData();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
