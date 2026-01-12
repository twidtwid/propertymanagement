---
description: Deploy local changes to production. Run tests, bump version, commit, and deploy to spmsystem.com.
---

Deploy local changes to production. This is the ONE AND ONLY way to deploy.

## Production Environment
- **Server:** root@143.110.229.185
- **Domain:** spmsystem.com
- **App Dir:** /root/app
- **Database:** propertymanagement (user: propman)

## Arguments
- `--minor` - Bump minor version (0.6.0 → 0.7.0) instead of patch (0.6.0 → 0.6.1)
- `--skip-tests` - Skip running tests (use sparingly)

## What This Command Does

**IMPORTANT:** Follow these steps IN ORDER. Do not skip steps.

### Step 0: PRE-FLIGHT CHECKS (CRITICAL!)
Run automated pre-deployment checks:
```bash
./scripts/pre-deploy-check.sh
```

This script verifies:
1. ✅ Environment variable parity (dev vs prod)
2. ✅ No uncommitted changes
3. ✅ Build succeeds
4. ✅ Tests pass
5. ✅ Critical env vars present in production
6. ✅ Production health status

**If pre-flight checks FAIL:**
- ❌ DO NOT proceed with deployment
- Fix all errors reported by the script
- Re-run pre-flight checks until they pass

**If pre-flight checks show new environment variables:**
1. Review what each new variable does
2. Add them to production `.env.production`:
   ```bash
   ssh root@143.110.229.185 "echo 'NEW_VAR=value' >> /root/app/.env.production"
   ```
3. Verify they're added:
   ```bash
   ssh root@143.110.229.185 "grep NEW_VAR /root/app/.env.production"
   ```
4. Re-run pre-flight checks to confirm

### Step 1: Run Tests
```bash
docker compose exec app npm run test:run
```
If tests fail, STOP and fix them before deploying.

**Note:** If you ran Step 0 pre-flight checks, tests were already run. You can skip this step.

### Step 2: Check Git Status
```bash
git status
git log --oneline -3
```
Note what files are changed for the commit message.

### Step 3: Bump Version
For patch release (default):
```bash
npm version patch --no-git-tag-version
```
For minor release (if --minor flag):
```bash
npm version minor --no-git-tag-version
```

### Step 4: Commit All Changes
Stage everything and commit with a descriptive message:
```bash
git add -A
git commit -m "$(cat <<'EOF'
<Short description of changes> (vX.X.X)

<Bullet points of what changed>

[Generated with Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 5: Push to GitHub
```bash
git push origin main
```

### Step 6: Deploy Using fast-deploy.sh
```bash
./scripts/fast-deploy.sh
```
This script:
- Builds Docker images locally (fast!)
- Pushes to GitHub Container Registry
- SSHs to production and pulls new images
- Runs health check

### Step 7: Verify Deployment
The fast-deploy.sh script includes a health check, but perform additional verification:

```bash
# 1. Wait for services to stabilize
sleep 30

# 2. Check health endpoint
curl -s https://spmsystem.com/api/health | python3 -m json.tool

# 3. CRITICAL: Verify environment variables loaded in container
ssh root@143.110.229.185 "docker exec app-app-1 printenv | grep -E 'NEST_|GOOGLE_|DROPBOX_' | head -3"

# 4. Check for application errors in logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 50 | grep -i error || echo 'No errors found'"

# 5. Test critical functionality (if applicable)
# For camera deployment: Open https://spmsystem.com/cameras and test streaming
# For payments: Verify /payments page loads
# For integrations: Check relevant endpoints
```

**If environment variables are NOT showing in container:**
```bash
# Full container restart required
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml --env-file .env.production down app && docker compose -f docker-compose.prod.yml --env-file .env.production up -d app"

# Wait and verify again
sleep 30
ssh root@143.110.229.185 "docker exec app-app-1 printenv | grep -E 'NEST_|GOOGLE_'"
```

## After Deployment
Report to the user:
1. New version number
2. What was deployed (summary of changes)
3. Health check status
4. **Confirmation that environment variables are loaded** (if new vars were added)
5. Any critical functionality tested

## If Migrations Are Needed
Ask the user which migration to run, then:
```bash
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" < scripts/migrations/XXX.sql
```

## Troubleshooting

### Health check fails
```bash
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"
```

### Need to rollback
```bash
ssh root@143.110.229.185 "cd /root/app && git checkout HEAD~1 && docker compose -f docker-compose.prod.yml --env-file .env.production pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
```

### Container won't start
```bash
ssh root@143.110.229.185 "docker compose -f /root/app/docker-compose.prod.yml --env-file /root/app/.env.production logs app"
```
