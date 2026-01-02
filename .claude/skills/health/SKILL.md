---
name: health
description: Check the health status of the production system at spmsystem.com. Use to verify deployment success or diagnose issues.
---

# Production Health Check Skill

Verify the production system is running correctly.

## When to Use
- After deployment to verify success
- When user reports issues
- For routine health monitoring
- Before running production database commands

## Health Check Commands

### Quick health check
```bash
curl -s https://spmsystem.com/api/health | python3 -m json.tool
```

### Check all container status
```bash
ssh root@143.110.229.185 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

### Check app container specifically
```bash
ssh root@143.110.229.185 "docker ps -f name=app-app-1 --format '{{.Status}}'"
```

## Expected Response

### Healthy Response
```json
{
  "status": "healthy",
  "timestamp": "2026-01-02T...",
  "version": "0.6.0"
}
```

### Container Status
All 4 containers should show "Up":
- app-app-1 (Next.js web app)
- app-db-1 (PostgreSQL)
- app-email-sync-1 (Gmail sync)
- app-daily-summary-1 (Email scheduler)

## If Unhealthy

### Check logs
```bash
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"
```

### Restart app container
```bash
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml --env-file .env.production restart app"
```

### Check database connectivity
```bash
ssh root@143.110.229.185 "docker exec app-db-1 pg_isready -U propman -d propertymanagement"
```

## Report to User
- Health status (healthy/unhealthy)
- Version running
- Any containers not running
- Recent errors from logs if unhealthy
