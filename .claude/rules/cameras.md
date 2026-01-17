---
paths: src/lib/cameras/**, src/app/api/cameras/**, src/components/cameras/**
---

# Camera Integrations

## Camera Types

| Type | Provider | Auth | Snapshot Method |
|------|----------|------|-----------------|
| Modern Nest (battery) | `nest` | Google OAuth | WebRTC frame capture via Playwright |
| Nest Legacy (wired) | `nest_legacy` | user_token cookie | Dropcam API |
| HikVision NVR | `hikvision` | Digest auth | ISAPI snapshot endpoint |

## Key APIs

- Modern Nest: Google SDM API (`smartdevicemanagement.googleapis.com`) + WebRTC
- Nest Legacy: Dropcam API (`nexusapi-us1.camera.home.nest.com`)
- HikVision: ISAPI (`/ISAPI/Streaming/channels/{channel}/picture`)

## Modern Nest WebRTC Snapshots

Battery-powered Nest cameras don't support the `GenerateImage` API. Instead, we capture snapshots via WebRTC:

1. **Playwright script** (`scripts/capture-nest-snapshot.js`) launches headless Chromium
2. **Capture page** (`/api/cameras/capture-frame`) establishes WebRTC connection
3. **Internal stream** (`/api/cameras/internal-stream`) calls Nest SDM API for WebRTC SDP exchange
4. Frame is captured from video stream to canvas, saved as JPEG

**Docker requirements:**
- Debian slim base image (not Alpine) for Chromium support
- Playwright's bundled Chromium installed via `npx playwright install chromium`
- Dependencies: libgtk-3-0, libnss3, libgbm1, etc.

**Key files:**
- `scripts/capture-nest-snapshot.js` - Playwright capture script
- `src/lib/cameras/snapshot-fetcher.ts` - Calls capture script via async spawn
- `src/app/api/cameras/capture-frame/route.ts` - HTML page for WebRTC
- `src/app/api/cameras/internal-stream/route.ts` - CRON_SECRET-authenticated stream endpoint

## Modern Nest OAuth

**Env vars (separate from Gmail):**
```
NEST_PROJECT_ID=734ce5e7-4da8-45d4-a840-16d2905e165e
NEST_CLIENT_ID=120115699308-jt3jqkgvp4du0cjsmf6fn3p3vtu4ruos.apps.googleusercontent.com
NEST_CLIENT_SECRET=<secret>
```

**Re-authorization:**
```bash
source .env.local && node scripts/get-nest-auth-url.js  # Get URL
# Visit URL, authorize as anne's Google account
source .env.local && node scripts/nest-token-exchange.js CODE
```

**Google Cloud:** https://console.cloud.google.com/apis/credentials?project=nest-camera-view
**Device Access:** https://console.nest.google.com/device-access/project/734ce5e7-4da8-45d4-a840-16d2905e165e

## Token Update (Legacy)

**CRITICAL:** `npm run nest:update-token` updates LOCAL database only! For production:

When Pushover alert received (immediate 403 alert or 7-day expiry warning):
1. Open home.nest.com → DevTools (F12) → Application → Cookies → copy `user_token`
2. Update **production** database directly:
```bash
# Get token encrypted locally then update prod DB
TOKEN="<paste_token_here>"
ENCRYPTED=$(node -e "..." "$TOKEN")  # Use encryption from update script
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c \"UPDATE camera_credentials SET credentials_encrypted = '\$ENCRYPTED', updated_at = NOW() WHERE provider = 'nest_legacy'\""
```

**Or** run update script with production DATABASE_URL:
```bash
DATABASE_URL=<prod_url> npm run nest:update-token <token>
```

**Reliability features (v0.10.30):**
- Immediate Pushover alert on first 403 error (1-hour cooldown)
- Fallback to cached snapshot when token expires
- Token test uses same auth method as actual API

## Tables

- `cameras` - Camera definitions (property_id, provider, external_id)
- `camera_credentials` - Encrypted tokens (credentials_json, token_expires_at)

## Worker Tasks

- Snapshot sync: every 5 minutes
- Token expiration check: daily 3 AM (alerts 7 days before expiry)

## Troubleshooting

| Error | Fix |
|-------|-----|
| 401 Modern | Token auto-refreshes; check NEST_PROJECT_ID |
| 401 Legacy | Run `npm run nest:update-token` |
| Blank snapshot | Camera offline or wrong UUID |
| `invalid_client` | Secret changed in Google Cloud; create new secret, update env, re-auth |
| `Enterprise not found` | Wrong OAuth client; use NEST_CLIENT_ID not GOOGLE_CLIENT_ID |
| WebRTC timeout | Check Chromium is installed; verify CRON_SECRET is set |
| `SDP must end with CRLF` | Fixed in capture-frame; SDP offer has proper line endings |
| `execSync blocking` | Use async spawn (already implemented) |
| Playwright crash in Docker | Ensure Debian slim image with all GTK/NSS dependencies |

**Credentials backup:** `backups/oauth-credentials-*.md`

## HikVision Setup

HikVision NVR cameras use Digest authentication via ISAPI.

**Credentials stored in `camera_credentials` table:**
```json
{
  "base_url": "http://192.168.x.x",
  "username": "admin",
  "password": "xxx"
}
```

**Channel mapping:** Camera number × 100 + 1 (e.g., Camera 1 → Channel 101)
