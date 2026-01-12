# Nest Legacy Camera Token Monitoring

## Overview

Nest Legacy cameras use an unofficial Dropcam API that requires a `user_token` cookie from home.nest.com. This token expires approximately every 30 days and must be manually refreshed.

**Why manual refresh?** Google's OAuth login cannot be reliably automated:
- Sophisticated bot detection (IP reputation, browser fingerprinting, behavioral analysis)
- Constantly evolving anti-automation measures
- Production systems (Home Assistant, Homebridge) all use manual token extraction
- Browser automation (Puppeteer/Playwright) constantly breaks with Google updates

## Architecture

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Auth Module** | Retrieves encrypted tokens from DB | `src/lib/cameras/nest-legacy-auth.ts` |
| **Snapshot Endpoint** | Server-side proxy to Dropcam API | `src/app/api/cameras/[cameraId]/snapshot/route.ts` |
| **Monitoring Script** | Checks expiration daily | `scripts/check-nest-token-expiration.js` |
| **Update Script** | Manual token update command | `scripts/update-nest-token-manual.js` |
| **Unified Worker** | Runs monitoring at 3 AM daily | `scripts/unified-worker.js` (lines 267-313) |

### Data Flow

```
home.nest.com (user extracts cookie)
         ↓
update-nest-token-manual.js (tests & encrypts)
         ↓
camera_credentials table (AES-256-GCM encrypted)
         ↓
nest-legacy-auth.ts (decrypts & validates)
         ↓
/api/cameras/[id]/snapshot (proxies to Dropcam API)
         ↓
Camera Grid/Fullscreen (displays images)
```

## Token Lifecycle

### 1. Initial Setup
```bash
# Extract token from home.nest.com
# 1. Open home.nest.com in browser
# 2. Press F12 → Application → Cookies
# 3. Find "user_token" cookie
# 4. Copy the value (long base64 string)

# Store token (dev)
npm run nest:update-token <token>

# Store token (production)
ssh root@143.110.229.185
cd /root/app
npm run nest:update-token <token>
```

### 2. Automated Monitoring

**Schedule:** Daily at 3:00 AM NYC time (via unified worker)

**Process:**
1. Worker spawns `check-nest-token-expiration.js`
2. Script queries `camera_credentials` table
3. Decrypts credentials and checks `expires_at` field
4. If expiring within 7 days: sends Pushover alert
5. Updates `health_check_state` table
6. Exit code 1 triggers health monitoring

### 3. Alert Escalation

| Days Until Expiry | Alert Title | Priority | Instructions |
|-------------------|-------------|----------|--------------|
| 7 days | 🎯 Nest Legacy Token Expires in 7 Days | Normal | Full step-by-step guide |
| 6 days | ⏰ Expires in 6 Days | Normal | Reminder with steps |
| 5 days | 🚨 Expires in 5 Days | Normal | Urgent reminder |
| 4 days | 😬 Expires in 4 Days | Normal | Warning |
| 3 days | 😰 Expires in 3 Days | Normal | Alert |
| 2 days | 🆘 URGENT: Expires in 2 DAYS | High | Critical alert |
| 1 day | 🔥 EMERGENCY: Expires TOMORROW | High | Last chance |
| 0 days | 💀 CRITICAL: Expires TODAY | High | Immediate action |
| Expired | 🚨 TOKEN EXPIRED - CAMERAS BROKEN | High | Fix now |

**All alerts include:**
- Clear problem statement
- Impact description (cameras will stop working)
- Step-by-step token extraction instructions
- Exact SSH and npm commands to run

### 4. Manual Token Update

**When you receive an alert:**

```bash
# Step 1: Extract new token
# Open home.nest.com → F12 → Application → Cookies → Copy "user_token"

# Step 2: SSH to production
ssh root@143.110.229.185
cd /root/app

# Step 3: Update token
npm run nest:update-token <paste-token-here>

# Script will:
# - Test token against Dropcam API
# - Encrypt with AES-256-GCM
# - Store in camera_credentials table
# - Set expires_at to 30 days from now
```

## Database Schema

