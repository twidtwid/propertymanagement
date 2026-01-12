# Google Nest Camera OAuth Setup & Token Refresh

**Last Updated:** 2026-01-12
**Status:** ✅ Working in Production

## Overview

This document explains the Google Nest/SDM OAuth integration, including setup, token refresh mechanism, and how to prevent OAuth configuration issues.

## Critical Configuration

### Current OAuth Client (PRODUCTION)

```bash
GOOGLE_CLIENT_ID=120115699308-jt3jqkgvp4du0cjsmf6fn3p3vtu4ruos.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[Stored in .env.production - see 1Password]
NEST_PROJECT_ID=734ce5e7-4da8-45d4-a840-16d2905e165e
```

**⚠️ CRITICAL:** These credentials are linked together in Google Device Access Console. Changing any one requires updating the linkage.

**Security Note:** The OAuth client secret is NOT stored in this repository. It must be securely stored in:
- Production: `/root/app/.env.production` on server
- Development: `.env.local` (gitignored)
- Backup: 1Password or secure credential storage

## Architecture

### Token Refresh Flow

```
1. User requests camera stream
2. Stream endpoint calls getValidNestToken()
   ├─ Checks if token expires in <5 minutes
   ├─ If yes: calls refreshNestToken()
   │   ├─ Gets refresh_token from database
   │   ├─ Calls Google OAuth API
   │   ├─ Gets new access_token
   │   └─ Saves to database
   └─ Returns valid access_token
3. Stream endpoint calls Nest API with token
   ├─ If 401: calls refreshNestToken() and retries
   └─ If success: returns stream data
```

### Files

| File | Purpose |
|------|---------|
| `src/lib/cameras/nest-auth.ts` | Token management functions |
| `src/app/api/cameras/[cameraId]/stream/route.ts` | Stream endpoint with retry logic |
| `scripts/nest-token-exchange.js` | OAuth authorization code exchange |
| `scripts/test-nest-token-refresh.js` | Test token refresh mechanism |
| `scripts/test-camera-streaming.js` | Comprehensive integration test |

### Database

**Table:** `camera_credentials`

| Column | Type | Description |
|--------|------|-------------|
| provider | text | 'nest' |
| credentials_encrypted | text | Base64-encoded encrypted JSON |

**Encrypted Format:**
```json
{
  "access_token": "ya29...",
  "refresh_token": "1//...",
  "expires_at": 1736659626879
}
```

**Encryption:** AES-256-GCM, key from `TOKEN_ENCRYPTION_KEY` env var

## OAuth Setup Process

### Prerequisites

1. **Google Cloud Project** with OAuth 2.0 Client configured
2. **Google Device Access Project** linked to OAuth client
3. **Nest Account** with camera devices

### Step-by-Step Setup

#### 1. Configure OAuth Client in Google Cloud Console

Visit: https://console.cloud.google.com/apis/credentials

**Required Settings:**
- **Client Type:** Web application
- **Authorized redirect URIs:**
  ```
  http://localhost:3000/api/auth/nest/callback
  https://spmsystem.com/api/auth/nest/callback
  ```
- **OAuth Consent Screen:**
  - User Type: External
  - Add test users (if in testing mode)
  - Scopes:
    - `https://www.googleapis.com/auth/sdm.service`
    - `https://www.googleapis.com/auth/pubsub`

#### 2. Link OAuth Client to Device Access Project

Visit: https://console.nest.google.com/device-access/

1. Select your Device Access Project
2. Verify OAuth Client ID matches what's in your environment
3. **⚠️ CRITICAL:** Once linked, you cannot change the OAuth client through UI

#### 3. Generate Authorization URL

```bash
docker compose exec app node scripts/get-nest-auth-url.js
```

#### 4. Complete OAuth Flow

1. Visit the generated URL
2. Sign in with Google account that has Nest access
3. Authorize the application
4. Copy the `code` parameter from redirect URL

#### 5. Exchange Code for Tokens

```bash
docker compose exec app node scripts/nest-token-exchange.js "YOUR_CODE_HERE"
```

#### 6. Save Tokens to Database

The script will output encrypted credentials. Save them:

```bash
docker compose exec db psql -U postgres -d propertymanagement -c "
DELETE FROM camera_credentials WHERE provider = 'nest';
INSERT INTO camera_credentials (provider, credentials_encrypted)
VALUES ('nest', 'ENCRYPTED_STRING_HERE');
"
```

For production:
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c \"...\""
```

#### 7. Verify Setup

```bash
# Dev
docker compose exec app node scripts/test-nest-token-refresh.js

# Production
ssh root@143.110.229.185 "docker exec app-app-1 node scripts/test-nest-token-refresh.js"
```

## Token Refresh Mechanism

### Automatic Refresh

**File:** `src/lib/cameras/nest-auth.ts`

```typescript
export async function getValidNestToken(): Promise<string> {
  const credentials = await getNestCredentials()

  // Check if token is expired or about to expire (within 5 minutes)
  if (credentials.expires_at && credentials.expires_at < Date.now() + 5 * 60 * 1000) {
    console.log('Nest token expired, refreshing...')
    return await refreshNestToken()
  }

  return credentials.access_token
}
```

**When it runs:**
- Before every Nest API call (proactive)
- After 401 response (reactive)
- Tokens refresh automatically every ~55 minutes

### Manual Token Refresh

```bash
# Dev
docker compose exec app node scripts/test-nest-token-refresh.js

