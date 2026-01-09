# Running App via USB Cable (Android)

This guide shows you how to run the app on your Android phone connected via USB cable.

## Prerequisites

1. **Android phone** connected via USB
2. **USB Debugging enabled** on your phone
3. **ADB (Android Debug Bridge)** installed on your PC

## Step 1: Enable USB Debugging on Your Phone

1. Go to **Settings** > **About Phone**
2. Tap **Build Number** 7 times to enable Developer Options
3. Go back to **Settings** > **Developer Options**
4. Enable **USB Debugging**
5. Connect your phone via USB
6. Accept the USB debugging prompt on your phone

## Step 2: Install ADB (If Not Already Installed)

### Option A: Android Studio (Recommended)
- Install Android Studio
- ADB is included in: `Android\Sdk\platform-tools\`
- Add it to your PATH

### Option B: Standalone Platform Tools
1. Download from: https://developer.android.com/studio/releases/platform-tools
2. Extract to a folder (e.g., `C:\platform-tools`)
3. Add to PATH:
   - Windows: System Properties > Environment Variables > Add to PATH

### Verify ADB Installation
```bash
adb version
```

## Step 3: Update Configuration for USB

Since we're using USB, we can use `localhost` instead of your IP address.

Update `client/.env`:
```
REACT_APP_API_URL=http://localhost:3001/api
```

## Step 4: Run the App with USB

### Automatic Setup (Recommended)

```bash
npm run dev:usb
```

This will:
1. Check if your phone is connected
2. Set up port forwarding automatically
3. Start both server and client

### Manual Setup

1. **Setup USB port forwarding:**
   ```bash
   npm run setup-usb
   ```

2. **Start the app normally:**
   ```bash
   npm run dev
   ```

3. **Access from your phone:**
   - Open browser on phone
   - Go to: `http://localhost:3000`

## How It Works

ADB port forwarding creates a tunnel:
- Phone's `localhost:3000` → PC's `localhost:3000`
- Phone's `localhost:3001` → PC's `localhost:3001`

So your phone can access the servers running on your PC as if they were running locally on the phone.

## Troubleshooting

### "ADB not found"
- Install Android SDK Platform Tools
- Add ADB to your PATH
- Restart terminal after adding to PATH

### "No Android device detected"
1. Check USB cable connection
2. Verify USB Debugging is enabled
3. Accept the USB debugging prompt on phone
4. Try: `adb devices` to see if device appears
5. Try different USB cable or USB port

### "Device unauthorized"
- Check your phone for USB debugging authorization prompt
- Click "Allow" or "Always allow from this computer"

### App doesn't load on phone
1. Verify port forwarding is active: `adb reverse --list`
2. Check if servers are running on PC
3. Try accessing `http://localhost:3001/api/health` from phone browser
4. Restart port forwarding: `npm run setup-usb`

### Port forwarding lost after disconnect
- Reconnect USB cable
- Run `npm run setup-usb` again

## Remove Port Forwarding

When you're done, you can remove the port forwarding:

```bash
npm run remove-usb
```

Or manually:
```bash
adb reverse --remove tcp:3000
adb reverse --remove tcp:3001
```

## Advantages of USB Connection

✅ **More stable** than Wi-Fi  
✅ **Works offline** (no network required)  
✅ **Faster** connection  
✅ **More secure** (no network exposure)  
✅ **Uses localhost** (simpler configuration)

## For iOS Devices

iOS doesn't support ADB. For iOS, you have two options:

1. **Use Wi-Fi method** (see `MOBILE_SETUP.md`)
2. **Use iOS Simulator** on Mac
3. **Use a tool like ngrok** for tunneling

## Notes

- Port forwarding persists until you disconnect the USB cable or restart ADB
- You need to run `npm run setup-usb` each time you reconnect
- The app will work exactly the same as Wi-Fi method, just using USB instead

