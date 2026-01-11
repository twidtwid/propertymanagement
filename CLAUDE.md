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

## Python Scripts

**IMPORTANT:** Use `uv run` for all Python scripts, never use system Python.

Python environment managed by uv (see `pyproject.toml`):
- anthropic (Claude API)
- playwright (browser automation)
- pymupdf (PDF processing)
- psycopg2-binary (PostgreSQL)

```bash
# Run any Python script with uv
uv run python scripts/sync_all_taxes.py
uv run python scripts/analyze-vendors-ai.py

# Sync dependencies if pyproject.toml changes
uv sync

# Install playwright browsers (one-time)
uv run playwright install chromium
```

**Never use:** `python3 scripts/...` or `./scripts/...` directly — always prefix with `uv run python`.

## Code Patterns

**Server Components by default** — Only add `"use client"` when needed

**Server Actions for data** — No API routes for CRUD operations

**LEFT JOIN for optional FKs:**
```sql
SELECT b.*, p.name FROM bills b LEFT JOIN properties p ON b.property_id = p.id
```

**Feature implementation order:**
1. Migration → 2. Types → 3. Zod → 4. Actions/Mutations → 5. `/build` → 6. `/test` → 7. `/deploy`

## Operational Best Practices

### Worker Patterns

**Unified worker consolidation:**
- Combine multiple cron-style workers into single service with loop-based scheduling
- Use JSON state file for persistence (`.worker-state.json`)
- Update `health_check_state` table after each task run
- Implement graceful shutdown (SIGTERM/SIGINT handlers)

**Environment variables:**
- Always set `APP_HOST=app` explicitly in production (never rely on localhost default)
- Set `APP_PORT=3000` explicitly
- Use `TZ=America/New_York` for consistent timezone handling

**Health monitoring:**
```typescript
await pool.query(`
  INSERT INTO health_check_state (check_name, status, last_checked_at)
  VALUES ($1, $2, NOW())
  ON CONFLICT (check_name) DO UPDATE SET status = $2, last_checked_at = NOW()
`, [taskName, 'ok']);
```

### Deployment Patterns

**Post-deploy verification:**
```bash
# 1. Deploy
./scripts/fast-deploy.sh

# 2. Wait for services to stabilize (30s minimum)
sleep 30

# 3. Verify health endpoint
curl -s https://spmsystem.com/api/health | jq '.checks.workers'

# 4. Check worker logs if issues
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 50"
```

**Hotfix pattern:**
1. Fix critical issue locally
2. Bump patch version (`npm version patch`)
3. Commit with descriptive message
4. Deploy immediately (`./scripts/fast-deploy.sh`)
5. Verify fix in production

### Resource Management

**Container memory limits:**
```yaml
deploy:
  resources:
    limits:
      memory: 384M    # Hard limit
    reservations:
      memory: 256M    # Guaranteed allocation
```

**State file patterns:**
- Store in `/app/scripts/.state-file.json` (persists across restarts)
- Track last run timestamps, not intervals
- Use `loadState()` / `saveState()` functions
- Handle missing/corrupt files gracefully

### Backup Verification

**Weekly automated testing:**
- Restore latest backup to test database
- Verify row counts match production
- Alert on failure via Pushover
- Clean up test database automatically
- Runs Sundays at 4 AM

### Cron Job Best Practices

**Structure:**
```bash
# Format: SCHEDULE SCRIPT >> LOG_FILE 2>&1
0 4 * * 0 /root/app/scripts/verify-backup.sh >> /var/log/verify-backup.log 2>&1
```

**Patterns:**
- Use full paths (`/root/app/scripts/...`)
- Redirect stdout AND stderr to logs (`>> /var/log/...log 2>&1`)
- Include authentication headers for API endpoints
- Log rotation handled by Docker (`max-size: 10m`, `max-file: 3`)

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

| Schedule | Job | Purpose | Log File |
|----------|-----|---------|----------|
| */15 min | dropbox-sync | Sync Dropbox files | /var/log/dropbox-sync.log |
| */30 min | weather-sync | Check severe weather alerts | /var/log/weather-sync.log |
| */15 min | health-check | Pushover alerts on failures | /var/log/health-check.log |
| */5 min | analyze-autopays | Check payment confirmations | /var/log/autopay-analysis.log |
| Hourly | refresh-dropbox-token | Keep OAuth fresh | /var/log/dropbox-refresh.log |
| 3 AM daily | run-backup.sh | Database backup | /var/log/backup.log |
| **4 AM Sundays** | **verify-backup.sh** | **Test backup restoration** | **/var/log/verify-backup.log** |
| 4 AM daily | docker prune | Clean old images/containers | /var/log/docker-prune.log |
| 6 AM daily | disk-check.sh | Alert if >80% full | /var/log/disk-check.log |

**Background workers (container: app-worker-1):**
- Email sync: Every 10 minutes
- Smart pins sync: Every 60 minutes
- Daily summary: 6:00 PM NYC time
