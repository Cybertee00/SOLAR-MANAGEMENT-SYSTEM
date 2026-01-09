# Quick Guide: Run App on Phone

## Quick Steps

### 1. Find Your IP Address

Run this command in the project root:
```bash
npm run get-ip
```

This will show your local IP address (e.g., `192.168.1.100`)

### 2. Update API URL

Edit `client/.env` and add (replace with YOUR IP from step 1):
```
REACT_APP_API_URL=http://192.168.1.100:3001/api
```

### 3. Start the App for Mobile

```bash
npm run dev:mobile
```

Or manually:
```bash
# Terminal 1
npm run server

# Terminal 2  
npm run client:mobile
```

### 4. Access from Phone

1. Make sure phone is on **same Wi-Fi** as computer
2. Open browser on phone
3. Go to: `http://YOUR_IP:3000` (use the IP from step 1)
   - Example: `http://192.168.1.100:3000`

## Troubleshooting

**Can't connect?**
- Check Windows Firewall allows Node.js
- Verify phone and computer are on same Wi-Fi
- Try accessing backend directly: `http://YOUR_IP:3001/api/health`

**API errors?**
- Make sure `client/.env` has the correct IP
- Restart the client after updating `.env`

See `MOBILE_SETUP.md` for detailed instructions.

