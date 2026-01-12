---
paths: docker-compose*, Dockerfile*, scripts/**, package.json
---

# Development Environment

## Local Dev Server

**Preferred:** Use `/deploydev` skill to restart with clean caches.

**Manual restart:**
```bash
# Quick (clears cache, restarts app only)
docker compose stop app && rm -rf .next && docker compose up -d app

# Full (if quick fails)
docker compose down && rm -rf .next && docker compose up -d

# Verify ready
docker compose logs app --tail 20  # Look for "Ready in XXXms"
```

**When to restart:**
- Hot reload fails
- Webpack or font errors
- After git pull

## Docker Containers

| Container | Purpose |
|-----------|---------|
| app-app-1 | Next.js web application |
| app-db-1 | PostgreSQL (user: propman) |
| app-worker-1 | Unified worker (email sync, daily summary, smart pins) |

## Unified Worker Architecture

**File:** `scripts/unified-worker.js`
**Memory:** 384MB (limit), 256MB (reserved)

**Architecture:**
- Single Node.js process with 60-second loop
- JSON state file: `scripts/.unified-worker-state.json`
- Updates `health_check_state` table after each task
- Graceful shutdown handlers (SIGTERM/SIGINT)

**Tasks:**
| Task | Interval | Endpoint | Purpose |
|------|----------|----------|---------|
| Email Sync | 10 min | `/api/cron/sync-emails` | Sync Gmail to vendor_communications |
| Smart Pins | 60 min | `/api/cron/sync-smart-pins` | Auto-pin urgent items |
| Daily Summary | 6:00 PM NYC | `/api/cron/daily-summary` | Email summary to family |

**Environment Variables:**
```yaml
APP_HOST=app                # Container hostname (not localhost!)
APP_PORT=3000               # App port
EMAIL_SYNC_INTERVAL=10      # Minutes between email syncs
SMART_PINS_INTERVAL=60      # Minutes between smart pin syncs
TZ=America/New_York         # Timezone for daily summary
```

**State Management:**
```json
{
  "lastEmailSync": "2026-01-11T23:05:01.386Z",
  "lastSmartPinsSync": "2026-01-11T22:43:22.726Z",
  "lastDailySummary": "2026-01-11"
}
```

**Logs:**
```bash
# Dev
docker logs app-worker-1 --tail 50

# Production
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 50"
```

**Health Check Integration:**
Worker updates `health_check_state` table after each run:
- ✅ Success: Sets status='ok', failure_count=0
- ❌ Failure: Sets status='critical', increments failure_count

**Why Unified?**
- **Before:** 3 containers (768MB) with separate state management
- **After:** 1 container (384MB) with centralized state
- **Benefits:** 50% memory savings, simpler debugging, unified logs

## Python Environment

**CRITICAL:** Always use `uv run python` for Python scripts. Never use system Python.

Python environment managed by uv (`.venv/`):
- anthropic - Claude API
- playwright - Browser automation for tax scraping
- pymupdf - PDF processing
- psycopg2-binary - PostgreSQL client

**Setup (one-time):**
```bash
uv sync                               # Install dependencies
uv run playwright install chromium    # Install browser for Playwright
```

**Usage:**
```bash
# NPM scripts (already configured)
npm run tax:sync
npm run tax:sync:live

# Direct script execution
uv run python scripts/sync_all_taxes.py
./scripts/sync_all_taxes.py          # Also works (uses shebang)

# With direnv (optional)
direnv allow                          # Activates .venv automatically
```

**How it works:**
- All `.py` scripts use `#!/usr/bin/env -S uv run python` shebang
- NPM scripts use `uv run python` prefix
- `.envrc` file enables direnv auto-activation (optional)
- `.python-version` specifies Python 3.12

## Production Server

| Item | Value |
|------|-------|
| Domain | spmsystem.com |
| IP | 143.110.229.185 |
| SSH | `ssh root@143.110.229.185` |
| App Directory | /root/app |

**CRITICAL:** Use `/deploy` skill for deployments. Never deploy manually.

## Production Commands

Use skills instead of running these directly:

```bash
# View logs (use /prod-logs instead)
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"

# Database shell (use /prod-db instead)
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"

# Health check (use /health instead)
curl -s https://spmsystem.com/api/health

# Restart app (use /deploy instead)
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml --env-file .env.production restart app"
```

## Production Cron Jobs

| Schedule | Task | Log |
|----------|------|-----|
| Every 15 min | Dropbox sync | /var/log/dropbox-sync.log |
| Every 15 min | Health check (Pushover alerts) | /var/log/health-check.log |
| Hourly | Dropbox token refresh | /var/log/dropbox-refresh.log |
| 3 AM daily | Database backup | /var/log/backup.log |
| 6 AM daily | Disk check | /var/log/disk-check.log |
| Sunday 4 AM | Docker prune | /var/log/docker-prune.log |

## NPM Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Lint check

# Testing
npm run test             # Watch mode
npm run test:run         # Single run

# Tax sync
npm run tax:sync         # Dry run all
npm run tax:sync:live    # Post to local app

# Dropbox
npm run dropbox:sync     # Incremental
npm run dropbox:sync:force  # Force regenerate summaries
```

## Migrations

Location: `scripts/migrations/`

**Applied migrations:**
- 002-006: Tax lookup system
- 007: Property visibility
- 008-011: Dropbox schema, insurance portfolio
- 012: Vendor contacts
- 013: BuildingLink flags
- 014-016: Berkley auto, data reconciliation
- 019-025: Unified pinning system
- 026-027: Payment suggestions, email links
- 028-033: Photo descriptions, vendor specialties, property taxes
- 034: Autopay performance indexes
- 035-037: Property access codes, trusted neighbors, renewals
- 038: Health monitoring state

**Running migrations:** Use `/migrate` skill for production.

---

## Feature Implementation Order

**Always follow this sequence:**

1. **Migration** - Create `scripts/migrations/XXX_description.sql`
2. **Types** - Update `src/types/database.ts` with new types
3. **Zod** - Add validation schemas in `src/lib/schemas/index.ts`
4. **Actions/Mutations** - Implement data layer in `actions.ts` or `mutations.ts`
5. **Build** - Run `/build` to catch TypeScript errors
6. **Test** - Run `/test` to verify logic
7. **Deploy** - Use `/deploy` skill for production

---

## Code Patterns

### SQL with Optional Foreign Keys

```sql
-- Use LEFT JOIN when FK can be NULL
SELECT b.*, p.name as property_name, v.name as vendor_name
FROM bills b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN vendors v ON b.vendor_id = v.id
WHERE b.due_date <= CURRENT_DATE + ($1::INTEGER)  -- Note the cast!
```

### Integer Casting for Date Arithmetic

```sql
-- WRONG: "operator is not unique" error
WHERE due_date <= CURRENT_DATE + $1

-- CORRECT: explicit cast
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)
```

### Enum Label Display

```typescript
// Always use label maps from database.ts
import { billTypeLabels } from '@/types/database'

<span>{billTypeLabels[bill.bill_type]}</span>  // "Property Tax" not "property_tax"
```

### Hydration-Safe Date Display

```typescript
'use client'
import { useState, useEffect } from 'react'

export function DateDisplay({ date }: { date: Date }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <span suppressHydrationWarning>{date.toISOString()}</span>
  return <span>{date.toLocaleDateString()}</span>
}
```

### UUID Generation

```sql
-- Use gen_random_uuid() (built-in), not uuid_generate_v4() (requires extension)
INSERT INTO properties (id, name) VALUES (gen_random_uuid(), 'Test')
```

---

## Architectural Patterns

### Server Components by Default

Only add `"use client"` when you need client-side interactivity. Server components can directly query the database via Server Actions.

### Server Actions for Mutations

- `src/lib/actions.ts` - Read operations (queries)
- `src/lib/mutations.ts` - Write operations (insert, update, delete)
- No API routes for CRUD operations (use Server Actions instead)

### Type Flow

```
PostgreSQL Schema (scripts/init.sql)
    ↓
TypeScript Types (src/types/database.ts)
    ↓
Zod Schemas (src/lib/schemas/index.ts)
    ↓
Server Actions (validation)
    ↓
UI Components
```

### When to Use What

- Queries → `actions.ts` → Server Components
- Mutations → `mutations.ts` → Form actions or client events
- Background jobs → `unified-worker.js` → Cron endpoints
- External scripts → Python with `uv run` → POST to callback API
