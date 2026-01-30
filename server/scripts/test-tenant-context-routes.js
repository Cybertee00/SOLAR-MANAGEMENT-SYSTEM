/**
 * Test Script: Verify Tenant Context Middleware on Routes
 * Checks that routes have tenantContextMiddleware and can access organization context
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

async function testTenantContextRoutes() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing Tenant Context Middleware Configuration...\n');
    
    // Read server/index.js to check route configurations
    const serverIndexPath = path.join(__dirname, '..', 'index.js');
    const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');
    
    // Routes that MUST have tenantContextMiddleware
    const requiredRoutes = [
      { path: '/api/tasks', line: 'app.use(\'/api/tasks\'' },
      { path: '/api/cm-letters', line: 'app.use(\'/api/cm-letters\'' },
      { path: '/api/inventory', line: 'app.use(\'/api/inventory\'' },
      { path: '/api/calendar', line: 'app.use(\'/api/calendar\'' },
      { path: '/api/plant', line: 'app.use(\'/api/plant\'' }
    ];
    
    console.log('📋 Checking Route Configurations:\n');
    
    let allCorrect = true;
    
    for (const route of requiredRoutes) {
      // Find the line with this route
      const lines = serverIndexContent.split('\n');
      let routeLine = null;
      let lineNumber = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(route.line)) {
          routeLine = lines[i];
          lineNumber = i + 1;
          break;
        }
      }
      
      if (!routeLine) {
        console.log(`   ❌ ${route.path}: Route definition not found`);
        allCorrect = false;
        continue;
      }
      
      // Check if tenantContextMiddleware is present
      if (routeLine.includes('tenantContextMiddleware')) {
        console.log(`   ✅ ${route.path} (line ${lineNumber}): Has tenantContextMiddleware`);
      } else {
        console.log(`   ❌ ${route.path} (line ${lineNumber}): MISSING tenantContextMiddleware`);
        console.log(`      Current: ${routeLine.trim()}`);
        allCorrect = false;
      }
    }
    
    // Check if tenantContextMiddleware is imported
    console.log('\n📦 Checking Middleware Import:\n');
    if (serverIndexContent.includes('setTenantContext')) {
      console.log('   ✅ tenantContextMiddleware is imported');
    } else {
      console.log('   ❌ tenantContextMiddleware is NOT imported');
      allCorrect = false;
    }
    
    // Get Smart Innovations Energy organization for testing
    console.log('\n🏢 Testing Organization Context:\n');
    const orgResult = await client.query(`
      SELECT id, name, slug 
      FROM organizations 
      WHERE slug = 'smart-innovations-energy' 
      LIMIT 1
    `);
    
    if (orgResult.rows.length === 0) {
      console.log('   ⚠️  Smart Innovations Energy organization not found');
    } else {
      const org = orgResult.rows[0];
      console.log(`   ✅ Found Organization: ${org.name} (${org.slug})`);
      console.log(`      ID: ${org.id}`);
      
      // Test data counts
      console.log('\n📊 Data Available for Testing:\n');
      const tests = [
        { name: 'Tasks', query: 'SELECT COUNT(*) as count FROM tasks WHERE organization_id = $1' },
        { name: 'Inventory Items', query: 'SELECT COUNT(*) as count FROM inventory_items WHERE organization_id = $1' },
        { name: 'Calendar Events', query: 'SELECT COUNT(*) as count FROM calendar_events WHERE organization_id = $1' },
        { name: 'Templates', query: 'SELECT COUNT(*) as count FROM checklist_templates WHERE organization_id = $1' },
        { name: 'CM Letters', query: 'SELECT COUNT(*) as count FROM cm_letters WHERE organization_id = $1' }
      ];
      
      for (const test of tests) {
        try {
          const result = await client.query(test.query, [org.id]);
          const count = parseInt(result.rows[0].count, 10);
          console.log(`   ${test.name}: ${count} records`);
        } catch (error) {
          console.log(`   ${test.name}: ERROR - ${error.message}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    if (allCorrect) {
      console.log('✅ ALL ROUTES CORRECTLY CONFIGURED');
      console.log('\n📝 Next Steps:');
      console.log('   1. Restart your server');
      console.log('   2. Select Smart Innovations Energy as system owner');
      console.log('   3. Check Dashboard - should show data instead of zeros');
    } else {
      console.log('❌ SOME ROUTES ARE MISSING tenantContextMiddleware');
      console.log('\n⚠️  Please fix the routes marked with ❌ above');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Error testing routes:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await testTenantContextRoutes();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
