---
paths: src/middleware.ts, src/lib/auth*
---

# Security

## Roles

| Role | Users | Access |
|------|-------|--------|
| owner | Anne, Todd, Michael, Amelia | Full |
| bookkeeper | Barbara Brady (CBIZ) | `/`, `/payments/**`, `/settings` only |

## Bookkeeper Restrictions

**Allowed:** Dashboard (filtered), all payments pages, profile settings

**Blocked:** Properties, vehicles, vendors (edit), insurance, maintenance, documents, reports, Gmail settings

**Data level:** Full CRUD on bills, read-only on vendors/properties/vehicles

## Session

Cookie-based (`session`), contains `{ userId, email, role }`. No JWT.

## OAuth Configuration

**Two separate Google Cloud projects:**

| Project | Services | Env Vars |
|---------|----------|----------|
| Property Management | Gmail API | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| nest camera view | Device Access (SDM) | `NEST_CLIENT_ID`, `NEST_CLIENT_SECRET`, `NEST_PROJECT_ID` |

**Token Storage:**

| Service | Table | Encryption |
|---------|-------|------------|
| Gmail | `gmail_oauth_tokens` | Plaintext |
| Dropbox | `dropbox_oauth_tokens` | Plaintext |
| Nest | `camera_credentials` | AES-256-GCM |

Token encryption uses `TOKEN_ENCRYPTION_KEY` (32-byte hex). **NEVER change this key.**

## Re-Auth Procedures

**Gmail:** Visit /settings → Connect Gmail → Sign in as anne@annespalter.com

**Nest:**
```bash
source .env.local && node scripts/get-nest-auth-url.js  # Get auth URL
source .env.local && node scripts/nest-token-exchange.js CODE  # Exchange code
```

**Credentials Backup:** `backups/oauth-credentials-*.md` (gitignored)

## API Protection

```typescript
const user = await getCurrentUser()
if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
if (user.role !== 'owner') return Response.json({ error: "Forbidden" }, { status: 403 })
```
