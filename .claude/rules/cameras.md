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
