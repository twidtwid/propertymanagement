---
description: Deploy local changes to production. Run tests, bump version, commit, and deploy to spmsystem.com.
---

Deploy local changes to production via CI/CD. This is the ONE AND ONLY way to deploy.

## Production Environment
- **Server:** root@143.110.229.185
- **Domain:** spmsystem.com
- **App Dir:** /root/app
- **Database:** propertymanagement (user: propman)

## Arguments
- `--minor` - Bump minor version (0.6.0 → 0.7.0) instead of patch (0.6.0 → 0.6.1)
- `--skip-tests` - Skip running tests (use sparingly)

## How Deployment Works

Push to `main` triggers automatic CI/CD via GitHub Actions:

```
Push → Tests (2m) → Build & Push to GHCR (9m) → Deploy to Production (20s)
```

**Total: ~11 minutes from push to production.**

## What This Command Does

**IMPORTANT:** Follow these steps IN ORDER. Do not skip steps.

### Step 0: PRE-FLIGHT CHECKS (CRITICAL!)
Run automated pre-deployment checks:
```bash
./scripts/pre-deploy-check.sh
```

This script verifies:
1. Environment variable parity (dev vs prod)
2. No uncommitted changes
3. Build succeeds
4. Tests pass
5. Critical env vars present in production
6. Production health status

**If pre-flight checks FAIL:**
- DO NOT proceed with deployment
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

### Step 1: Check Git Status
```bash
git status
git log --oneline -3
```
Note what files are changed for the commit message.

### Step 2: Bump Version
For patch release (default):
```bash
npm version patch --no-git-tag-version
```
For minor release (if --minor flag):
```bash
npm version minor --no-git-tag-version
```

### Step 3: Commit All Changes
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

### Step 4: Push to GitHub (Triggers CI/CD)
```bash
git push origin main
```

This triggers the GitHub Actions workflow which:
1. Runs all tests
2. Builds Docker images (app + worker)
3. Pushes images to GitHub Container Registry (ghcr.io)
4. SSHs to production server
5. Pulls new images and restarts containers
6. Runs health check

### Step 5: Monitor CI/CD Progress
Open the GitHub Actions page to monitor:
- **URL:** https://github.com/twidtwid/propertymanagement/actions

Or tell the user to check the Actions tab in GitHub.

The workflow takes approximately:
- Tests: ~2 minutes
- Build & Push: ~9 minutes
- Deploy: ~20 seconds
- **Total: ~11 minutes**

### Step 6: Verify Deployment
After CI/CD completes successfully:

```bash
# 1. Check health endpoint
curl -s https://spmsystem.com/api/health | python3 -m json.tool

# 2. Verify version number updated
curl -s https://spmsystem.com/api/health | jq .version

# 3. CRITICAL: Verify environment variables loaded in container (if new vars added)
ssh root@143.110.229.185 "docker exec app-app-1 printenv | grep -E 'NEST_|GOOGLE_|DROPBOX_' | head -3"

# 4. Check for application errors in logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 50 | grep -i error || echo 'No errors found'"
```

## After Deployment
Report to the user:
1. New version number
2. What was deployed (summary of changes)
3. Health check status
4. CI/CD workflow URL for reference
5. **Confirmation that environment variables are loaded** (if new vars were added)

## If CI/CD Fails

### Option 1: Fix and Re-push
Fix the issue, commit, and push again. CI/CD will re-run.

### Option 2: Manual Deploy (Emergency Only)
Bypass CI/CD using the local deploy script:
```bash
./scripts/fast-deploy.sh
```

### Check CI/CD Logs
View the failing step in GitHub Actions:
https://github.com/twidtwid/propertymanagement/actions

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
ssh root@143.110.229.185 "cd /root/app && git checkout HEAD~1 && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
```

### Container won't start
```bash
ssh root@143.110.229.185 "docker compose -f /root/app/docker-compose.prod.yml --env-file /root/app/.env.production logs app"
```

### CI/CD GHCR Push Fails (403 Forbidden)
Check that the repository has write access to the GHCR package:
1. Go to: https://github.com/users/twidtwid/packages/container/propertymanagement/settings
2. Under "Manage Actions access", ensure `propertymanagement` repo has **Write** role

### Manual CI/CD Trigger
If you need to deploy without pushing new code:
1. Go to: https://github.com/twidtwid/propertymanagement/actions
2. Click "Deploy to Production"
3. Click "Run workflow" → "Run workflow"
