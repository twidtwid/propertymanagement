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

## OAuth Tokens

Encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY` (32-byte hex).

| Service | Table |
|---------|-------|
| Gmail | `gmail_oauth_tokens` |
| Dropbox | `dropbox_oauth_tokens` |
| Nest | `camera_credentials` |

## API Protection

```typescript
const user = await getCurrentUser()
if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
if (user.role !== 'owner') return Response.json({ error: "Forbidden" }, { status: 403 })
```
