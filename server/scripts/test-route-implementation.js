/**
 * Test Script: Verify Route Implementation
 * Checks that routes use getDb() and have proper organization filtering
 */

const fs = require('fs');
const path = require('path');

async function testRouteImplementation() {
  console.log('🔍 Testing Route Implementation...\n');
  
  const routesDir = path.join(__dirname, '..', 'routes');
  const routesToCheck = [
    { file: 'tasks.js', route: 'GET /', checkGetDb: true, checkFilter: true },
    { file: 'inventory.js', route: 'GET /items', checkGetDb: true, checkFilter: true },
    { file: 'calendar.js', route: 'GET /', checkGetDb: true, checkFilter: true },
    { file: 'cmLetters.js', route: 'GET /', checkGetDb: true, checkFilter: true },
    { file: 'plant.js', route: 'GET /structure', checkGetDb: true, checkFilter: true }
  ];
  
  console.log('📋 Checking Route Handlers:\n');
  
  let allCorrect = true;
  
  for (const routeCheck of routesToCheck) {
    const filePath = path.join(routesDir, routeCheck.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ ${routeCheck.file}: File not found`);
      allCorrect = false;
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Check for getDb usage
    if (routeCheck.checkGetDb) {
      if (content.includes('getDb(req, pool)') || content.includes('getDb(req, pool)')) {
        console.log(`   ✅ ${routeCheck.file} (${routeCheck.route}): Uses getDb()`);
      } else {
        console.log(`   ⚠️  ${routeCheck.file} (${routeCheck.route}): May not use getDb()`);
      }
    }
    
    // Check for organization filter
    if (routeCheck.checkFilter) {
      if (content.includes('isSystemOwnerWithoutCompany')) {
        console.log(`   ✅ ${routeCheck.file} (${routeCheck.route}): Has organization filter`);
      } else {
        console.log(`   ⚠️  ${routeCheck.file} (${routeCheck.route}): May not have organization filter`);
      }
    }
  }
  
  // Check server/index.js for middleware
  console.log('\n📦 Checking Middleware Configuration:\n');
  const serverIndexPath = path.join(__dirname, '..', 'index.js');
  const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');
  
  const requiredRoutes = [
    '/api/tasks',
    '/api/cm-letters',
    '/api/inventory',
    '/api/calendar',
    '/api/plant'
  ];
  
  for (const route of requiredRoutes) {
    const routePattern = `app.use('${route}'`;
    if (serverIndexContent.includes(routePattern)) {
      const routeLine = serverIndexContent.split('\n').find(line => line.includes(routePattern));
      if (routeLine && routeLine.includes('tenantContextMiddleware')) {
        console.log(`   ✅ ${route}: Has tenantContextMiddleware`);
      } else {
        console.log(`   ❌ ${route}: MISSING tenantContextMiddleware`);
        allCorrect = false;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (allCorrect) {
    console.log('✅ ROUTE IMPLEMENTATION VERIFIED');
  } else {
    console.log('⚠️  SOME ISSUES FOUND - Please review warnings above');
  }
  console.log('='.repeat(60) + '\n');
}

testRouteImplementation().catch(console.error);
