---
paths: src/lib/cameras/**, src/app/api/cameras/**, src/components/cameras/**, scripts/*nest*.py
---

# Camera Integrations

**Use this file when:** Working with Nest cameras, troubleshooting camera streaming, updating camera tokens, or implementing camera features.

---

## Overview

The system supports two types of Nest cameras:

1. **Modern Nest** - Google Device Access API (OAuth-based, automatic token refresh)
2. **Nest Legacy** - Unofficial Dropcam API (manual token refresh required)

---

## Modern Nest Cameras (Google Device Access API)

### Authentication

**OAuth Flow:**
- Scopes: `https://www.googleapis.com/auth/sdm.service`, `https://www.googleapis.com/auth/userinfo.email`
- Tokens stored encrypted in `camera_credentials` table
- Automatic token refresh via refresh_token
- Token encryption: AES-256-GCM using TOKEN_ENCRYPTION_KEY

**Required Environment Variables:**
```bash
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
NEST_PROJECT_ID=<device-access-console-project-id>
TOKEN_ENCRYPTION_KEY=<32-byte-hex-for-aes-256-gcm>
```

### Features

**Live Streaming:**
- Endpoint: `/api/cameras/[id]/stream`
- Handles 2+ hour streaming sessions
- Automatic token refresh during active streams
- RTSP stream URL generation via Google SDM API

**Camera Management:**
- List devices: `GET /api/cameras`
- Get single camera: `GET /api/cameras/[id]`
- Camera events and status via SDM API

### Implementation Details

**Token Refresh:**
```typescript
// Automatic refresh when access_token expires
const refreshToken = async (cameraId: string) => {
  const camera = await pool.query(
    'SELECT google_refresh_token FROM camera_credentials WHERE camera_id = $1',
    [cameraId]
  )

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: camera.google_refresh_token,
      grant_type: 'refresh_token'
    })
  })

  const data = await response.json()
  // Update encrypted token in database
}
```

**Stream Generation:**
```typescript
// Generate RTSP stream URL
const generateStream = async (cameraId: string) => {
  const response = await fetch(
    `https://smartdevicemanagement.googleapis.com/v1/enterprises/${NEST_PROJECT_ID}/devices/${cameraId}:executeCommand`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'sdm.devices.commands.CameraLiveStream.GenerateRtspStream',
        params: {}
      })
    }
  )

  const { results } = await response.json()
  return results.streamUrls.rtspUrl
}
```

### Troubleshooting

**401 Unauthorized:**
- Check if access token expired (refresh automatically)
- Verify NEST_PROJECT_ID is correct
- Verify camera still exists in Device Access Console

**Stream won't start:**
- Check if camera is online
- Verify RTSP URL is valid
- Check network connectivity
- Try regenerating stream URL

---

## Nest Legacy Cameras (Dropcam API)

### Authentication

**Manual Token Refresh:**
- Uses unofficial Dropcam API at `nexusapi-us1.camera.home.nest.com`
- Authentication via `user_token` cookie from home.nest.com
- Token expires approximately every 30 days
- **Automated monitoring:** Daily check at 3 AM NYC time
- **Pushover alerts:** 7 days before expiration

**Token Structure:**
```bash
# From browser after logging in to home.nest.com
# Extract the cztoken or user_token cookie (both have same value)
# API requires: Cookie: user_token=<token>
Cookie: user_token=<long-token-string>
```

### Features

**Snapshot Fetching:**
- Endpoint: `/api/cameras/[id]/snapshot`
- Returns latest camera image
- Image caching via Nest CDN
- No real-time streaming (snapshot only)

**Automated Updates:**
- Worker syncs snapshots every 5 minutes
- Stores latest snapshot timestamp in database
- Updates `last_snapshot_fetch` in cameras table

### Token Update Process

**Automated Monitoring:**
The unified worker checks token expiration daily at 3 AM:
```javascript
// In scripts/unified-worker.js
async function checkNestTokenExpiration() {
  const { rows } = await pool.query(`
    SELECT * FROM camera_credentials
    WHERE provider = 'nest_legacy'
    AND token_expires_at IS NOT NULL
  `)

  for (const cred of rows) {
    const daysUntilExpiry = Math.ceil(
      (new Date(cred.token_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilExpiry <= 7) {
      // Send Pushover alert with update instructions
      await sendPushoverAlert({
        title: 'Nest Legacy Token Expiring Soon',
        message: `Token expires in ${daysUntilExpiry} days. Update with: npm run nest:update-token <token>`,
        priority: 1
      })
    }
  }
}
```

**Manual Update (when alert received):**

1. Open Chrome DevTools on home.nest.com
2. Go to Application → Cookies
3. Copy the `user_token` value
4. Run update command:
```bash
npm run nest:update-token <token>
```

**Update Script:**
```bash
#!/bin/bash
# scripts/update_nest_token.sh

TOKEN=$1
if [ -z "$TOKEN" ]; then
  echo "Usage: npm run nest:update-token <token>"
  exit 1
fi

# Calculate expiration (30 days from now)
EXPIRES=$(date -u -d "+30 days" +"%Y-%m-%d %H:%M:%S")

# Update database
psql $DATABASE_URL -c "
  UPDATE camera_credentials
  SET
    credentials_json = jsonb_set(
      COALESCE(credentials_json, '{}'::jsonb),
      '{user_token}',
      to_jsonb('$TOKEN'::text)
    ),
    token_expires_at = '$EXPIRES'
  WHERE provider = 'nest_legacy'
"

echo "Token updated. Expires: $EXPIRES"
```

### Implementation Details

**Snapshot Fetch:**
```typescript
// Fetch latest snapshot
const fetchSnapshot = async (cameraId: string, userToken: string) => {
  const response = await fetch(
    `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${cameraId}&width=1920`,
    {
      headers: {
        'Cookie': `user_token=${userToken}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://home.nest.com/'
      }
    }
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Token expired - update required')
    }
    throw new Error(`Snapshot fetch failed: ${response.statusText}`)
  }

  return response.blob()
}
```

### Troubleshooting

**401 Unauthorized:**
- Token expired - update using `npm run nest:update-token`
- Check Pushover alerts for expiration warnings
- Verify token copied correctly (no extra spaces)

**Snapshot returns blank image:**
- Camera may be offline
- Check camera status in Nest app
- Verify camera UUID is correct

**No Pushover alerts:**
- Check unified worker is running
- Verify Pushover credentials in environment
- Check `token_expires_at` is set in database

---

## Database Schema

### cameras Table

```sql
CREATE TABLE cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL, -- 'nest', 'nest_legacy'
  external_id text NOT NULL, -- Camera UUID or device ID
  location text,
  notes text,
  is_active boolean DEFAULT true,
  last_snapshot_fetch timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
```

### camera_credentials Table

```sql
CREATE TABLE camera_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES cameras(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'nest', 'nest_legacy'
  credentials_json jsonb NOT NULL, -- Encrypted OAuth tokens or user_token
  google_refresh_token text, -- For Modern Nest only
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
```

**credentials_json Structure:**

Modern Nest:
```json
{
  "access_token": "<encrypted>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Nest Legacy:
```json
{
  "user_token": "<user-token-from-cookie>"
}
```

---

## API Endpoints

### Modern Nest

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cameras` | GET | List all cameras |
| `/api/cameras/[id]` | GET | Get single camera details |
| `/api/cameras/[id]/stream` | GET | Generate live stream URL |
| `/api/oauth/google/callback` | GET | OAuth callback handler |

### Nest Legacy

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cameras/[id]/snapshot` | GET | Get latest snapshot image |

---

## Worker Tasks

**Camera Snapshot Sync:**
- Interval: Every 5 minutes
- Endpoint: `/api/cron/sync-camera-snapshots`
- Updates `last_snapshot_fetch` timestamp
- Stores snapshot URL in database

**Nest Token Expiration Check:**
- Schedule: Daily at 3:00 AM NYC time
- Checks all `nest_legacy` credentials
- Sends Pushover alert 7 days before expiration
- Alert includes update instructions

---

## Migration Scripts

**Python Scripts for Setup:**

```bash
# Extract legacy credentials from browser
scripts/extract_nest_legacy_credentials.py

# Test API connectivity
scripts/test_nest_api.py

# Working API implementation reference
scripts/nest_working_api.py
```

---

## Production Monitoring

**Health Checks:**
```sql
-- Check last snapshot fetch
SELECT
  c.name,
  c.provider,
  c.last_snapshot_fetch,
  NOW() - c.last_snapshot_fetch as time_since_last_fetch
FROM cameras c
WHERE c.is_active = true
ORDER BY c.last_snapshot_fetch DESC;

-- Check token expiration
SELECT
  c.name,
  cc.provider,
  cc.token_expires_at,
  cc.token_expires_at - NOW() as time_until_expiry
FROM cameras c
JOIN camera_credentials cc ON c.id = cc.camera_id
WHERE cc.token_expires_at IS NOT NULL
ORDER BY cc.token_expires_at;
```

**Common Issues:**
- Modern Nest: Token refresh failures (check logs for 401 errors)
- Nest Legacy: Token expiration (check Pushover alerts)
- Both: Camera offline (check Nest app)
- Both: Network connectivity (check health endpoint)
