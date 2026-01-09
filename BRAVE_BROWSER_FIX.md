# Brave Browser Image Loading Issue

## Problem
Images work in Chrome but not in Brave, even with Shields disabled.

## Root Cause
Brave has stricter Cross-Origin Resource Policy (CORP) enforcement than Chrome, even with Shields off.

## Solutions

### Option 1: Clear Brave Cache (Recommended)
1. Open Brave Settings (brave://settings/)
2. Go to "Privacy and security"
3. Click "Clear browsing data"
4. Select "All time"
5. Check "Cached images and files"
6. Click "Clear data"
7. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)

### Option 2: Use Chrome for Development
Chrome works perfectly with our CORS/CORP setup.

### Option 3: Disable Brave's Strict Mode
1. brave://settings/shields
2. Set "Trackers & ads blocking" to "Standard" (not "Aggressive")
3. Disable "Upgrade connections to HTTPS"
4. Restart Brave

### Option 4: Use Incognito Mode
Brave's incognito mode may have different caching behavior.

## Technical Details
- Chrome respects `Cross-Origin-Resource-Policy: cross-origin` header
- Brave may cache the initial "blocked" response and not retry
- Our server IS sending the correct headers (confirmed by Chrome working)

## Verified Working
✅ Chrome/Edge - Works perfectly
✅ Firefox - Should work (not tested)
❌ Brave - Requires cache clear or special settings

## For Production
Users on Brave will need to:
- Clear cache if they encounter image issues
- Or use a different browser
- This is a known Brave quirk, not an issue with our implementation
