# Property Management System

Personal property management application managing 10 properties, 7 vehicles, and 70+ vendors across Vermont, NYC, Rhode Island, California, Paris, and Martinique.

**Production:** https://spmsystem.com (143.110.229.185)
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL

---

## CRITICAL RULES

**These rules MUST be followed in every session:**

1. **Environment Variable Parity** — Before every deploy, verify new vars in `.env.local` exist in production `.env.production`
2. **Use `/deploy` Skill Only** — Never run docker/ssh/git push commands manually for production deployments
3. **Cast SQL Date Arithmetic** — Always use `CURRENT_DATE + ($1::INTEGER)` not `+ $1` (prevents operator errors)
4. **Sync Enums Everywhere** — Update PostgreSQL (`scripts/init.sql`) AND Zod (`src/lib/schemas/index.ts`) simultaneously
5. **Build Before Deploy** — Run `/build` skill before `/deploy` to catch TypeScript errors early
6. **Use gen_random_uuid()** — PostgreSQL built-in, not `uuid_generate_v4()` (no extension required)
7. **⚠️ TOKEN_ENCRYPTION_KEY Immutability** — The TOKEN_ENCRYPTION_KEY must NEVER change once set
   - All encrypted tokens (Gmail, Dropbox, Nest) become permanently unreadable if key changes
   - The key is 64 hex characters (32 bytes) and must be identical in local and production
   - Fast-deploy.sh now validates key parity before every deployment (blocks deploy if mismatch)
   - App startup validates key format and encryption/decryption functionality (fails fast if broken)
   - **NEVER** modify TOKEN_ENCRYPTION_KEY in production without backing up all encrypted tokens first

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `/deploy` | Full deployment pipeline (use for production) |
| `/build` | TypeScript type check (use before committing) |
| `/test` | Run vitest suite |
| `/health` | Check production status |
| `/migrate <file>` | Run production migration |
| `/backup` | Download production DB |
| `/prod-logs` | Tail production logs |
| `/prod-db` | Interactive psql shell |

### Key File Locations

| What | Where |
|------|-------|
| Schema | `scripts/init.sql` |
| Types | `src/types/database.ts` |
| Zod | `src/lib/schemas/index.ts` |
| Queries | `src/lib/actions.ts` |
| Mutations | `src/lib/mutations.ts` |
| Migrations | `scripts/migrations/*.sql` |
| Workers | `scripts/unified-worker.js` |
| Python | Use `uv run python scripts/*.py` |

### Quick Verification

```bash
# After code changes
docker compose exec app npm run test:run && docker compose exec app npm run build

# After deployment
curl -s https://spmsystem.com/api/health | jq .version

# Environment parity
comm -13 <(ssh root@143.110.229.185 "grep -o '^[A-Z_]*=' /root/app/.env.production" | sort) <(grep -o '^[A-Z_]*=' .env.local | sort)
```

---

## Environment Variables

**CRITICAL:** All variables MUST exist in BOTH `.env.local` and `.env.production`.

**Core Application:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Session encryption
- `CRON_SECRET` - Cron job authentication
- `TOKEN_ENCRYPTION_KEY` - OAuth token encryption (32-byte hex)

**Google OAuth (Gmail + Nest):**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `NEST_PROJECT_ID` - Device Access Console project

**Dropbox:**
- `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI`

**External Services:**
- `PUSHOVER_TOKEN`, `PUSHOVER_USER` - Notifications
- `PLAYWRIGHT_BROWSERS_PATH` - Browser path (`.playwright`)

**Sync Protocol:** Add to `.env.local` → Test → Add to prod `.env.production` → Deploy

---

## System Architecture

### Container Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js App (app-app-1)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ App Router Pages → Server Components (default)       │   │
│  │              ↓                                        │   │
│  │ Server Actions (actions.ts, mutations.ts)            │   │
│  │              ↓                                        │   │
│  │ PostgreSQL via node-postgres                         │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴───────────┐
          ▼                      ▼
┌──────────────────┐    ┌────────────────────┐
│   PostgreSQL     │    │  Unified Worker    │
│   (app-db-1)     │    │  (app-worker-1)    │
│                  │    │                    │
│  • Schema        │    │  60s loop:         │
│  • Data          │    │  • Email sync      │
│  • Indexes       │    │  • Smart pins      │
└──────────────────┘    │  • Camera sync     │
                        │  • Daily summary   │
                        └────────────────────┘
