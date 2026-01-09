const fs = require('fs');
const path = require('path');

// Get IP from command line argument or use default
const newIP = process.argv[2] || '192.168.0.134';

const clientEnvPath = path.join(__dirname, '../client/.env');
const envContent = `REACT_APP_API_URL=http://${newIP}:3001/api\n`;

try {
  fs.writeFileSync(clientEnvPath, envContent, 'utf8');
  console.log('✅ Updated client/.env with new IP address:');
  console.log(`   REACT_APP_API_URL=http://${newIP}:3001/api`);
  console.log('\n⚠️  You need to restart the React development server for changes to take effect.');
  console.log('   Stop the client (Ctrl+C) and run: npm run client');
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
  console.log('\nPlease manually update client/.env with:');
  console.log(`REACT_APP_API_URL=http://${newIP}:3001/api`);
  process.exit(1);
}

