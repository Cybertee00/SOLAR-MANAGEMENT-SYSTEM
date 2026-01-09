# Running the App on Your Phone

This guide will help you access the Solar O&M Maintenance App from your phone's browser.

## Prerequisites

- Your computer and phone must be on the **same Wi-Fi network**
- The app must be running on your computer
- You need to know your computer's local IP address

## Step 1: Find Your Computer's IP Address

### Windows:
1. Open Command Prompt (cmd)
2. Type: `ipconfig`
3. Look for **IPv4 Address** under your active network adapter (usually "Wireless LAN adapter Wi-Fi" or "Ethernet adapter")
4. Example: `192.168.1.100`

### Mac:
1. Open Terminal
2. Type: `ifconfig | grep "inet " | grep -v 127.0.0.1`
3. Look for the IP address (usually starts with 192.168.x.x or 10.x.x.x)

### Linux:
1. Open Terminal
2. Type: `hostname -I` or `ip addr show`
3. Look for your local IP address

**Write down this IP address - you'll need it!**

## Step 2: Update Configuration

### Option A: Quick Setup (Recommended)

1. Open `client/.env` (or create it)
2. Add this line (replace `YOUR_IP` with your actual IP):
   ```
   REACT_APP_API_URL=http://YOUR_IP:3001/api
   ```
   Example: `REACT_APP_API_URL=http://192.168.1.100:3001/api`

3. Update `package.json` scripts to use network access:
   - The client script is already configured to accept network connections

### Option B: Manual Start

Start the servers manually with network access:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
set HOST=0.0.0.0
set REACT_APP_API_URL=http://YOUR_IP:3001/api
npm start
```

Replace `YOUR_IP` with your computer's IP address.

## Step 3: Start the Application

From the root directory:

```bash
npm run dev
```

Or if you updated the `.env` file:

```bash
npm run server
# In another terminal:
npm run client
```

## Step 4: Access from Your Phone

1. Make sure your phone is connected to the **same Wi-Fi network** as your computer
2. Open your phone's web browser (Chrome, Safari, etc.)
3. Go to: `http://YOUR_IP:3000`
   - Example: `http://192.168.1.100:3000`
4. The app should load!

## Troubleshooting

### Can't Connect from Phone

1. **Check Firewall**: Windows Firewall might be blocking connections
   - Go to Windows Defender Firewall → Allow an app through firewall
   - Allow Node.js or add ports 3000 and 3001

2. **Verify IP Address**: Make sure you're using the correct IP
   - Run `ipconfig` again to double-check
   - Make sure it's the IP of the active network adapter

3. **Check Network**: Ensure phone and computer are on the same Wi-Fi
   - Try pinging your computer's IP from another device

4. **Port Already in Use**: If port 3000 is busy, React will suggest another port
   - Use that port number instead

### API Connection Errors

If the app loads but shows API errors:

1. Verify the backend is running on port 3001
2. Check `client/.env` has the correct IP address
3. Test the API directly: `http://YOUR_IP:3001/api/health`
4. Make sure the backend accepts connections from network (it should by default)

### Still Having Issues?

1. **Try accessing the backend directly from phone**: `http://YOUR_IP:3001/api/health`
   - Should return: `{"status":"ok","message":"Solar O&M API is running"}`

2. **Check if React dev server shows the network URL**:
   - When you start the client, it should show:
   - `On Your Network: http://192.168.x.x:3000`

3. **Use the network URL shown in the terminal** instead of localhost

## Alternative: Use ngrok (For Remote Access)

If you want to access from anywhere (not just local network):

1. Install ngrok: https://ngrok.com/
2. Start your app normally
3. In a new terminal: `ngrok http 3000`
4. Use the ngrok URL on your phone (works from any network)

## Tips

- **Bookmark the URL** on your phone for easy access
- The app works as a **Progressive Web App (PWA)** - you can add it to your home screen
- For production, you'll want to deploy to a proper server

## Security Note

This setup is for **local development only**. For production use:
- Deploy to a proper server
- Use HTTPS
- Implement proper authentication
- Configure firewall rules appropriately

