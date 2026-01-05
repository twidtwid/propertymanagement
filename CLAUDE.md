# Property Management System

Personal property management: 10 properties (VT, NYC, RI, CA, Paris, Martinique), 7 vehicles, 70+ vendors.

## Critical Rules

1. **DEPLOY via `/deploy` only** - Never run docker/ssh commands manually
2. **Cast integers in date arithmetic** - `CURRENT_DATE + ($1::INTEGER)` not `+ $1`
3. **Sync enums** - Update both PostgreSQL (`scripts/init.sql` or migration) AND Zod (`src/lib/schemas/index.ts`)

## Tech Stack

```
Next.js 14 (App Router) | TypeScript | Tailwind + shadcn/ui | PostgreSQL
Production: spmsystem.com (143.110.229.185)
```

## File Map

| Category | Path | Purpose |
|----------|------|---------|
| Schema | `scripts/init.sql` | Database schema |
| Types | `src/types/database.ts` | TypeScript types + enum labels |
| Validation | `src/lib/schemas/index.ts` | Zod schemas |
| Data reads | `src/lib/actions.ts` | Server actions (queries) |
| Data writes | `src/lib/mutations.ts` | Server actions (mutations) |
| Migrations | `scripts/migrations/` | Numbered SQL files |
| Integrations | `src/lib/{dropbox,gmail,taxes}/` | External service clients |

## Skills (Commands)

| Skill | Action |
|-------|--------|
| `/deploy` | Full deploy: test → version bump → commit → push → deploy |
| `/test` | Run vitest |
| `/build` | TypeScript check |
| `/health` | Production health |
| `/migrate` | Run SQL migration on production |
| `/backup` | Download production DB |
| `/prod-logs` | View production logs |
| `/prod-db` | Production psql shell |

## Production Cron Jobs

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| */15 * | `/api/cron/dropbox-sync` | Sync Dropbox files |
| 0 * | `/api/cron/refresh-dropbox-token` | Keep OAuth token fresh |
| 0 3 | `run-backup.sh` | Database backup |
| 0 4 | docker prune | Clean images |
| 0 6 | `disk-check.sh` | Disk space alert |

## Key Enums

```typescript
// Vendor specialties (36 values) - see src/types/database.ts
hvac, plumbing, electrical, roofing, general_contractor, landscaping,
cleaning, pest_control, pool_spa, appliance, locksmith, alarm_security,
snow_removal, fuel_oil, property_management, architect, movers, trash,
internet, phone, water, septic, forester, fireplace, insurance, auto,
elevator, flooring, parking, masonry, audiovisual, shoveling, plowing,
mowing, attorney, window_washing, other

// Payment status flow
pending → sent → confirmed | overdue | cancelled

// Ticket status
pending | in_progress | completed | cancelled
```

## Common Patterns

**Server Components default** - `"use client"` only when needed

**Server Actions for data** - No API routes for CRUD

**LEFT JOIN for optional relations:**
```sql
SELECT b.*, p.name FROM bills b LEFT JOIN properties p ON b.property_id = p.id
```

**Feature implementation order:**
1. Migration → 2. Types → 3. Zod → 4. Actions → 5. `/build` → 6. `/test` → 7. `/deploy`

## Common Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Date arithmetic error | Missing cast | `$1::INTEGER` |
| Zod validation error | Enum mismatch | Sync PG enum with Zod |
| Hydration error (dates) | SSR/client TZ diff | `mounted` state + `suppressHydrationWarning` |
| Email CSS bleeding | Raw HTML injection | `sanitizeEmailHtml()` |
| Dropbox "wrong folder" | Missing namespace_id | Set `namespace_id = '13490620643'` in `dropbox_oauth_tokens` |
| UUID error | Wrong function | `gen_random_uuid()` not `uuid_generate_v4()` |

## Users & Auth

| User | Role | Access |
|------|------|--------|
| Anne, Todd, Michael, Amelia | owner | Full |
| Barbara Brady (CBIZ) | bookkeeper | `/`, `/payments/**`, `/settings` only |

## Business Logic

- **Check confirmation:** Alert if unconfirmed >14 days (Bank of America unreliable)
- **Smart pins:** Auto-pin bills due <7 days, overdue items, high-priority tickets
- **Property visibility:** Whitelist in `property_visibility` table (default: all owners see all)
- **Dropbox shared folder:** namespace_id `13490620643` for "Property Management" folder

## Modular Rules

Loaded contextually from `.claude/rules/`:

| File | Topics |
|------|--------|
| `database.md` | Schema, enums, relationships, indexes |
| `payments.md` | Payment workflows, tax schedules, confirmations |
| `security.md` | Authorization, route guards, OAuth tokens |
| `integrations.md` | Dropbox, Gmail, tax lookup providers |
| `pinning.md` | Smart pins, user pins, sync triggers |
| `development.md` | Docker, dev server, production SSH |
