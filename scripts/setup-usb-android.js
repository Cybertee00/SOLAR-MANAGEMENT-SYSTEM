// Script to setup USB connection for Android devices
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function setupUSBAndroid() {
  console.log('Setting up USB connection for Android...\n');

  try {
    // Check if ADB is available
    try {
      await execPromise('adb version');
      console.log('✓ ADB found\n');
    } catch (error) {
      console.error('✗ ADB not found!');
      console.error('Please install Android SDK Platform Tools:');
      console.error('https://developer.android.com/studio/releases/platform-tools');
      console.error('\nOr if you have Android Studio installed, add it to your PATH.');
      process.exit(1);
    }

    // Check if device is connected
    const { stdout: devicesOutput } = await execPromise('adb devices');
    const devices = devicesOutput.split('\n')
      .filter(line => line.trim() && !line.includes('List of devices'))
      .map(line => line.split('\t')[0])
      .filter(id => id);

    if (devices.length === 0) {
      console.error('✗ No Android device detected!');
      console.error('\nPlease:');
      console.error('1. Connect your phone via USB');
      console.error('2. Enable USB Debugging on your phone');
      console.error('   (Settings > Developer Options > USB Debugging)');
      console.error('3. Accept the USB debugging prompt on your phone');
      process.exit(1);
    }

    console.log(`✓ Found ${devices.length} device(s):`);
    devices.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device}`);
    });
    console.log('');

    // Forward ports
    console.log('Setting up port forwarding...');
    
    // Forward port 3000 (React dev server)
    try {
      await execPromise('adb reverse tcp:3000 tcp:3000');
      console.log('✓ Port 3000 forwarded (Frontend)');
    } catch (error) {
      console.error('✗ Failed to forward port 3000');
    }

    // Forward port 3001 (Backend API)
    try {
      await execPromise('adb reverse tcp:3001 tcp:3001');
      console.log('✓ Port 3001 forwarded (Backend API)');
    } catch (error) {
      console.error('✗ Failed to forward port 3001');
    }

    console.log('\n========================================');
    console.log('USB Setup Complete!');
    console.log('========================================');
    console.log('\nYour phone can now access:');
    console.log('  Frontend: http://localhost:3000');
    console.log('  Backend:  http://localhost:3001/api');
    console.log('\nNote: Make sure to use localhost in your .env file');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error setting up USB connection:', error.message);
    process.exit(1);
  }
}

setupUSBAndroid();

