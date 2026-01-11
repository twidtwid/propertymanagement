# Operations Review Baseline

**Date:** 2026-01-11
**Git Tag:** `ops-review-baseline-20260111`
**Version:** 0.8.17

## Purpose

This document captures the system state before implementing operations improvements from the comprehensive review. Use this as a reference point for measuring progress and for rollback if needed.

## Backups Created

```
~/backups/propertymanagement-baseline-20260111.sql.gz          (39MB)
~/backups/propertymanagement-baseline-20260111.tar             (53MB Docker image)
.claude/rules.backup-20260111/                                 (Claude rules)
```

## Pre-Review Metrics

### Codebase Size
- **Total Lines of Code:** ~50,000
- **Largest Files:**
  - `src/lib/actions.ts`: 4,895 lines (108 functions)
  - `src/lib/mutations.ts`: 2,504 lines (58 functions)
  - `scripts/init.sql`: 2,289 lines
  - `src/components/insurance/insurance-with-pins.tsx`: 699 lines
  - `src/components/payments/bank-import-dialog.tsx`: 457 lines

### Testing
- **Test Files:** 1 (`src/lib/session.test.ts`)
- **Test Coverage:** ~5%
- **Integration Tests:** 0
- **E2E Tests:** 0

### Deployment
- **Method:** Manual via `scripts/fast-deploy.sh`
- **Average Time:** ~2 minutes
- **CI/CD:** None
- **Deployment History:** Not tracked
- **Rollback Method:** Manual SSH + git revert

### Operations
- **Docker Containers:** 5 running
  - app-app-1 (Next.js)
  - app-db-1 (PostgreSQL)
  - app-daily-summary-1 (worker)
  - app-email-sync-1 (worker)
  - app-dropbox-sync-1 (worker)
- **Health Check:** ✓ Endpoint exists at `/api/health`
- **Monitoring:** None
- **Alerting:** Weather alerts only (via Pushover)
- **Logging:** Docker json-file driver (lost on restart)
- **Backup Verification:** Never tested

### Cron Jobs
- **Production:** 6 jobs running
  - Dropbox sync (*/15 min)
  - Weather sync (*/30 min)
  - Token refresh (hourly)
  - Database backup (3 AM)
  - Disk check (6 AM)
  - Docker prune (Sun 4 AM)
- **Local:** 0 jobs

### Code Quality
- **Linting:** ✓ ESLint configured
- **Type Checking:** ✓ TypeScript strict mode
- **Pre-commit Hooks:** None
- **Enum Synchronization:** Manual (3 places: PostgreSQL, TypeScript, Zod)
- **Duplicate Code:** ~110 instances of `emptyToNull()` pattern

### Dependencies
- **Node Packages:** 48 production, 13 dev
- **Python Packages:** 4 (via uv: anthropic, playwright, pymupdf, psycopg2-binary)
- **Last Security Audit:** Unknown
- **Outdated Packages:** Not documented

### Database
- **Size:** 39MB (compressed backup)
- **Tables:** 42
- **Migrations Applied:** 38 (through migration 038)
- **Backup Frequency:** Daily (3 AM production)
- **Backup Retention:** 7 days
- **Restore Testing:** Never performed

### Performance Baseline
- **App Response Time:** Not measured
- **Database Query Performance:** Not tracked
- **Docker Image Size:** 53MB (latest)
- **Build Time:** ~90 seconds (when cached)

### Environment
- **Production:** spmsystem.com (143.110.229.185)
- **Local Dev:** Docker Compose on macOS
- **Python Environment:** uv with .venv (newly configured)
- **Node Version:** 20.x
- **PostgreSQL Version:** 16.x

## Issues Identified

### High Priority
1. No CI/CD pipeline (manual deployment)
2. Minimal test coverage (5%)
3. No monitoring or alerting for background jobs
4. Backup restoration never tested
5. No environment variable validation

### Medium Priority
1. Monolithic files (actions.ts, mutations.ts)
2. Large form components (400-700 lines)
3. No pre-commit hooks
4. Duplicate code patterns
5. Logging not centralized

### Low Priority
1. Type safety gaps (some `any` usage)
2. No operational runbooks
3. Manual enum synchronization
4. Unused exports not tracked

## Operations Plan

See `.claude/plans/sharded-strolling-bubble.md` for full implementation plan.

**Quick Wins (Week 1):**
1. ✅ Create backup (completed)
2. Add CI for PRs
3. Add environment variable validation
4. Set up external monitoring (UptimeRobot)
5. Run `npx ts-prune` and remove unused exports
6. Add pre-commit hooks

**Timeline:** 23 days across 6 phases

**Target Metrics:**
- Test coverage: 40-60%
- Deployment: Automated CI/CD, <3 min
- Monitoring: Health checks + external monitor
- Largest file: <800 lines
- Mean time to recovery: <15 min

## Rollback Instructions

If operations improvements cause issues:

1. **Restore code:**
   ```bash
   git checkout ops-review-baseline-20260111
   git push --force origin main  # Use with extreme caution
   ```

2. **Restore database:**
   ```bash
   docker compose stop app email-sync daily-summary dropbox-sync
   gunzip -c ~/backups/propertymanagement-baseline-20260111.sql.gz | \
     docker compose exec -T db psql -U postgres -d propertymanagement
   docker compose up -d
   ```

3. **Restore Docker image:**
   ```bash
   docker load -i ~/backups/propertymanagement-baseline-20260111.tar
   docker compose up -d
   ```

4. **Restore Claude rules:**
   ```bash
   rm -rf .claude/rules
   cp -r .claude/rules.backup-20260111 .claude/rules
   ```

## Notes

- This baseline was created after successful deployment of v0.8.17 (vendor form consolidation)
- Python environment was recently migrated to uv (all scripts use `uv run python`)
- All production systems healthy at time of baseline
- No active incidents or known bugs
