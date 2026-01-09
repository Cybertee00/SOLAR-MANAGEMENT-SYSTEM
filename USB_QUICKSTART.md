# Quick Start: USB Connection

## For Android Phones

### 1. Enable USB Debugging
- Settings > Developer Options > USB Debugging (ON)
- Connect phone via USB
- Accept USB debugging prompt on phone

### 2. Install ADB (if needed)
- Download: https://developer.android.com/studio/releases/platform-tools
- Or install Android Studio (includes ADB)

### 3. Update .env for USB
The `.env` file should use `localhost`:
```
REACT_APP_API_URL=http://localhost:3001/api
```

### 4. Run with USB
```bash
npm run dev:usb
```

This automatically:
- Checks your phone connection
- Sets up port forwarding
- Starts the app

### 5. Access on Phone
- Open browser on phone
- Go to: `http://localhost:3000`

## Troubleshooting

**No device found?**
- Check USB cable connection
- Verify USB Debugging is enabled
- Run: `adb devices` to check connection

**ADB not found?**
- Install Android SDK Platform Tools
- Add to PATH

See `USB_SETUP.md` for detailed instructions.

