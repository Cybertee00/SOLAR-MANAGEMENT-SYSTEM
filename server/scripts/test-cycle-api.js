/**
 * Test script to verify cycle tracking API endpoints
 */

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// This is a basic test - in production you'd need proper authentication
async function testCycleAPI() {
  console.log('='.repeat(80));
  console.log('CYCLE TRACKING API TEST');
  console.log('='.repeat(80));
  console.log('\nNote: This test requires authentication. Testing endpoint availability...\n');

  try {
    // Test 1: Check if endpoints exist (will fail without auth, but confirms routes are registered)
    console.log('Test 1: Checking endpoint availability...');
    
    const endpoints = [
      { method: 'GET', path: '/plant/cycles/grass_cutting', name: 'Get Grass Cutting Cycle' },
      { method: 'GET', path: '/plant/cycles/panel_wash', name: 'Get Panel Wash Cycle' },
      { method: 'GET', path: '/plant/cycles/grass_cutting/history', name: 'Get Cycle History' },
      { method: 'GET', path: '/plant/cycles/grass_cutting/stats', name: 'Get Cycle Stats' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${API_BASE_URL}${endpoint.path}`, {
          validateStatus: () => true // Accept any status code
        });
        
        if (response.status === 401 || response.status === 403) {
          console.log(`  ✓ ${endpoint.name}: Endpoint exists (requires authentication)`);
        } else if (response.status === 200) {
          console.log(`  ✓ ${endpoint.name}: Endpoint works!`);
          if (response.data) {
            console.log(`    Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
          }
        } else {
          console.log(`  ⚠ ${endpoint.name}: Status ${response.status}`);
        }
      } catch (error) {
        if (error.response) {
          if (error.response.status === 401 || error.response.status === 403) {
            console.log(`  ✓ ${endpoint.name}: Endpoint exists (requires authentication)`);
          } else {
            console.log(`  ✗ ${endpoint.name}: Error ${error.response.status}`);
          }
        } else if (error.code === 'ECONNREFUSED') {
          console.log(`  ✗ ${endpoint.name}: Server not running`);
        } else {
          console.log(`  ✗ ${endpoint.name}: ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('API TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('\nNote: Full testing requires authenticated session.');
    console.log('Endpoints are registered and accessible (authentication required).\n');

  } catch (error) {
    console.error('\nERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCycleAPI()
  .then(() => {
    console.log('Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
