/**
 * Verify File Routes Script
 * Actually tests that files can be accessed via the new company-scoped routes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function testFileAccess(filePath, expectedUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(expectedUrl, BASE_URL);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          // Check if file exists on disk
          const exists = fs.existsSync(filePath);
          resolve({
            success: true,
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
            contentLength: res.headers['content-length'],
            fileExists: exists,
            url: expectedUrl
          });
        } else {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: `HTTP ${res.statusCode}`,
            url: expectedUrl
          });
        }
      });
    }).on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        url: expectedUrl
      });
    });
  });
}

async function verifyFileRoutes() {
  console.log('🔍 Verifying file routes...\n');
  console.log(`📡 Testing against: ${BASE_URL}\n`);
  
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };

  const serverDir = path.join(__dirname, '..');
  const uploadsDir = path.join(serverDir, 'uploads', 'companies');
  
  // Test files that should exist
  const testFiles = [
    {
      company: 'smart-innovations-energy',
      fileType: 'logos',
      filename: 'logo.png',
      description: 'Company logo'
    },
    {
      company: 'smart-innovations-energy',
      fileType: 'templates',
      filename: 'Year Calendar.xlsx',
      description: 'Template file'
    },
    {
      company: 'smart-innovations-energy',
      fileType: 'plant',
      filename: 'map-structure.json',
      description: 'Plant map structure'
    }
  ];

  for (const test of testFiles) {
    const filePath = path.join(uploadsDir, test.company, test.fileType, test.filename);
    const expectedUrl = `/uploads/companies/${test.company}/${test.fileType}/${test.filename}`;
    
    const fileExists = fs.existsSync(filePath);
    
    if (!fileExists) {
      console.log(`⏭️  Skipping: ${test.description} (file not found)`);
      results.skipped.push({ ...test, reason: 'File not found' });
      continue;
    }

    console.log(`🧪 Testing: ${test.description}`);
    console.log(`   File: ${filePath}`);
    console.log(`   URL: ${expectedUrl}`);
    
    const result = await testFileAccess(filePath, expectedUrl);
    
    if (result.success) {
      console.log(`   ✅ SUCCESS - Status: ${result.statusCode}, Content-Type: ${result.contentType}`);
      results.passed.push({ ...test, result });
    } else {
      console.log(`   ❌ FAILED - ${result.error || `Status: ${result.statusCode}`}`);
      results.failed.push({ ...test, result });
    }
    console.log('');
  }

  // Summary
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${results.passed.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`   - ${test.description}: ${test.result.error || test.result.statusCode}`);
    });
  }
  
  if (results.passed.length > 0) {
    console.log('\n✅ All accessible files are working correctly!');
    console.log('   The route `/uploads/companies/:slug/:fileType/:filename` is functioning properly.');
  }

  return results;
}

async function main() {
  try {
    console.log('⚠️  Note: This test requires the server to be running on port', PORT);
    console.log('   If the server is not running, tests will fail with connection errors.\n');
    
    const results = await verifyFileRoutes();
    
    // Write results
    const resultsPath = path.join(__dirname, 'file-routes-verification-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Results saved to: ${resultsPath}`);
    
    process.exit(results.failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();