### camera_credentials Table

```sql
CREATE TABLE camera_credentials (
  provider TEXT PRIMARY KEY,  -- 'nest_legacy' or 'nest'
  credentials_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Encrypted Credentials Structure

```typescript
interface NestLegacyCredentials {
  access_token: string      // Base64 user_token from home.nest.com
  expires_at?: string       // ISO 8601 timestamp (30 days from update)
  updated_at?: string       // ISO 8601 timestamp
  email?: string           // Optional: login email
  user_id?: string         // Optional: Nest user ID
}
```

**Encryption:** AES-256-GCM using `TOKEN_ENCRYPTION_KEY` environment variable

## API Endpoints

### GET /api/cameras/[cameraId]/snapshot

**Purpose:** Server-side proxy to Dropcam API

**Authentication:**
- Next-Auth session required
- Property access check via `property_visibility`
- Server-side token retrieval from encrypted storage

**Process:**
1. Validate user session
2. Get camera from database
3. Check user has property access
4. Retrieve encrypted token from `camera_credentials`
5. Decrypt token server-side
6. Fetch snapshot from `nexusapi-us1.dropcam.com/get_image`
7. Return image with no-cache headers

**Error Handling:**
- 401: User not authenticated
- 403: User doesn't have property access OR token expired
- 404: Camera not found
- 500: Token decryption failed OR Dropcam API error

**Example:**
```bash
curl -H "Cookie: next-auth.session-token=..." \
  https://spmsystem.com/api/cameras/uuid-here/snapshot
```

## Scripts

### check-nest-token-expiration.js

**Purpose:** Daily monitoring script run by unified worker

**Features:**
- Connects to PostgreSQL database
- Decrypts credentials using `TOKEN_ENCRYPTION_KEY`
- Checks `expires_at` timestamp
- Sends Pushover alerts for expiring tokens
- Updates `health_check_state` table
- Exit code 1 if action needed (triggers health monitoring)

**Usage:**
```bash
node scripts/check-nest-token-expiration.js

# Output:
# Token expires: 2026-02-11T04:09:27.000Z
# Days until expiry: 29
# ✓ Token is valid for 29 more days
```

### update-nest-token-manual.js

**Purpose:** Manual token update with validation

**Features:**
- Tests token against Dropcam API before storing
- Encrypts with AES-256-GCM
- Preserves existing credential structure
- Sets 30-day expiration automatically
- Clear usage instructions

**Usage:**
```bash
npm run nest:update-token <new-token>

# Output:
# Testing new token...
# ✓ Token is valid
# ✓ Token updated successfully
# Token expires: 2026-02-11T12:00:00.000Z
# Days until expiry: 30
```

## Monitoring & Health Checks

### Health Check Integration

The monitoring script updates the `health_check_state` table:

```sql
INSERT INTO health_check_state (check_name, status, last_checked_at)
VALUES ('nest_token_check', 'ok', NOW())
ON CONFLICT (check_name) DO UPDATE SET
  status = 'ok',
  last_checked_at = NOW();
```

**Status values:**
- `ok` - Token valid for >7 days
- `warning` - Token expires within 7 days (alert sent)
- `critical` - Token expired or check failed

### Unified Worker Integration

**File:** `scripts/unified-worker.js` (lines 267-313)

**Schedule:** Daily at 3:00 AM NYC time

**State tracking:**
```json
{
  "lastNestTokenCheck": "2026-01-11"
}
```

**Process:**
1. Check if current hour is 3 AM NYC time
2. Check if already ran today (via state file)
3. Spawn `node scripts/check-nest-token-expiration.js`
4. Capture output and exit code
5. Update state file with current date
6. Update health_check_state based on exit code

## Troubleshooting

### Token Expired Unexpectedly

**Symptoms:**
- Broken images on cameras page
- 403 errors in logs
- Health check shows `critical`

**Fix:**
```bash
ssh root@143.110.229.185
cd /root/app
npm run nest:update-token <new-token>
```

### Monitoring Not Running

**Check unified worker:**
```bash
# Dev
docker logs app-worker-1 --tail 100 | grep -i "nest token"

