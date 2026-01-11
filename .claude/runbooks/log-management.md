# Log Management

## Overview

All production containers use JSON file logging with automatic rotation:
- Max size per file: 10MB
- Max files kept: 3 (30MB total per container)
- Auto-rotation when size limit reached

## Viewing Logs

### Recent Logs (Live Tail)

```bash
# Tail all containers
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml logs -f"

# Tail specific container
docker logs app-app-1 -f --tail 100
docker logs app-db-1 -f --tail 50
docker logs app-email-sync-1 -f --tail 50
docker logs app-daily-summary-1 -f --tail 50
```

### Historical Logs

```bash
# Last 100 lines from app
docker logs app-app-1 --tail 100

# Last hour of logs
docker logs app-app-1 --since 1h

# Logs from specific date
docker logs app-app-1 --since "2026-01-11T00:00:00"

# Export logs to file
docker logs app-app-1 > /tmp/app-logs.txt
```

### Search Logs

```bash
# Search for errors in app logs
docker logs app-app-1 --tail 1000 | grep -i error

# Search for specific email sync activity
docker logs app-email-sync-1 --tail 500 | grep "Synced"

# Find all database connection errors
docker logs app-app-1 | grep "Database connection"

# Check for health check failures
docker logs app-app-1 | grep "health"
```

### Aggregate Logs from All Containers

```bash
# Show logs from all containers with timestamps
cd /root/app
docker compose -f docker-compose.prod.yml logs --tail 50

# Show only errors from all containers
docker compose -f docker-compose.prod.yml logs --tail 500 | grep -i error

# Export all container logs
docker compose -f docker-compose.prod.yml logs --no-color > /tmp/all-logs.txt
```

## Log Locations

Logs are stored in Docker's logging directory:

```bash
# Find log files on disk
ls -lh /var/lib/docker/containers/$(docker inspect --format='{{.Id}}' app-app-1)/$(docker inspect --format='{{.Id}}' app-app-1)-json.log*
```

## Common Log Patterns

### Application Startup

```
✅ Environment variables validated successfully
Database connected: postgres://propman@localhost:5432/propertymanagement
Next.js started on port 3000
```

### Email Sync

```
[email-sync] Starting email sync...
[email-sync] Synced 5 new messages
[email-sync] Next sync in 10 minutes
```

### Daily Summary

```
[daily-summary] Scheduler started
[daily-summary] Sending daily summary at 06:00
[daily-summary] Summary sent to anne@example.com
```

### Database Queries

```
[db] SELECT * FROM properties WHERE id = $1
[db] Query took 5ms
```

### Errors to Watch For

```
❌ Database connection failed
FATAL ERROR: JavaScript heap out of memory
Error: ECONNREFUSED
UnhandledPromiseRejectionWarning
```

## Log Rotation Details

**Current Configuration:**
- Driver: `json-file`
- Max size: 10MB per file
- Max files: 3 files per container
- Total: ~30MB per container
- Format: JSON (one log line per JSON object)

**When Rotation Happens:**
- File reaches 10MB → renamed to .1
- Existing .1 → renamed to .2
- Existing .2 → renamed to .3
- Existing .3 → deleted
- New file created

**Pros:**
- Automatic, no cron job needed
- Prevents disk space issues
- Fast log access

**Cons:**
- Old logs are deleted (3 files = ~30MB history)
- No centralized search across all containers
- Logs lost on container removal

## Upgrade Path: Centralized Logging

For better log retention and search, consider Loki + Grafana:

**Benefits:**
- Query logs across all containers
- Long-term retention (configurable)
- Visual dashboards
- Alerting on log patterns

**Setup Effort:** ~4 hours

**When to upgrade:**
- Need logs older than 30MB
- Want visual log exploration
- Need to alert on specific log patterns
- Multiple team members need log access

## Troubleshooting with Logs

### App Won't Start

```bash
# Check for startup errors
docker logs app-app-1 --tail 100

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

### Email Sync Not Working

```bash
# Check last sync attempt
docker logs app-email-sync-1 --tail 50

# Look for:
# - OAuth token expired
# - Gmail API rate limit
# - Network errors
```

### Daily Summary Not Sent

```bash
# Check scheduler logs
docker logs app-daily-summary-1 --tail 100

# Look for:
# - Scheduler timezone issues
# - Email sending errors
# - Database query failures
```

### Database Slow

```bash
# Check for slow queries
docker logs app-db-1 --tail 500 | grep "duration"

# Look for:
# - Queries taking >1000ms
# - Connection pool exhaustion
# - Lock wait timeouts
```

## Log Export for Support

If you need to share logs for debugging:

```bash
# Export last 24 hours from all containers
cd /root/app
docker compose -f docker-compose.prod.yml logs --since 24h > /tmp/logs-$(date +%Y%m%d).txt

# Compress for sharing
gzip /tmp/logs-$(date +%Y%m%d).txt

# Download from server
scp root@143.110.229.185:/tmp/logs-$(date +%Y%m%d).txt.gz ./
```

## Monitoring Log Health

Add to monthly checks:

```bash
# Check if logs are being written
docker logs app-app-1 --since 1m --tail 10

# Check log file sizes (should not exceed 30MB per container)
du -sh /var/lib/docker/containers/*/
```

If a container shows 0 logs or tiny log files, the application may be hanging or not producing output.