```

### Type Flow

```
PostgreSQL (init.sql) → TypeScript (database.ts) → Zod (schemas) → Server Actions → UI
```

### Data Flow Examples

**Adding a Bill:**
```
UI Form → validateBillInput (Zod) → createBill (mutations.ts) → INSERT → syncSmartPinsBills() → Revalidate
```

**Tax Sync:**
```
Python scraper → POST /api/taxes/sync/callback → Validate → INSERT → Update sync log
```

**Email Match:**
```
Worker → POST /api/cron/sync-emails → Fetch Gmail → Match domain/email → INSERT vendor_communications
```

---

## Development Workflow

**Local dev:**
```bash
docker compose up -d              # Start containers
docker compose logs app -f        # Follow logs
```

**When to restart:**
- Hot reload fails → Use `/deploydev` skill
- After `git pull` with schema changes → Restart containers
- After environment variable changes → Full restart required

**Feature implementation sequence:**
1. Migration → 2. Types → 3. Zod → 4. Actions/Mutations → 5. `/build` → 6. `/test` → 7. `/deploy`

---

## Modular Documentation

**Use these context files for specific tasks:**

| File | Use When |
|------|----------|
| `.claude/rules/database.md` | Schema, enums, query patterns, indexes |
| `.claude/rules/security.md` | Auth, OAuth, role-based access control |
| `.claude/rules/payments.md` | Bills, taxes, payment workflows |
| `.claude/rules/integrations.md` | Dropbox, Gmail, tax lookup systems |
| `.claude/rules/pinning.md` | Smart pins and user pins logic |
| `.claude/rules/development.md` | Docker, workers, Python, migrations, code patterns |
| `.claude/rules/deployment.md` | Pre-flight checks, deploy process, emergency procedures |
| `.claude/rules/troubleshooting.md` | Common issues, decision trees, debugging |
| `.claude/rules/cameras.md` | Nest camera integrations, token management |

**How to use:**
- Before making changes, read the relevant modular file
- For deployment → Read `deployment.md`
- For production issues → Read `troubleshooting.md`
- For database work → Read `database.md`
- For camera features → Read `cameras.md`

---

## Users and Access

| User | Role | Access |
|------|------|--------|
| Anne, Todd, Michael, Amelia | `owner` | Full access |
| Barbara Brady (CBIZ) | `bookkeeper` | `/`, `/payments/**`, `/settings` only |

**Restrictions enforced in:** `src/middleware.ts`, Server Actions, UI components

---

## Key Business Rules

**Check Confirmation Alert:**
- Bank of America has reliability issues
- Alert if check marked "sent" but unconfirmed >14 days
- Default `days_to_confirm = 14` in bills table

**Smart Pins (Auto-pinned):**
- Bills due within 7 days
- Overdue bills (past due_date, status = pending)
- Unconfirmed checks >14 days
- Urgent/high priority maintenance tickets

**Weather Alerts:**
- NWS (US) + Météo-France (Paris/Martinique)
- Pushover notifications to Anne & Todd
- Synced every 30 minutes

**Dropbox Shared Folder:**
- Family shared folder namespace: `13490620643`
- Must be set in `dropbox_oauth_tokens.namespace_id`

**Camera Integrations:**
- Modern Nest: OAuth with automatic token refresh
- Nest Legacy: Manual token refresh (~30 days), automated monitoring with Pushover alerts

---

## Production Monitoring

**Application Cron Jobs:**

| Schedule | Job | Log |
|----------|-----|-----|
| */15 min | Dropbox sync | /var/log/dropbox-sync.log |
| */30 min | Weather alerts | /var/log/weather-sync.log |
| */15 min | Health check | /var/log/health-check.log |
| Hourly | Dropbox token refresh | /var/log/dropbox-refresh.log |
| 3 AM daily | Database backup | /var/log/backup.log |
| 4 AM Sundays | Verify backup | /var/log/verify-backup.log |
| 4 AM daily | Docker prune | /var/log/docker-prune.log |
| 6 AM daily | Disk check | /var/log/disk-check.log |

**Background Workers (unified-worker.js):**

| Task | Interval | Purpose |
|------|----------|---------|
| Email sync | 10 minutes | Gmail → vendor_communications |
| Smart pins | 60 minutes | Auto-pin urgent items |
| Camera snapshots | 5 minutes | Nest camera updates |
| Nest token check | Daily 3 AM | Monitor token expiration |
| Daily summary | 6 PM NYC | Email summary to family |

---

## Claude Model Selection

**Current Policy: Haiku 4.5 Only**

All Claude API calls use `claude-haiku-4-5-20251001` for cost optimization:

```typescript
'claude-haiku-4-5-20251001'     // Used everywhere (summaries, email analysis, vendor matching, etc.)
```

If you need higher-quality models for specific use cases, consider:
```typescript
'claude-sonnet-4-5-20250929'    // Balanced (complex analysis)
'claude-opus-4-5-20251101'      // Best (difficult PDFs)
```

---

## Additional Resources

**For detailed guidance, read modular documentation in `.claude/rules/`**

**External References:**
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Next.js App Router Docs](https://nextjs.org/docs/app)

**Need help?** Use `/health`, `/prod-logs`, `/prod-db` skills or check modular rules for detailed context.
