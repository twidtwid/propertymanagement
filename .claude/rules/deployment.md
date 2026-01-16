---
paths: scripts/fast-deploy.sh, docker-compose.prod.yml, .env.production, .github/workflows/deploy.yml
---

# Deployment

**Use `/deploy` command** - bumps version, commits, pushes to main, and CI/CD handles the rest.

## CI/CD Pipeline (Automatic)

Push to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`):

```
Push → Tests (2m) → Build & Push to GHCR (9m) → Deploy to Production (20s)
```

Total: ~11 minutes from push to production.

## Pre-Flight (Automated by /deploy)

1. Env parity check (`.env.local` vars exist in `.env.production`)
2. Tests pass
3. Build succeeds
4. TOKEN_ENCRYPTION_KEY matches

## Manual Deploy (Emergency Only)

If CI/CD fails, use local deploy script:

```bash
# Verify env parity first
comm -13 <(ssh root@143.110.229.185 "grep -o '^[A-Z_]*=' /root/app/.env.production" | sort) <(grep -o '^[A-Z_]*=' .env.local | sort)

# Deploy locally (bypasses CI/CD)
./scripts/fast-deploy.sh

# Verify
curl -s https://spmsystem.com/api/health | jq .version
```

## Rollback

```bash
ssh root@143.110.229.185 "cd /root/app && git checkout HEAD~1 && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
```

## Production Server

- IP: 143.110.229.185
- User: root
- App: /root/app
- Images: ghcr.io/twidtwid/propertymanagement:latest

## Monitoring CI/CD

- **Actions:** https://github.com/twidtwid/propertymanagement/actions
- **Manual trigger:** Actions → Deploy to Production → Run workflow
