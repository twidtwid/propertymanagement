# Nest Legacy Authentication Solution

## Current Status (3:10 PM, Jan 12, 2026)

✅ **Cameras are working** - Both Entryway and Garage cameras displaying images
⏰ **Token expiration test** - Current cztoken JWT expires at 3:43 PM (33 minutes from now)
🔍 **Monitoring active** - Will check every hour to verify continued operation

## What I've Built

### 1. Automatic Refresh Module (`src/lib/cameras/nest-legacy-refresh.ts`)
- Implements Homebridge pattern: issue_token + cookies → Google access token → Nest JWT
- Auto-refreshes JWT every 55 minutes (before 1-hour expiration)
- Stores long-lived credentials (issue_token + cookies) instead of short-lived JWT
- **Result**: No manual intervention needed as long as you stay logged into Google

### 2. Setup Script (`scripts/nest-setup-refresh-auth.js`)
- One-time setup to extract issue_token + cookies from browser
- Replaces manual cztoken updates
- **Usage**: `npm run nest:setup-refresh <issue_token_url> <cookies>`

### 3. Monitoring Script (`scripts/nest-monitor-hourly.sh`)
- Checks if cameras are working by scanning logs
- Detects 403 errors (token expired)
- Logs results to `/tmp/nest-camera-monitor.log`
- **Usage**: `npm run nest:monitor`

## The Experiment

### Current Approach (cztoken)
- **What we're using**: Direct session cookie from home.nest.com
- **Lifespan**: JWT inside expires in 1 hour, cookie expires in 30 days
- **Question**: Does the JWT auto-refresh within the cookie lifetime?

### If cztoken Expires at 3:43 PM
**Action Plan**:
1. Switch to issue_token + cookies approach
2. Extract credentials from browser (5-minute setup)
3. Deploy automatic refresh solution
4. Cameras work indefinitely (no manual refresh)

### If cztoken Continues Working
**Action Plan**:
1. Continue monitoring hourly
2. Keep issue_token solution ready as backup
3. Document actual token lifespan empirically

## Monitoring Schedule (Today)

- **3:45 PM**: Check if cameras still work (first critical test)
- **4:45 PM**: Hourly check #2
- **5:45 PM**: Hourly check #3
- **6:45 PM**: Hourly check #4
- Continue every hour...

## How to Check If Cameras Are Working

### Method 1: Browser
Open http://localhost:3000/cameras and verify Vermont cameras show images

### Method 2: Command Line
```bash
npm run nest:monitor
```

### Method 3: Logs
```bash
docker compose logs app --tail 50 | grep nest_legacy
# Look for "✓ Fetched snapshot" (working) or "403" (expired)
```

## If Token Expires - Quick Fix

1. **Get issue_token + cookies from browser**:
   ```
   1. Open https://home.nest.com in Chrome
   2. Open DevTools (F12) → Network tab
   3. Filter for "issueToken"
   4. Look for "iframerpc" request
   5. Copy full Request URL (issue_token)
   6. Copy Cookie header (cookies)
   ```

2. **Run setup**:
   ```bash
   npm run nest:setup-refresh "<issue_token>" "<cookies>"
   ```

3. **Update snapshot endpoint** to use refresh module:
   ```typescript
   // In src/app/api/cameras/[cameraId]/snapshot/route.ts
   import { getValidNestJWT } from '@/lib/cameras/nest-legacy-refresh'

   // Replace:
   const cztoken = await getValidNestLegacyToken()
   // With:
   const cztoken = await getValidNestJWT()
   ```

4. **Add automatic refresh to worker**:
   ```typescript
   // In scripts/unified-worker.js
   import { startAutomaticRefresh } from '../src/lib/cameras/nest-legacy-refresh'

   // At startup:
   startAutomaticRefresh()
   ```

## Key Differences: Ring vs Nest

### Ring (Working on toddhome.local)
- **What it stores**: refreshToken (long-lived OAuth refresh token)
- **How it works**: Refresh token → new access token automatically
- **Lifespan**: Indefinite (doesn't expire)

### Nest Legacy (Current cztoken approach)
- **What it stores**: cztoken (session cookie with embedded JWT)
- **How it works**: Direct API calls with cookie
- **Lifespan**: Unknown - testing now

### Nest Legacy (issue_token approach)
- **What it stores**: issue_token + cookies (Google session credentials)
- **How it works**: issue_token + cookies → Google token → Nest JWT (every 55 min)
- **Lifespan**: As long as Google session persists

## Why Homebridge/HA "Never Expire"

They DON'T store the actual token - they store the CREDENTIALS to get a token:

```
Homebridge Ring:
  refreshToken (stored) → access token (generated on demand)

Homebridge Nest:
  issue_token + cookies (stored) → Google token → Nest JWT (generated every 55 min)

Our cztoken approach (current):
  cztoken (stored) → API calls (expires after ?? time)
```

## Success Criteria

✅ **Immediate**: Cameras working now (DONE)
⏳ **Short-term**: Cameras still work at 3:45 PM (IN PROGRESS)
⏳ **Medium-term**: Cameras work for 24+ hours without intervention (TESTING)
⏳ **Long-term**: Automatic refresh deployed, no manual updates needed (READY TO DEPLOY)

## Next Steps

1. ⏰ **3:45 PM**: Check if cameras still work → If yes, continue monitoring → If no, deploy issue_token solution
2. 📊 **Hourly monitoring**: Run `npm run nest:monitor` every hour
3. 📝 **Document findings**: Record actual token lifespan
4. 🚀 **Deploy solution**: Switch to automatic refresh if/when cztoken expires

## Files Created/Modified

### New Files
- `src/lib/cameras/nest-legacy-refresh.ts` - Automatic refresh module
- `scripts/nest-setup-refresh-auth.js` - One-time setup script
- `scripts/nest-monitor-hourly.sh` - Hourly monitoring script
- `src/app/api/cameras/health/route.ts` - Health check endpoint
- `NEST_LEGACY_SOLUTION.md` - This document

### Modified Files
- `package.json` - Added `nest:setup-refresh` and `nest:monitor` scripts
- `scripts/update-nest-token-manual.js` - Fixed UPSERT constraint issue

## References

- [Homebridge-Nest Source](https://github.com/chrisjshull/homebridge-nest)
- [Home Assistant Nest Protect](https://github.com/iMicknl/ha-nest-protect)
- [Nest API Blog Post](https://den.dev/blog/nest/)
- Ring Config on toddhome.local: `/Users/spy/.homebridge/config.json`

---

**Last Updated**: Jan 12, 2026 3:10 PM
**Status**: Monitoring in progress, automatic refresh solution ready to deploy
