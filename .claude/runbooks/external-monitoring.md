# External Monitoring Setup

## Overview

External monitoring ensures the production system is healthy and alerts when issues occur. We use UptimeRobot (free tier) for HTTP monitoring.

## UptimeRobot Setup

### 1. Create Account
- Go to https://uptimerobot.com/
- Sign up for free account (50 monitors, 5-minute intervals)
- Verify email address

### 2. Create HTTP Monitor

**Monitor Details:**
- Type: HTTP(s)
- Friendly Name: Property Management (spmsystem.com)
- URL: https://spmsystem.com/api/health
- Monitoring Interval: 5 minutes (free tier)

**Alert Contacts:**
1. Email: todd@example.com (replace with actual)
2. Pushover (optional, requires Pushover integration)

**Advanced Settings:**
- HTTP Method: GET
- Expected HTTP Status Code: 200
- Keyword Check (optional): `"status":"ok"`
- Timeout: 30 seconds

### 3. Configure Alert Thresholds

**When to Alert:**
- Down for: 2 consecutive checks (10 minutes)
- Send alert via: Email + Pushover

**Auto-Resolve:**
- Alert when back up: Yes
- Include downtime duration: Yes

### 4. Set Up Pushover Integration (Optional)

1. In UptimeRobot, go to "My Settings" → "Alert Contacts"
2. Click "Add Alert Contact"
3. Select "Pushover"
4. Enter:
   - User Key: `PUSHOVER_USER_TODD` from .env.production
   - App Token: `PUSHOVER_TOKEN` from .env.production
5. Test notification

## Expected Health Check Response

**Healthy Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T22:00:00.000Z",
  "version": "0.8.18",
  "environment": "production",
  "checks": {
    "database": {
      "status": "connected",
      "latency": "ok"
    },
    "workers": {
      "email_sync": {
        "status": "ok",
        "lastChecked": "2026-01-11T21:55:00.000Z",
        "minutesSinceCheck": 5,
        "failureCount": 0
      },
      "daily_summary": {
        "status": "ok",
        "lastChecked": "2026-01-11T21:50:00.000Z",
        "minutesSinceCheck": 10,
        "failureCount": 0
      }
    },
    "tokens": {
      "dropbox": {
        "expiresAt": "2026-02-11T00:00:00.000Z",
        "isValid": true
      },
      "gmail": {
        "expiresAt": "2026-02-11T00:00:00.000Z",
        "isValid": true
      }
    },
    "diskSpace": {
      "totalGB": 25.0,
      "usedGB": 12.5,
      "availableGB": 12.5,
      "usedPercent": 50.0,
      "status": "ok"
    },
    "weather": {
      "status": "healthy",
      "lastSuccess": "2026-01-11T21:45:00.000Z",
      "consecutiveFailures": 0
    },
    "system": {
      "uptime": 86400,
      "platform": "linux",
      "arch": "x64",
      "nodeVersion": "v20.11.0"
    }
  }
}
```

**Degraded Response (200 OK, but with warnings):**
```json
{
  "status": "degraded",
  "checks": {
    "workers": {
      "email_sync": {
        "status": "stale",
        "minutesSinceCheck": 35
      }
    },
    "diskSpace": {
      "usedPercent": 85.0,
      "status": "warning"
    }
  }
}
```

**Critical Response (503 Service Unavailable):**
```json
{
  "status": "error",
  "error": "Database connection failed",
  "checks": {
    "database": {
      "status": "disconnected"
    }
  }
}
```

## Health Check Status Codes

| HTTP Status | Overall Status | Meaning |
|-------------|---------------|---------|
| 200 | ok | All systems operational |
| 200 | degraded | Some non-critical issues (stale workers, disk warning) |
| 503 | error | Critical failure (database down, disk full) |

## Alert Response

### When You Receive an Alert

1. **Check the health endpoint manually:**
   ```bash
   curl -s https://spmsystem.com/api/health | jq .
   ```

2. **SSH into production and check logs:**
   ```bash
   ssh root@143.110.229.185
   docker logs app-app-1 --tail 100
   docker logs app-db-1 --tail 100
   ```

3. **Check container status:**
   ```bash
   docker ps -a
   ```

4. **If database is down:**
   ```bash
   docker compose -f docker-compose.prod.yml restart db
   ```

5. **If app is down:**
   ```bash
   docker compose -f docker-compose.prod.yml restart app
   ```

6. **Check disk space:**
   ```bash
   df -h
   ```

## False Positive Scenarios

**Transient network issues:**
- UptimeRobot can't reach server due to network blip
- Wait for 2nd check (5 minutes) before investigating

**Deployment in progress:**
- Health check may fail during deploy (30-60 seconds)
- Expected, ignore if you're actively deploying

**Worker heartbeat stale:**
- Workers may be running but not updating health_check_state
- Check container logs: `docker logs app-email-sync-1 --tail 50`
- If logs show activity but health is stale, worker needs heartbeat fix

## Maintenance Mode

To temporarily disable alerts during maintenance:

1. In UptimeRobot, click on monitor
2. Click "Pause Monitoring"
3. Select duration (e.g., 1 hour)
4. Resume when done

## Monthly Review

Check UptimeRobot dashboard for:
- Uptime percentage (target: >99.9%)
- Response time trends (target: <500ms)
- Incident patterns (look for recurring issues)
