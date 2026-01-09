// Script to remove USB port forwarding
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function removeUSBForwarding() {
  console.log('Removing USB port forwarding...\n');

  try {
    // Remove port forwarding
    try {
      await execPromise('adb reverse --remove tcp:3000');
      console.log('✓ Removed port 3000 forwarding');
    } catch (error) {
      // Ignore if not set
    }

    try {
      await execPromise('adb reverse --remove tcp:3001');
      console.log('✓ Removed port 3001 forwarding');
    } catch (error) {
      // Ignore if not set
    }

    console.log('\nPort forwarding removed.\n');
  } catch (error) {
    console.error('Error removing port forwarding:', error.message);
  }
}

removeUSBForwarding();

