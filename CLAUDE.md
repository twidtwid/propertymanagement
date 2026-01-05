# Property Management System

Personal property management app: 10 properties (VT, NYC, RI, CA, Paris, Martinique), 7 vehicles, 70+ vendors.

## Critical Rules

**DEPLOYMENT: Use `/deploy` skill ONLY.** Never run docker/ssh deployment commands manually.

**DATABASE: Cast integers in date arithmetic.**
```sql
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)  -- correct
WHERE due_date <= CURRENT_DATE + $1              -- fails
```

**ENUMS: Update BOTH PostgreSQL AND Zod** when adding enum values.
- PostgreSQL: `scripts/init.sql` or migration
- Zod: `src/lib/schemas/index.ts`

## Stack

Next.js 14 (App Router) | TypeScript | Tailwind + shadcn/ui | PostgreSQL

Production: spmsystem.com (143.110.229.185)

## Key Files

| Purpose | Path |
|---------|------|
| Schema | `scripts/init.sql` |
| Types | `src/types/database.ts` |
| Zod schemas | `src/lib/schemas/index.ts` |
| Server reads | `src/lib/actions.ts` |
| Server writes | `src/lib/mutations.ts` |
| Utilities | `src/lib/utils.ts` |

## Skills

| Skill | Purpose |
|-------|---------|
| `/deploy` | Deploy to production (tests, version bump, commit, push, deploy) |
| `/test` | Run test suite |
| `/build` | TypeScript/build check |
| `/health` | Production health check |
| `/schema` | Database schema reference |
| `/deploydev` | Restart dev with clean caches |
| `/backup` | Backup production database |
| `/prod-logs` | View production logs |
| `/prod-db` | Production database shell |
| `/migrate` | Run production migration |

## Common Gotchas

| Problem | Fix |
|---------|-----|
| Date arithmetic fails | Cast: `$1::INTEGER` |
| Zod validation errors | Enum mismatch between PG and Zod |
| Hydration errors (dates) | Use `mounted` state pattern with `suppressHydrationWarning` |
| Email styles bleed | Use `sanitizeEmailHtml()` before `dangerouslySetInnerHTML` |
| Empty Dropbox folders | Check `namespace_id` in `dropbox_oauth_tokens` |
| UUID generation | Use `gen_random_uuid()` not `uuid_generate_v4()` |

## Patterns

**Server Components by default.** Use `"use client"` only when needed.

**Server Actions for mutations.** No API routes for data operations.

**Optional relations need LEFT JOIN:**
```sql
SELECT b.*, p.name FROM bills b LEFT JOIN properties p ON b.property_id = p.id
```

**Feature workflow:**
1. Migration in `scripts/migrations/`
2. Types in `src/types/database.ts`
3. Zod in `src/lib/schemas/index.ts`
4. Actions in `actions.ts` (reads) or `mutations.ts` (writes)
5. `/build` then `/test` then `/deploy`

## Users

| User | Role |
|------|------|
| Anne, Todd, Michael, Amelia | owner (full access) |
| Barbara Brady (CBIZ) | bookkeeper (bills/payments only) |

Bookkeeper restricted to: `/`, `/payments/**`, `/settings` via middleware.

## Business Rules

- **Payment flow:** pending → sent → confirmed (or overdue/cancelled)
- **Check confirmation:** Flag unconfirmed checks >14 days (Bank of America unreliable)
- **Smart pins:** Auto-generated for urgent items (bills due <7 days, overdue, high-priority tickets)
- **Property visibility:** `property_visibility` table whitelists users (default: all owners see all)

## Detailed Rules

Loaded on-demand when working in relevant paths:

- `.claude/rules/database.md` - Schema, enums, relationships, query patterns
- `.claude/rules/payments.md` - Payment workflows, tax schedules, confirmation logic
- `.claude/rules/security.md` - Authorization, route restrictions, OAuth
- `.claude/rules/integrations.md` - Dropbox, Gmail, tax lookup systems
- `.claude/rules/pinning.md` - Smart pins vs user pins, sync triggers
- `.claude/rules/development.md` - Docker, dev server, production commands
