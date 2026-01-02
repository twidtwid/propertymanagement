# /proddeploy

Deploy local changes to production with automatic version bump.

## Production Server
- **IP:** 143.110.229.185
- **Domain:** spmsystem.com
- **SSH:** root@143.110.229.185
- **App Dir:** /root/app
- **Database:** propertymanagement (user: propman)

## What this skill does:
1. Checks for uncommitted changes
2. Bumps the patch version in package.json (e.g., 0.2.0 → 0.2.1)
3. Commits all changes with version tag
4. Pushes to GitHub
5. SSHs to production server and deploys
6. Verifies deployment health

## Steps to execute:

### Step 1: Check for changes and recent commits
```bash
git status
git log --oneline -5
```

### Step 2: Bump version
```bash
npm version patch --no-git-tag-version
```

### Step 3: Commit and push
```bash
git add -A
git commit -m "v$(node -p "require('./package.json').version"): Production deploy"
git push origin main
```

### Step 4: Deploy to production
```bash
ssh root@143.110.229.185 "cd /root/app && git pull && docker compose -f docker-compose.prod.yml --env-file .env.production build app && docker compose -f docker-compose.prod.yml --env-file .env.production up -d app"
```

### Step 5: Verify deployment
```bash
ssh root@143.110.229.185 "docker ps --format 'table {{.Names}}\t{{.Status}}' && sleep 5 && curl -s http://localhost:3000/api/health"
```

## After deployment:
Report the new version number and deployment status to the user.

## If migrations are needed:
Ask the user which migrations to run, then use:
```bash
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" < scripts/migrations/XXX.sql
```
