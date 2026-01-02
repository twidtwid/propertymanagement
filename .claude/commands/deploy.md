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

### Step 1: Run Tests
```bash
docker compose exec app npm run test:run
```
If tests fail, STOP and fix them before deploying.

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
The fast-deploy.sh script includes a health check, but also verify:
```bash
curl -s https://spmsystem.com/api/health | python3 -m json.tool
```

## After Deployment
Report to the user:
1. New version number
2. What was deployed (summary of changes)
3. Health check status

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