# Production
ssh root@143.110.229.185 "docker exec app-app-1 node scripts/test-nest-token-refresh.js"
```

## Common Issues & Solutions

### Issue 1: "redirect_uri_mismatch" Error

**Cause:** Redirect URI not registered in OAuth client
**Solution:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Edit your OAuth 2.0 Client ID
3. Add redirect URI to "Authorized redirect URIs"
4. Wait 30 seconds for propagation
5. Try authorization again

### Issue 2: "org_internal" / "Access blocked" Error

**Cause:** OAuth consent screen set to "Internal"
**Solution:**
1. Go to Google Cloud Console > APIs & Services > OAuth consent screen
2. Change User Type from "Internal" to "External"
3. If in testing mode, add your Google account as a test user
4. Try authorization again

### Issue 3: "unauthorized_client" When Refreshing Token

**Causes:**
1. OAuth client secret was regenerated
2. Refresh token was created with different OAuth client
3. OAuth client and refresh token don't match

**Solution:**
1. Check that `GOOGLE_CLIENT_SECRET` matches what's in Google Cloud Console
2. If secret was regenerated, re-authorize to get new tokens
3. Verify OAuth client ID matches what's linked in Device Access Console

### Issue 4: "Enterprise not found" (404)

**Cause:** OAuth client not linked to Device Access project
**Solution:**
1. Go to https://console.nest.google.com/device-access/
2. Click your Device Access Project
3. Verify the OAuth Client ID matches `GOOGLE_CLIENT_ID` env var
4. If mismatch: Update env vars to use the linked OAuth client
5. Re-authorize to get new tokens with correct client

### Issue 5: Tokens Work in Dev but Not Prod

**Causes:**
1. Environment variable mismatch
2. Different OAuth client in dev vs prod
3. Credentials not copied to production database

**Solution:**
1. Verify env vars match in both environments:
   ```bash
   # Dev
   grep GOOGLE_ .env.local

   # Prod
   ssh root@143.110.229.185 "grep GOOGLE_ /root/app/.env.production"
   ```
2. Copy credentials to production database
3. Restart production app

## Monitoring & Prevention

### Health Check

Add to `src/app/api/health/route.ts`:

```typescript
// Check Nest OAuth token validity
try {
  const credentials = await getNestCredentials()
  const expiresIn = Math.round((credentials.expires_at - Date.now()) / 1000 / 60)

  checks.nest_oauth = {
    status: expiresIn > 5 ? 'ok' : 'warning',
    expiresInMinutes: expiresIn,
    needsRefresh: expiresIn < 5
  }
} catch (error) {
  checks.nest_oauth = {
    status: 'error',
    error: error.message
  }
}
```

### Automated Testing

**Cron job** (runs every 6 hours):

```bash
# Add to production crontab
0 */6 * * * docker exec app-app-1 node scripts/test-nest-token-refresh.js >> /var/log/nest-token-test.log 2>&1 || /root/send-pushover.sh "Nest token refresh test failed"
```

### Environment Variable Validation

**File:** `src/instrumentation.ts` (already exists)

Add validation:
```typescript
// Validate Nest OAuth configuration
if (!process.env.GOOGLE_CLIENT_ID?.startsWith('120115699308-jt3jqkgvp4du0cjsmf6fn3p3vtu4ruos')) {
  throw new Error('GOOGLE_CLIENT_ID mismatch - must use OAuth client linked to Device Access project')
}
```

### Documentation Checklist

**Before changing OAuth configuration:**

- [ ] Document current CLIENT_ID and CLIENT_SECRET
- [ ] Check Device Access Console linkage
- [ ] Back up current tokens from database
- [ ] Test in dev environment first
- [ ] Verify in production before rolling out
- [ ] Update this document with new credentials

## Troubleshooting Commands

```bash
# Check dev token expiration
docker compose exec db psql -U postgres -d propertymanagement -c "
  SELECT provider, created_at, updated_at FROM camera_credentials WHERE provider = 'nest';
"

# Check production token expiration
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c \"
  SELECT provider, created_at, updated_at FROM camera_credentials WHERE provider = 'nest';
\""

# Test Nest API access (dev)
docker compose exec app node -e "
  fetch('https://smartdevicemanagement.googleapis.com/v1/enterprises/${process.env.NEST_PROJECT_ID}/devices')
    .then(r => console.log('Status:', r.status))
"

# View recent Nest API errors (production)
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100 | grep -i nest"

# Manual token refresh (dev)
docker compose exec app node scripts/test-nest-token-refresh.js

# Manual token refresh (production)
ssh root@143.110.229.185 "docker exec app-app-1 node scripts/test-nest-token-refresh.js"
```

## Emergency Recovery

If OAuth is completely broken:

1. **Back up current configuration:**
   ```bash
   cp .env.local .env.local.backup
   ssh root@143.110.229.185 "cp /root/app/.env.production /root/app/.env.production.backup"
   ```

2. **Extract current credentials:**
   ```bash
   # Dev
   docker compose exec db psql -U postgres -d propertymanagement -c "
     SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest';
   " > nest-creds-backup.txt
   ```

3. **Follow OAuth Setup Process** (from beginning)

4. **Test thoroughly in dev** before deploying to production

## References

- **Google Device Access Console:** https://console.nest.google.com/device-access/
- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials
- **SDM API Docs:** https://developers.google.com/nest/device-access
- **OAuth 2.0 Spec:** https://oauth.net/2/

## Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-01-12 | Initial OAuth setup and token refresh implementation | Claude |
| 2026-01-12 | Resolved OAuth client mismatch, linked correct client to Device Access project | Claude |
| 2026-01-12 | Verified working in both dev and production | Claude |
