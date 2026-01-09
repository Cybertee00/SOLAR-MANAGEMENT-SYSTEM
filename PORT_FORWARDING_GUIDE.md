# Port Forwarding Guide - Cursor IDE

This guide helps you expose your local development server to the internet using Cursor IDE's built-in port forwarding feature.

## Prerequisites

1. **Cursor IDE** installed and running
2. **Frontend** running on `localhost:3000`
3. **Backend** running on `localhost:3001`
4. **Active internet connection**

## Quick Setup Steps

### Step 1: Start Your Servers

Make sure both servers are running:

**Terminal 1 - Backend:**
```bash
cd server
npm start
```
Backend should be running on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```
Frontend should be running on `http://localhost:3000`

### Step 2: Forward Ports in Cursor

1. **Open Port Forwarding Panel:**
   - Click on the **"Ports"** tab in the bottom panel of Cursor (or use `Ctrl+Shift+P` / `Cmd+Shift+P` and search for "Ports")
   - If the Ports panel is not visible, go to **View** → **Ports** or press `Ctrl+Shift+` ` (backtick)

2. **Add Port 3000 (Frontend):**
   - Click **"Add Port"** or **"+"** button
   - Enter port number: `3000`
   - Set visibility to **"Public"** (this makes it accessible from the internet)
   - Copy the public URL (e.g., `https://xxxx-3000.xxxx.devtunnels.ms`)

3. **Add Port 3001 (Backend):**
   - Click **"Add Port"** again
   - Enter port number: `3001`
   - Set visibility to **"Public"**
   - Copy the public URL (e.g., `https://yyyy-3001.xxxx.devtunnels.ms`)

### Step 3: Configure Frontend to Use Public Backend URL

The frontend needs to know the public backend URL. You have two options:

**Option A: Use Query Parameter (Quick)**
- Append the backend URL to the frontend URL as a query parameter:
  ```
  https://xxxx-3000.xxxx.devtunnels.ms/?apiUrl=https://yyyy-3001.xxxx.devtunnels.ms/api
  ```

**Option B: Use Setup Page (Recommended)**
- Navigate to: `https://xxxx-3000.xxxx.devtunnels.ms/setup-backend.html`
- Enter the backend URL: `https://yyyy-3001.xxxx.devtunnels.ms/api`
- Click "Save Configuration"

### Step 4: Share the Frontend URL

Share the **frontend public URL** with others:
```
https://xxxx-3000.xxxx.devtunnels.ms
```

**Important:** They will need to configure the backend URL as well using Option A or B above.

## Environment Variables (Optional)

If you want to persist the backend URL configuration, you can set it in the backend `.env` file:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# CORS - Allow the public frontend URL
CORS_ORIGIN=https://xxxx-3000.xxxx.devtunnels.ms

# For Dev Tunnels/Cursor port forwarding
DEV_TUNNELS=true
TRUST_PROXY=true
HTTPS_ENABLED=true

# Session Configuration for HTTPS
SESSION_SECURE=true
SESSION_SAME_SITE=none
```

**Note:** Only set `DEV_TUNNELS=true` when using port forwarding. Remove it when working on localhost.

## Troubleshooting

### Issue: Cannot Access from Internet

**Solution:**
- Ensure ports are set to **"Public"** visibility, not "Private"
- Check that both servers are running
- Verify firewall isn't blocking connections

### Issue: CORS Errors

**Solution:**
- Update `CORS_ORIGIN` in `server/.env` to include your public frontend URL
- Restart the backend server
- Ensure the backend URL in frontend matches exactly

### Issue: Authentication Not Working

**Solution:**
- Check session cookie settings in `server/index.js`
- Ensure `secure`, `sameSite`, and `httpOnly` are correctly configured for HTTPS
- Clear browser cookies and try again

### Issue: Port Forwarding Not Available in Cursor

**Solution:**
- Make sure you're using the latest version of Cursor IDE
- Check if you're connected to the internet
- Try restarting Cursor IDE
- Verify ports are not already in use by other applications

## Security Notes

⚠️ **Warning:** Public port forwarding exposes your development server to the internet.

1. **Development Only:** Only use this for development/testing, not production
2. **Temporary Access:** Port forwarding URLs may change when you restart Cursor
3. **No Sensitive Data:** Don't use real production data when sharing publicly
4. **Firewall:** Consider using firewall rules to limit access if needed

## Alternative: Using Command Line

If Cursor's port forwarding doesn't work, you can use command-line tools:

### Using `npx localtunnel`
```bash
# Terminal 1 - Backend
npx localtunnel --port 3001

# Terminal 2 - Frontend  
npx localtunnel --port 3000
```

### Using `npx serveo.net` (SSH-based, no password)
```bash
# Terminal 1 - Backend
ssh -R 80:localhost:3001 serveo.net

# Terminal 2 - Frontend
ssh -R 80:localhost:3000 serveo.net
```

## Next Steps

1. Test the public URLs in a different network/device
2. Share the frontend URL with your team/client
3. Monitor server logs for any errors
4. Document the URLs for easy access

## Support

If you encounter issues:
1. Check server console logs
2. Verify both ports are forwarded correctly
3. Test backend URL directly in browser: `https://backend-url/api/test-cors`
4. Check browser console for errors
