---
paths: src/middleware.ts, src/lib/auth*, src/app/api/**
---

# Security & Authorization Rules

## User Roles

| Role | Description | Users |
|------|-------------|-------|
| owner | Full access to all features | Anne, Todd, Michael, Amelia |
| bookkeeper | Limited to bills and payments | Barbara Brady (CBIZ) |

## Route Access Control

Middleware enforces route restrictions. See `src/middleware.ts`.

### Bookkeeper Allowed Routes
```
/                    # Dashboard (filtered view)
/payments            # All payments pages
/payments/taxes
/payments/recurring
/settings            # Profile settings only
```

### Bookkeeper Blocked Routes
```
/properties/**       # No property management
/vehicles/**         # No vehicle management
/vendors/**          # No vendor editing (view-only API)
/insurance/**        # No policy management
/maintenance/**      # No maintenance tasks
/documents/**        # No document access
/reports/**          # No analytics
/settings/gmail      # No email integration
/buildinglink/**     # No building communications
```

## Data-Level Restrictions

Beyond route blocking, bookkeeper access is enforced at the data level:

### Bills & Payments
- Full CRUD on bills table
- Can mark payments as sent/confirmed
- Can add payment references and notes
- Can view (not edit) vendor information on bills

### Read-Only Access
- Vendors: Can view to see who bills are from
- Properties: Can see names in dropdowns (no details)
- Vehicles: Can see names in dropdowns (no details)

### No Access
- Equipment
- Maintenance tasks/history
- Documents
- Insurance claims
- Seasonal tasks
- Shared task lists

## Session Management

Simple cookie-based session (no external auth provider):
- Session stored in cookie: `session`
- Contains: `{ userId, email, role }`
- No JWT, no refresh tokens
- Session persists until browser close or explicit logout

## API Route Protection

All API routes should check authentication:
```typescript
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // For owner-only routes
  if (user.role !== 'owner') {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
}
```

## OAuth Security

### Gmail
- Tokens encrypted with AES-256-GCM before storage
- `TOKEN_ENCRYPTION_KEY` must be 32-byte hex string
- Refresh tokens rotated on use
- Tokens stored in `gmail_oauth_tokens` table

### Dropbox
- Tokens encrypted same as Gmail (AES-256-GCM)
- Tokens stored in `dropbox_oauth_tokens` table
- `namespace_id` stored for shared folder access
- Scopes: files.metadata.read, files.content.read, files.content.write, sharing.read, account_info.read

## Sensitive Data Handling

### Never Log
- OAuth tokens (access or refresh)
- TOKEN_ENCRYPTION_KEY
- User passwords (none stored - simple auth)

### Encrypt at Rest
- Gmail OAuth tokens
- Dropbox OAuth tokens
- Vendor login_info field (if used)

### Display Masking
- Show last 4 digits of account numbers
- Mask email addresses in logs

## Audit Trail

For sensitive actions, log to `payment_audit_log`:
- Bill creation
- Payment status changes
- Confirmation actions

Include: `performed_by`, `performed_at`, `old_status`, `new_status`

## Row Level Security (PostgreSQL)

RLS is enabled but currently uses simplified policies:
- All authenticated users have access
- Bookkeeper restrictions enforced at application layer

Future enhancement: Implement proper RLS policies based on user role.

## Error Handling

Never expose internal errors to users:
```typescript
try {
  // database operation
} catch (error) {
  console.error("Database error:", error)  // Log full error
  return Response.json({ error: "Operation failed" }, { status: 500 })  // Generic response
}
```
