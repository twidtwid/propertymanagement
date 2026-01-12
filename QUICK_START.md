# Quick Start - When You Get Home

## First Thing: Check Cameras

Visit: **http://localhost:3000/cameras**

Look at the Vermont cameras (Entryway, Garage):
- ✅ **If showing images** → Token is still working! Continue monitoring.
- ❌ **If broken/403 errors** → Token expired. Follow "Deploy Fix" below.

---

## If Cameras Are Working ✅

**Excellent!** This means either:
1. The JWT auto-refreshed within the cookie lifetime, OR
2. We haven't hit the expiration yet

**What to do**:
1. Keep monitoring: `npm run nest:monitor` every hour
2. Check again tomorrow
3. If still working after 24 hours, the cztoken approach is viable long-term

---

## If Cameras Are Broken ❌

**Don't worry** - 5-minute fix ready to go.

### Step 1: Get Credentials (2 minutes)

1. Open https://home.nest.com in Chrome
2. Make sure you're logged in
3. Open DevTools (F12 or Cmd+Option+I)
4. Click **Network** tab
5. Filter for: `issueToken`
6. Refresh the page or click around
7. Look for a request named `iframerpc`
8. Click on it
9. Copy the **full Request URL** (starts with https://accounts.google.com...)
10. In the same request, find **Headers** → **Cookie**
11. Copy the **entire cookie string**

### Step 2: Run Setup (1 minute)

```bash
npm run nest:setup-refresh \
  "YOUR_ISSUE_TOKEN_URL_HERE" \
  "YOUR_COOKIE_STRING_HERE"
```

### Step 3: Update Code (2 minutes)

**File 1**: `src/app/api/cameras/[cameraId]/snapshot/route.ts`

Line 4, add:
```typescript
import { getValidNestJWT } from '@/lib/cameras/nest-legacy-refresh'
```

Line 156, replace:
```typescript
// OLD:
const cztoken = await getValidNestLegacyToken()

// NEW:
const cztoken = await getValidNestJWT()
```

**File 2**: `scripts/unified-worker.js`

Top of file, add with other imports:
```javascript
const { startAutomaticRefresh } = require('./src/lib/cameras/nest-legacy-refresh');
```

In `main()` function (around line 50), add:
```javascript
console.log('[Nest] Starting automatic JWT refresh...');
startAutomaticRefresh();
```

### Step 4: Restart (30 seconds)

```bash
docker compose restart app worker
```

### Step 5: Verify (30 seconds)

```bash
# Check cameras page
open http://localhost:3000/cameras

# Check logs
docker compose logs app | grep "JWT refreshed"
# Should see: "✓ JWT refreshed successfully"
```

---

## Done!

Cameras will now:
- ✅ Auto-refresh JWT every 55 minutes
- ✅ Work indefinitely (as long as you stay logged into Google)
- ✅ Never need manual token updates
- ✅ Work exactly like your Ring doorbell integration

---

## Monitoring Commands

Check status anytime:
```bash
npm run nest:monitor
```

Auto-check every hour:
```bash
bash scripts/nest-auto-monitor.sh
```

View logs:
```bash
docker compose logs app --tail 50 | grep nest_legacy
```

---

## Questions?

See `STATUS_REPORT.md` for complete details
See `NEST_LEGACY_SOLUTION.md` for technical explanation
