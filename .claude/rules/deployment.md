---
paths: scripts/fast-deploy.sh, docker-compose.prod.yml, .env.production, package.json
---

# Deployment Guide

**Use this file when:** Deploying to production, troubleshooting deployments, running pre-flight checks, or need emergency procedures.

---

## Pre-Flight Checks (MANDATORY)

**Run these commands BEFORE every deployment:**

```bash
# 1. Environment Variable Parity Check
echo "=== Checking for new environment variables ==="
comm -13 \
  <(ssh root@143.110.229.185 "grep -o '^[A-Z_]*=' /root/app/.env.production 2>/dev/null" | sort) \
  <(grep -o '^[A-Z_]*=' .env.local | sort)

# If output shows variables, add them to production:
# ssh root@143.110.229.185 "echo 'NEW_VAR=value' >> /root/app/.env.production"

# 2. Verify Build and Tests
docker compose exec app npm run test:run
docker compose exec app npm run build

# 3. Check for Uncommitted Changes
git status --porcelain  # Should be empty or only intended changes
```

---

## Deployment Process

### Automated Deployment (Preferred)

**Use the `/deploy` skill which automates:**

1. Pre-flight checks (tests, build, env parity)
2. Bump version (`npm version patch` or `minor`)
3. Commit all changes with descriptive message
4. Push to GitHub
5. Deploy via `./scripts/fast-deploy.sh`
6. Wait 30s for services to stabilize
7. Verify health endpoint
8. Check logs for errors
9. Test critical paths (login, cameras, etc.)
10. Monitor for 5 minutes

### Manual Deployment (Fallback)

**Only use if `/deploy` skill is unavailable:**

```bash
# From local machine
./scripts/fast-deploy.sh

# Wait for services
sleep 30

# Verify
curl -s https://spmsystem.com/api/health | jq
ssh root@143.110.229.185 "docker logs app-app-1 --tail 50"
```

---

## Post-Deployment Verification

```bash
# 1. Health endpoint
curl -s https://spmsystem.com/api/health | jq '.version, .checks'

# 2. Environment variables loaded
ssh root@143.110.229.185 \
  "docker exec app-app-1 printenv | grep -E 'NEST_|GOOGLE_|DROPBOX_'"

# 3. Application logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100 | grep -i error"

# 4. Worker logs
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 50"

# 5. Test critical functionality
# - Login: https://spmsystem.com
# - Cameras: https://spmsystem.com/cameras
# - Payments: https://spmsystem.com/payments
```

---

## Hotfix Pattern

**For critical production issues:**

1. Fix locally and verify with `/build` and `/test`
2. Run pre-flight checks (environment parity, tests, build)
3. Bump patch version: `npm version patch`
4. Commit with clear message: `git commit -m "Hotfix: <description>"`
5. Deploy immediately: `/deploy`
6. Verify fix in production
7. Monitor logs for 5 minutes

---

## Environment Variable Sync Protocol

**When adding new environment variables:**

1. Add to `.env.local` and test locally
2. **BEFORE deploying:** Add to production `.env.production` via SSH
3. Update CLAUDE.md documentation
4. Restart containers: `docker compose down && docker compose up -d`

**Verification command:**
```bash
# Find vars in dev but not in prod (should return empty)
comm -13 \
  <(ssh root@143.110.229.185 "grep -o '^[A-Z_]*=' /root/app/.env.production" | sort) \
  <(grep -o '^[A-Z_]*=' .env.local | sort)
```

---

## Emergency Procedures

### Production is Down

```bash
# 1. Check health
curl -s https://spmsystem.com/api/health

# 2. Check container status
ssh root@143.110.229.185 "docker ps -a"

# 3. Check logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"

# 4. Restart if needed
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml restart"

# 5. Verify recovery
curl -s https://spmsystem.com/api/health
```

### Need to Rollback

```bash
# 1. SSH to production
ssh root@143.110.229.185

# 2. View recent commits
cd /root/app && git log --oneline -10

# 3. Checkout previous version
git checkout <commit-hash>

# 4. Restart containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# 5. Verify
curl -s https://spmsystem.com/api/health
```

### Database Issues

```bash
# 1. Check database container
ssh root@143.110.229.185 "docker ps -a | grep db"

# 2. Check logs
ssh root@143.110.229.185 "docker logs app-db-1 --tail 100"

# 3. Connect to database
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"

# 4. Check disk space
ssh root@143.110.229.185 "df -h"

# 5. Verify latest backup
ssh root@143.110.229.185 "ls -lh /root/backups/*.sql | tail -5"
```

### Worker Issues

```bash
# 1. Check worker status
ssh root@143.110.229.185 "docker ps | grep worker"

# 2. Check worker logs
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 100"

# 3. Check health state table
# Use /prod-db skill
SELECT * FROM health_check_state ORDER BY last_checked_at DESC;

# 4. Restart worker
ssh root@143.110.229.185 "docker restart app-worker-1"

# 5. Monitor for 2 minutes
ssh root@143.110.229.185 "docker logs app-worker-1 -f"
```

---

## Production Server Details

| Item | Value |
|------|-------|
| Domain | spmsystem.com |
| IP | 143.110.229.185 |
| SSH | `ssh root@143.110.229.185` |
| App Directory | /root/app |

**Containers:**
- `app-app-1` - Next.js web application
- `app-db-1` - PostgreSQL database
- `app-worker-1` - Unified background worker

---

## Deployment Troubleshooting

### Deployment Fails at Build Step

```bash
# Check for TypeScript errors
docker compose exec app npm run build

# Check for syntax errors
npm run lint

# Verify dependencies
npm ci
```

### Deployment Succeeds but App Won't Start

```bash
# Check app logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 200"

# Common issues:
# - Missing environment variables
# - Database connection failure
# - Port already in use
# - Out of memory
```

### Environment Variables Not Loading

```bash
# Verify file exists
ssh root@143.110.229.185 "ls -la /root/app/.env.production"

# Check file contents (don't share secrets!)
ssh root@143.110.229.185 "cat /root/app/.env.production | grep -v SECRET | grep -v TOKEN"

# Verify container can read it
ssh root@143.110.229.185 "docker exec app-app-1 printenv | grep DATABASE_URL"

# Full restart if needed
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d"
```

### Deployment Slow or Hangs

```bash
# Check disk space
ssh root@143.110.229.185 "df -h"

# Check memory usage
ssh root@143.110.229.185 "free -h"

# Check running processes
ssh root@143.110.229.185 "top -bn1 | head -20"

# If low on space, clean Docker
ssh root@143.110.229.185 "docker system prune -a -f"
```
