---
paths: src/lib/cameras/**, src/app/api/cameras/**, src/components/cameras/**
---

# Camera Integrations

## Camera Types

| Type | Auth | Token Refresh |
|------|------|---------------|
| Modern Nest | Google OAuth | Automatic via refresh_token |
| Nest Legacy | user_token cookie | Manual every ~30 days |

## Key APIs

- Modern: Google SDM API at `smartdevicemanagement.googleapis.com`
- Legacy: Dropcam API at `nexusapi-us1.camera.home.nest.com`

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

When Pushover alert received:
1. DevTools on home.nest.com → Application → Cookies → `user_token`
2. Run: `npm run nest:update-token <token>`

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

**Credentials backup:** `backups/oauth-credentials-*.md`
