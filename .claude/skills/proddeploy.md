# /proddeploy

Deploy local changes to production with automatic version bump.

## What this skill does:
1. Bumps the patch version in package.json (e.g., 0.5.0 → 0.5.1)
2. Commits all staged and unstaged changes with version tag
3. Pushes to GitHub
4. SSHs to production server and deploys

## Steps to execute:

### Step 1: Check for uncommitted changes
Run `git status` to see what will be committed.

### Step 2: Bump version
Run `npm version patch --no-git-tag-version` to bump the patch version.

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

Report the new version number and deployment status to the user.
