---
paths: scripts/fast-deploy.sh, docker-compose.prod.yml, .env.production
---

# Deployment

**Use `/deploy` skill** - automates pre-flight, version bump, push, deploy, and verification.

## Pre-Flight (Automated by /deploy)

1. Env parity check (`.env.local` vars exist in `.env.production`)
2. Tests pass
3. Build succeeds
4. TOKEN_ENCRYPTION_KEY matches

## Manual Deploy (Emergency Only)

```bash
# Verify env parity first
comm -13 <(ssh root@143.110.229.185 "grep -o '^[A-Z_]*=' /root/app/.env.production" | sort) <(grep -o '^[A-Z_]*=' .env.local | sort)

# Deploy
./scripts/fast-deploy.sh

# Verify
curl -s https://spmsystem.com/api/health | jq .version
```

## Rollback

```bash
ssh root@143.110.229.185 "cd /root/app && git checkout HEAD~1 && docker compose -f docker-compose.prod.yml up -d --build"
```

## Production Server

- IP: 143.110.229.185
- User: root
- App: /root/app
