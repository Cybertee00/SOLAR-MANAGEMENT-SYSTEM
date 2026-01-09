# Fix: Templates Not Showing on Phone

## Problem
Templates show on PC but not on phone - "Network Error"

## Solution

The API URL needs to match your connection type:

### For Wi-Fi Connection:
1. Update `client/.env` with your PC's IP address:
   ```
   REACT_APP_API_URL=http://192.168.1.141:3001/api
   ```
   (Replace 192.168.1.141 with your actual PC IP)

2. Restart the React app:
   ```bash
   # Stop the current app (Ctrl+C)
   npm run client:mobile
   ```

### For USB Connection:
1. Make sure ADB port forwarding is set up:
   ```bash
   npm run setup-usb
   ```

2. Use `localhost` in `client/.env`:
   ```
   REACT_APP_API_URL=http://localhost:3001/api
   ```

3. Restart the React app

## Automatic Detection (New Feature)

The app now automatically detects the API URL based on how you access it:
- If you access via `http://192.168.1.141:3000` → API uses `http://192.168.1.141:3001/api`
- If you access via `http://localhost:3000` → API uses `http://localhost:3001/api`

**However**, you still need to:
- For Wi-Fi: Access the app using your PC's IP address (not localhost)
- For USB: Set up ADB port forwarding first

## Verify It Works

1. Open browser console on phone (if possible, or use remote debugging)
2. Check the console log: `API Base URL: http://...`
3. It should match your connection type

## Troubleshooting

**Still getting Network Error?**

1. **Check backend is running:**
   ```bash
   # Should see: "Server running on port 3001"
   ```

2. **Test API from phone browser:**
   - Open: `http://192.168.1.141:3001/api/checklist-templates`
   - Should see JSON data

3. **Check CORS:**
   - Backend should allow all origins (already configured)

4. **Check firewall:**
   - Windows Firewall might be blocking port 3001
   - Allow Node.js through firewall

5. **Verify same network:**
   - Phone and PC must be on same Wi-Fi network

