# /prod-logs

View production application logs.

## Production Server
- **IP:** 143.110.229.185
- **App Container:** app-app-1

## What this skill does:
1. Fetches recent logs from the production app container
2. Displays them for troubleshooting
3. Can filter for errors if requested

## Steps to execute:

### Default: Show last 100 lines
```bash
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100 2>&1"
```

### If user wants more logs:
```bash
ssh root@143.110.229.185 "docker logs app-app-1 --tail 500 2>&1"
```

### If user wants to filter for errors:
```bash
ssh root@143.110.229.185 "docker logs app-app-1 --tail 500 2>&1" | grep -i -E "error|exception|failed"
```

### If user wants real-time logs (follow mode):
Tell the user to run this command themselves as it requires an interactive terminal:
```bash
ssh root@143.110.229.185 "docker logs -f app-app-1"
```

## Other useful log commands:
```bash
# All containers status
ssh root@143.110.229.185 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Database container logs
ssh root@143.110.229.185 "docker logs app-db-1 --tail 50 2>&1"

# Email sync container logs
ssh root@143.110.229.185 "docker logs app-email-sync-1 --tail 50 2>&1"

# Daily summary container logs
ssh root@143.110.229.185 "docker logs app-daily-summary-1 --tail 50 2>&1"
```

## After showing logs:
Summarize any errors or issues found for the user.
