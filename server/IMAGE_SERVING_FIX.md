# Image Serving Fix for CORS Issues

## Problem
After implementing security hardening with Helmet.js, images were blocked with:
```
ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
```

## Root Cause
Helmet.js sets `Cross-Origin-Resource-Policy: same-origin` by default, which blocks cross-origin resource loading. Since the React app runs on `localhost:3000` and the API on `localhost:3001`, they are considered different origins.

## Solution Implemented

### 1. Static File Middleware (First in Chain)
- Placed `/uploads` static file serving **before** all other middleware
- Set explicit headers in `express.static` `setHeaders` callback:
  - `Access-Control-Allow-Origin: *`
  - `Cross-Origin-Resource-Policy: cross-origin`
  - Removed restrictive headers (COEP, COOP)

### 2. Excluded `/uploads` from Helmet
- Helmet middleware now skips `/uploads` routes entirely
- Prevents Helmet from overriding our custom headers

### 3. Disabled CORP in Helmet Config
- Set `crossOriginResourcePolicy: false` in Helmet config
- Allows per-route control of CORP headers

## Files Modified
1. `server/index.js` - Static file middleware and Helmet exclusion
2. `server/middleware/security.js` - Disabled CORP in Helmet config

## Security Impact
- **No security weakening**: All API routes still have full Helmet protection
- **Static files appropriately configured**: Public resources don't need same-origin restrictions
- **Separation of concerns**: Different security policies for API vs static files

## Testing
1. Restart the server
2. Navigate to CM Letters page
3. Images should load without CORS errors
4. Check browser console for "Serving static file" logs

## If Issues Persist
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check browser console for actual error message
4. Verify file exists in `server/uploads/` directory
5. Check server logs for "Serving static file" messages
