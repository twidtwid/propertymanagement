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

## Nest Legacy Authentication (Issue Token + Cookies Method)

**CRITICAL: Use Safari, not Chrome!** Per [homebridge-nest-accfactory](https://github.com/n0rt0nthec4t/homebridge-nest-accfactory):
> "Tokens must be obtained using Safari. Other browsers do not reliably generate valid or non-expiring tokens."

### How It Works

1. **issue_token URL** + **cookies** → Google access token (short-lived)
2. Google access token → Nest JWT (1 hour)
3. Nest JWT → Dropcam API for snapshots

The issue_token/cookies act as long-lived credentials. As long as you stay logged into home.nest.com, they remain valid for weeks.

### Getting Fresh Credentials (Safari Only)

1. Open **Safari** (not Chrome!)
2. Enable Developer Tools: Safari → Settings → Advanced → "Show features for web developers"
3. Open Developer Tools: Develop → Show JavaScript Console
4. Click **Network** tab, enable **Preserve Log**
5. Go to **home.nest.com** and sign in with Google
6. Find the `iframerpc` request in Network tab
7. Copy:
   - **Request URL** (full URL starting with `https://accounts.google.com/o/oauth2/iframerpc?...`) → `issue_token`
   - **Cookie header** (entire multi-line string) → `cookies`
8. **DO NOT log out** - just close the tab

### Updating Production Credentials

```bash
# 1. Create encryption script
cat << 'SCRIPT' > /tmp/encrypt-nest-creds.js
const crypto = require('crypto');
const creds = { issue_token: process.argv[2], cookies: process.argv[3] };
const key = Buffer.from(process.argv[4], 'hex');
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(JSON.stringify(creds), 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const combined = Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
console.log(combined.toString('base64'));
SCRIPT

# 2. Copy to server and encrypt
scp /tmp/encrypt-nest-creds.js root@143.110.229.185:/tmp/
ssh root@143.110.229.185 "docker cp /tmp/encrypt-nest-creds.js app-app-1:/tmp/"

# 3. Save issue_token and cookies to files (avoid shell escaping)
echo "ISSUE_TOKEN_HERE" > /tmp/nest_issue_token.txt
echo "COOKIES_HERE" > /tmp/nest_cookies.txt
scp /tmp/nest_issue_token.txt /tmp/nest_cookies.txt root@143.110.229.185:/tmp/

# 4. Encrypt and update database
ssh root@143.110.229.185 'ISSUE_TOKEN=$(cat /tmp/nest_issue_token.txt) && \
  COOKIES=$(cat /tmp/nest_cookies.txt) && \
  ENCRYPTION_KEY=$(docker exec app-app-1 printenv TOKEN_ENCRYPTION_KEY) && \
  ENCRYPTED=$(docker exec app-app-1 node /tmp/encrypt-nest-creds.js "$ISSUE_TOKEN" "$COOKIES" "$ENCRYPTION_KEY") && \
  docker exec -i app-db-1 psql -U propman -d propertymanagement -c \
    "UPDATE camera_credentials SET credentials_encrypted = '"'"'$ENCRYPTED'"'"', updated_at = NOW() WHERE provider = '"'"'nest_legacy'"'"'"'

# 5. Test
ssh root@143.110.229.185 "curl -s -X POST 'http://localhost:3000/api/cameras/nest-jwt-refresh' \
  -H 'Authorization: Bearer \$(grep CRON_SECRET /root/app/.env.production | cut -d= -f2)'"
```

### Headers (Match homebridge-nest-accfactory Exactly)

```typescript
headers: {
  'Referer': 'https://accounts.google.com/',
  'Cookie': cookies,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XmlHttpRequest'
}
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `USER_LOGGED_OUT` | Google session expired | Get fresh Safari cookies |
| `Unsupported state or unable to authenticate data` | Encryption format mismatch | Use base64, not hex encoding |
| 401/403 on snapshots | JWT expired | Automatic refresh should handle; check logs |

### References

- [homebridge-nest-accfactory](https://github.com/n0rt0nthec4t/homebridge-nest-accfactory) - Safari requirement, headers
- [homebridge-nest](https://github.com/chrisjshull/homebridge-nest) - Original implementation
- [Issue #630](https://github.com/chrisjshull/homebridge-nest/issues/630) - Known authentication issues

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
