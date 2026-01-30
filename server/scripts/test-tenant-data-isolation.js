/**
 * Test script to verify data isolation when accessing different organizations
 * This simulates what happens when a system owner "enters" different companies
 */

const fetch = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'tech1';

// You'll need to provide these after logging in
let sessionCookie = null;
let organizations = [];

async function login() {
  console.log('🔐 Logging in...');
  
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  // Extract session cookie
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
    console.log('✅ Login successful');
    return true;
  }
  
  throw new Error('No session cookie received');
}

async function getOrganizations() {
  console.log('\n📋 Fetching organizations...');
  
  const response = await fetch(`${API_BASE_URL}/platform/organizations`, {
    headers: {
      'Cookie': sessionCookie
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch organizations: ${response.statusText}`);
  }

  const data = await response.json();
  organizations = data.organizations || [];
  console.log(`✅ Found ${organizations.length} organizations:`);
  organizations.forEach(org => {
    console.log(`   - ${org.name} (${org.slug})`);
  });
  return organizations;
}

async function enterOrganization(orgId) {
  console.log(`\n🚪 Entering organization: ${orgId}...`);
  
  const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/enter`, {
    method: 'POST',
    headers: {
      'Cookie': sessionCookie,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to enter organization: ${response.statusText}`);
  }

  console.log('✅ Successfully entered organization');
  return true;
}

async function exitOrganization() {
  console.log('\n🚪 Exiting organization...');
  
  const response = await fetch(`${API_BASE_URL}/organizations/exit`, {
    method: 'POST',
    headers: {
      'Cookie': sessionCookie,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to exit organization: ${response.statusText}`);
  }

  console.log('✅ Successfully exited organization');
  return true;
}

async function getTenantData(endpoint, description) {
  const response = await fetch(`${API_BASE_URL}/tenant/${endpoint}`, {
    headers: {
      'Cookie': sessionCookie
    }
  });

  if (!response.ok) {
    return { error: response.statusText, count: 0 };
  }

  const data = await response.json();
  
  // Try to extract count from various response formats
  let count = 0;
  if (Array.isArray(data)) {
    count = data.length;
  } else if (data.items && Array.isArray(data.items)) {
    count = data.items.length;
  } else if (data.count !== undefined) {
    count = data.count;
  } else if (data.total !== undefined) {
    count = data.total;
  } else if (data.data && Array.isArray(data.data)) {
    count = data.data.length;
  }

  return { count, data };
}

async function testOrganizationData(org) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 Testing: ${org.name} (${org.slug})`);
  console.log('─'.repeat(80));

  await enterOrganization(org.id);

  const endpoints = [
    { endpoint: 'assets', description: 'Assets' },
    { endpoint: 'tasks', description: 'Tasks' },
    { endpoint: 'templates', description: 'Templates' },
    { endpoint: 'users', description: 'Users' },
    { endpoint: 'dashboard/stats', description: 'Dashboard Stats' },
  ];

  const results = {};
  
  for (const { endpoint, description } of endpoints) {
    try {
      const result = await getTenantData(endpoint, description);
      results[description] = result.count || 0;
      console.log(`  ${description}: ${result.count || 0} records`);
    } catch (error) {
      console.log(`  ${description}: Error - ${error.message}`);
      results[description] = 'ERROR';
    }
  }

  await exitOrganization();
  
  return results;
}

async function main() {
  try {
    console.log('🧪 Tenant Data Isolation Test\n');
    console.log('This script verifies that other organizations have no data.\n');

    // Login
    await login();

    // Get organizations
    await getOrganizations();

    if (organizations.length === 0) {
      console.log('\n⚠️  No organizations found. Cannot test.');
      return;
    }

    // Test each organization
    const allResults = {};
    
    for (const org of organizations) {
      const results = await testOrganizationData(org);
      allResults[org.name] = results;
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(80));

    for (const [orgName, results] of Object.entries(allResults)) {
      console.log(`\n${orgName}:`);
      const totalRecords = Object.values(results).reduce((sum, val) => {
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      
      if (totalRecords === 0) {
        console.log('  ✅ No data found (as expected for new organizations)');
      } else {
        console.log(`  ⚠️  Found ${totalRecords} total records`);
        Object.entries(results).forEach(([key, val]) => {
          if (val > 0) {
            console.log(`     - ${key}: ${val}`);
          }
        });
      }
    }

    // Check Smart Innovations Energy specifically
    const sieOrg = organizations.find(o => o.slug === 'smart-innovations-energy');
    if (sieOrg) {
      const sieResults = allResults[sieOrg.name];
      const sieTotal = Object.values(sieResults).reduce((sum, val) => {
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      
      console.log(`\n⭐ Smart Innovations Energy:`);
      console.log(`   Total Records: ${sieTotal}`);
      if (sieTotal > 0) {
        console.log('   ✅ Has data (as expected)');
      } else {
        console.log('   ⚠️  No data found (unexpected!)');
      }
    }

    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Check if node-fetch is available
try {
  require.resolve('node-fetch');
  main();
} catch (e) {
  console.error('❌ node-fetch is required. Install it with: npm install node-fetch@2');
  console.error('   Or use the database verification script instead.');
  process.exit(1);
}
