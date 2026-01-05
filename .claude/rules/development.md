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
| app-daily-summary-1 | Daily summary email scheduler |
| app-email-sync-1 | Gmail sync service |

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

**Running migrations:** Use `/migrate` skill for production.
