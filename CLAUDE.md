# Property Management System

Personal property management app: 10 properties, 7 vehicles, 70+ vendors across VT, NYC, RI, CA, Paris, Martinique.

## CRITICAL RULES

**MUST follow these in every session:**

1. **Deploy via `/deploy` ONLY** — Never run docker/ssh/git push manually
2. **Cast integers in SQL date arithmetic** — `CURRENT_DATE + ($1::INTEGER)` not `+ $1`
3. **Sync enums in both places** — PostgreSQL (`scripts/init.sql`) AND Zod (`src/lib/schemas/index.ts`)
4. **Run `/build` before `/deploy`** — Catches TypeScript errors early
5. **Use gen_random_uuid()** — Not `uuid_generate_v4()` (no extension needed)

## Tech Stack

```
Next.js 14 (App Router) | TypeScript | Tailwind + shadcn/ui | PostgreSQL
Production: spmsystem.com (143.110.229.185)
```

## File Map

| What | Where |
|------|-------|
| **Schema** | `scripts/init.sql` |
| **Types** | `src/types/database.ts` (includes enum label maps) |
| **Zod** | `src/lib/schemas/index.ts` |
| **Queries** | `src/lib/actions.ts` |
| **Mutations** | `src/lib/mutations.ts` |
| **Migrations** | `scripts/migrations/*.sql` |
| **Weather** | `src/lib/weather/` (NWS, Météo-France, wttr.in) |
| **Integrations** | `src/lib/{dropbox,gmail,taxes}/` |

## Commands

| Command | Purpose |
|---------|---------|
| `/deploy` | Test → bump version → commit → push → deploy to prod |
| `/test` | Run vitest |
| `/build` | TypeScript check |
| `/health` | Check production status |
| `/migrate XXX.sql` | Run migration on production |
| `/backup` | Download production database |
| `/prod-logs` | Tail production logs |
| `/prod-db` | Interactive psql shell |

## Verification

```bash
# After code changes
docker compose exec app npm run test:run  # Tests pass?
docker compose exec app npm run build     # Types check?

# After deploy
curl -s https://spmsystem.com/api/health | jq .version
```

## Code Patterns

**Server Components by default** — Only add `"use client"` when needed

**Server Actions for data** — No API routes for CRUD operations

**LEFT JOIN for optional FKs:**
```sql
SELECT b.*, p.name FROM bills b LEFT JOIN properties p ON b.property_id = p.id
```

**Feature implementation order:**
1. Migration → 2. Types → 3. Zod → 4. Actions/Mutations → 5. `/build` → 6. `/test` → 7. `/deploy`

## Common Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Date arithmetic error | Missing cast | Use `$1::INTEGER` |
| Zod validation fails | Enum mismatch | Sync PostgreSQL enum with Zod |
| Hydration error (dates) | TZ diff SSR/client | Use `mounted` state + `suppressHydrationWarning` |
| Dropbox wrong folder | Missing namespace_id | Set `namespace_id = '13490620643'` in `dropbox_oauth_tokens` |

## Users & Access

| Users | Role | Access |
|-------|------|--------|
| Anne, Todd, Michael, Amelia | owner | Full access |
| Barbara Brady (CBIZ) | bookkeeper | `/`, `/payments/**`, `/settings` only |

## Key Business Logic

- **Check confirmation:** Alert if Bank of America check unconfirmed >14 days
- **Smart pins:** Auto-pin bills due <7 days, overdue items, urgent tickets
- **Weather alerts:** NWS (US) + Météo-France (Paris/Martinique) → Pushover to Anne & Todd
- **Dropbox:** Shared folder namespace_id `13490620643`

## Claude Model IDs

When using Claude API in this codebase:
- Fast/cheap: `claude-haiku-4-5-20251001`
- Balanced: `claude-sonnet-4-5-20250929`
- Best: `claude-opus-4-5-20251101`

## Modular Rules

Context-specific rules auto-loaded from `.claude/rules/`:

| File | When Loaded |
|------|-------------|
| `database.md` | Schema, enum, SQL work |
| `payments.md` | Bills, taxes, payment workflows |
| `security.md` | Auth, OAuth, route guards |
| `integrations.md` | Dropbox, Gmail, tax sync |
| `pinning.md` | Smart pins, user pins |
| `development.md` | Docker, dev server, prod SSH |

---

## Production Cron Jobs

| Schedule | Job | Purpose |
|----------|-----|---------|
| */15 | dropbox-sync | Sync Dropbox files |
| */30 | weather-sync | Check severe weather alerts |
| hourly | refresh-dropbox-token | Keep OAuth fresh |
| 3 AM | run-backup.sh | Database backup |
| 4 AM | docker prune | Clean old images |
