// Helper script to get your local IP address
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

const ip = getLocalIP();
console.log('\n========================================');
console.log('Your Local IP Address:', ip);
console.log('========================================');
console.log('\nTo access from your phone:');
console.log(`  Frontend: http://${ip}:3000`);
console.log(`  Backend:  http://${ip}:3001/api`);
console.log('\nMake sure to update client/.env with:');
console.log(`  REACT_APP_API_URL=http://${ip}:3001/api`);
console.log('========================================\n');

module.exports = { ip };

