/**
 * License Key Generation Script
 * For BRIGHTSTEP TECHNOLOGIES Pty Ltd use only
 * 
 * This script generates license keys for SPHAiRPlatform
 * Usage: node scripts/generate-license.js "Company Name"
 */

const crypto = require('crypto');

function generateLicenseKey(companyName) {
  if (!companyName) {
    console.error('Error: Company name is required');
    console.log('Usage: node scripts/generate-license.js "Company Name"');
    process.exit(1);
  }

  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const companyHash = crypto.createHash('md5').update(companyName).digest('hex').substring(0, 8);
  const combined = `${timestamp}-${random}-${companyHash}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  
  // Format as SPHAIR-XXXX-XXXX-XXXX-XXXX
  const segments = [
    hash.substring(0, 4),
    hash.substring(4, 8),
    hash.substring(8, 12),
    hash.substring(12, 16)
  ].map(s => s.toUpperCase());
  
  return `SPHAIR-${segments.join('-')}`;
}

// Get company name from command line arguments
const companyName = process.argv[2];

if (!companyName) {
  console.error('Error: Company name is required');
  console.log('\nUsage: node scripts/generate-license.js "Company Name"');
  console.log('\nExample:');
  console.log('  node scripts/generate-license.js "SIE Management System"');
  process.exit(1);
}

const licenseKey = generateLicenseKey(companyName);
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 90); // 3 months from now

console.log('\n========================================');
console.log('SPHAiRPlatform License Key Generator');
console.log('BRIGHTSTEP TECHNOLOGIES Pty Ltd');
console.log('========================================\n');
console.log('Company Name:', companyName);
console.log('License Key:', licenseKey);
console.log('Expires:', expiresAt.toISOString().split('T')[0]);
console.log('Duration: 90 days (3 months)');
console.log('\n========================================\n');
console.log('IMPORTANT:');
console.log('1. Save this license key securely');
console.log('2. Provide it to the customer for activation');
console.log('3. Keep a record of the company name and license key');
console.log('4. The license will expire 90 days from activation');
console.log('\n========================================\n');
