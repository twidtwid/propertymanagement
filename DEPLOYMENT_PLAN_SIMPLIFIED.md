# Simplified Deployment Plan for Nest Legacy Auto-Refresh

**Use this if cameras fail at 3:45 PM test**

## Why Simplified?

The automatic refresh module (`nest-legacy-refresh.ts`) has **on-demand refresh** built into `getValidNestJWT()`. It automatically refreshes the JWT when it's expired or about to expire (5-minute buffer). Since the worker calls camera sync every 5 minutes, the JWT will stay fresh without needing background refresh.

## Deployment Steps (5 minutes)

### Step 1: Get Credentials (2 minutes)

1. Open https://home.nest.com in Chrome
2. Open DevTools (Cmd+Option+I)
3. Go to **Network** tab
4. Filter for: `issueToken`
5. Refresh the page
6. Find request named **iframerpc**
7. Copy the **full Request URL** (starts with https://accounts.google.com...)
8. In same request → **Headers** section → Copy the **Cookie** value (entire string)

### Step 2: Run Setup Script (1 minute)

```bash
npm run nest:setup-refresh \
  "YOUR_ISSUE_TOKEN_URL_HERE" \
  "YOUR_COOKIE_STRING_HERE"
```

This will:
- Test the credentials
- Encrypt and store them in database
- Verify they work

### Step 3: Update Snapshot Route (1 minute)

**File**: `src/app/api/cameras/[cameraId]/snapshot/route.ts`

**Line 4** - Add import:
```typescript
import { getValidNestJWT } from '@/lib/cameras/nest-legacy-refresh'
```

**Line 156** - Replace function call:
```typescript
// OLD:
const cztoken = await getValidNestLegacyToken()

// NEW:
const cztoken = await getValidNestJWT()
```

That's it! No worker changes needed.

### Step 4: Build & Verify (1 minute)

```bash
# Check for TypeScript errors
docker compose exec app npm run build

# If build succeeds, restart app
docker compose restart app

# Wait 10 seconds
sleep 10
```

### Step 5: Test (30 seconds)

```bash
# Check cameras page
open http://localhost:3000/cameras

# Check logs for JWT refresh
docker compose logs app --tail 20 | grep nest_legacy
```

Should see:
- `[nest_legacy] Refreshing JWT...` (first time)
- `✓ Fetched snapshot for Entryway`
- `✓ Fetched snapshot for Garage`

## How It Works

**On-Demand Refresh:**
1. Snapshot endpoint calls `getValidNestJWT()`
2. Function checks if cached JWT is still valid (5-min buffer)
3. If expired → Fetches new JWT from Google/Nest APIs automatically
4. Returns fresh JWT

**Automatic Triggers:**
- Worker calls camera sync every 5 minutes
- Camera sync fetches snapshots
- Snapshot fetch triggers JWT validation/refresh
- Result: JWT stays fresh automatically

**No Manual Intervention:**
- Works as long as Google session persists (~months)
- No 30-day token refresh needed
- No background worker changes required

## Troubleshooting

### Build fails with TypeScript error

```bash
# Check the error message
docker compose exec app npm run build

# Most likely: Wrong import path
# Make sure: '@/lib/cameras/nest-legacy-refresh' not '../nest-legacy-refresh'
```

### Cameras still showing 403 errors

```bash
# Check if credentials were stored
npm run nest:setup-refresh \
  "ISSUE_TOKEN_URL" \
  "COOKIES"

# Verify database update
docker compose exec db psql -U propman -d propertymanagement \
  -c "SELECT provider, updated_at FROM camera_credentials WHERE provider = 'nest_legacy';"
```

### "No refresh credentials found" error

The setup script didn't complete. Re-run:
```bash
npm run nest:setup-refresh "ISSUE_TOKEN" "COOKIES"
```

## Production Deployment

**If fix works in dev, deploy to production:**

```bash
# Commit changes
git add -A
git commit -m "Implement automatic Nest Legacy JWT refresh

- Add nest-legacy-refresh module with on-demand refresh
- Update snapshot route to use getValidNestJWT()
- Credentials stored: issue_token + cookies (long-lived)
- JWT refreshes automatically when expired (no manual intervention)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Deploy
/deploy
```

**After production deploy, add credentials via SSH:**

```bash
ssh root@143.110.229.185

# On production server:
cd /root/app
npm run nest:setup-refresh \
  "PRODUCTION_ISSUE_TOKEN" \
  "PRODUCTION_COOKIES"

# Restart app to pick up changes
docker compose -f docker-compose.prod.yml restart app

# Verify
curl -s https://spmsystem.com/cameras
```

## Optional: Proactive Background Refresh

If you want JWT to refresh every 55 minutes (instead of on-demand), you can add it later by:

1. Converting `nest-legacy-refresh.ts` to `.js`
2. Adding `startAutomaticRefresh()` to worker startup
3. Restarting worker

But this is **not required** - on-demand refresh is sufficient.

---

**Status**: Ready to deploy if cameras fail at 3:45 PM test
**Monitoring**: Active (checking every hour)
**Next Check**: 8:26 AM (then hourly until 3:45 PM critical test)