# Production
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 100 | grep -i 'nest token'"
```

**Verify state file:**
```bash
cat scripts/.unified-worker-state.json | jq .lastNestTokenCheck
```

### Pushover Alerts Not Sending

**Check environment variables:**
```bash
# Must be set in both .env.local and .env.production
PUSHOVER_TOKEN=...
PUSHOVER_USER=...
```

**Test Pushover manually:**
```bash
node scripts/check-nest-token-expiration.js
# Should see: ✓ Sent Pushover alert
```

### Token Validation Fails

**Error:** `Token is invalid (401/403)`

**Causes:**
1. Token already expired
2. Token extracted incorrectly (truncated/extra characters)
3. Home.nest.com logout invalidated token

**Fix:** Extract fresh token from home.nest.com

## Security Considerations

### Token Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 32-byte hex string in `TOKEN_ENCRYPTION_KEY` env var
- **IV:** Randomly generated per encryption (16 bytes)
- **Auth Tag:** Prevents tampering (16 bytes)

### Token Storage

**Encrypted format:**
```
[IV (16 bytes)][Encrypted Data (variable)][Auth Tag (16 bytes)]
```

**Base64 encoded** before storing in PostgreSQL TEXT column

### Access Control

1. **Database level:** Credentials table requires app database user
2. **Application level:** Server-side only, never sent to client
3. **API level:** Session auth + property visibility check
4. **Proxy pattern:** Client never sees raw token

### Production Secrets

**Required environment variables:**
- `TOKEN_ENCRYPTION_KEY` - For credential encryption/decryption
- `PUSHOVER_TOKEN` - For alert notifications
- `PUSHOVER_USER` - For alert delivery

## Testing

### Manual Test Suite

```bash
# 1. Check current token status
npm run nest:check-token

# 2. Test snapshot endpoint (dev)
curl http://localhost:3000/api/cameras/<camera-id>/snapshot \
  -H "Cookie: next-auth.session-token=<your-session>"

# 3. Verify worker is running
docker logs app-worker-1 --tail 50

# 4. Test token update (use dummy token first)
npm run nest:update-token test_token_123
# Should fail with "Token is invalid (401/403)"
```

### Production Verification

```bash
# 1. Check health endpoint
curl -s https://spmsystem.com/api/health | jq '.checks[] | select(.name == "nest_token_check")'

# 2. View monitoring logs
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 100 | grep -i nest"

# 3. Test snapshot endpoint
curl -I https://spmsystem.com/api/cameras/<id>/snapshot

# 4. Verify alerts received
# Check Pushover app for test notification
```

## Future Considerations

### Known Limitations

1. **30-day token lifespan** - Cannot be extended
2. **Manual refresh required** - Automation unreliable
3. **No 2FA support** - Assumes simple password login
4. **Unofficial API** - Google could change/deprecate at any time

### Potential Improvements

1. **SMS fallback alerts** - If Pushover fails
2. **Multiple notification channels** - Email, SMS, Slack
3. **Token rotation history** - Track when tokens were updated
4. **Auto-detect broken cameras** - Health check beyond token expiration
5. **Backup authentication method** - If Dropcam API changes

### Migration Path

If Google deprecates Dropcam API:
1. Migrate legacy cameras to Device Access API (if supported)
2. Replace with alternative camera system (UniFi, Eufy, etc.)
3. Update database schema to add provider-specific fields
4. Implement new auth modules following existing patterns

## References

- [Home Assistant Nest Legacy Integration](https://github.com/home-assistant/core/blob/dev/homeassistant/components/nest_legacy/)
- [Homebridge Nest Cam (Archived)](https://github.com/Brandawg93/homebridge-nest-cam)
- [Unofficial Dropcam API Documentation](https://github.com/dgreif/ring/wiki/Nest-API)
- [Google Device Access Console](https://console.nest.google.com/device-access/)

## Support

For issues or questions:
1. Check application logs: `/prod-logs`
2. Review health checks: `/health`
3. Verify environment variables are set
4. Test token manually with update script
5. Check Pushover notification delivery
