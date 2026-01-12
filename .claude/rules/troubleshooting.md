---
paths: "**/*"
---

# Troubleshooting Guide

**Use this file when:** Debugging issues, something is broken, need fixes, or checking common problems.

---

## Common Issues and Fixes

| Problem | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Date arithmetic error** | `operator is not unique: date + unknown` | Missing type cast in SQL | Use `CURRENT_DATE + ($1::INTEGER)` not `+ $1` |
| **Zod validation fails** | Form rejects valid enum value | Enum mismatch between PostgreSQL and Zod | Sync PostgreSQL enum in `scripts/init.sql` with Zod schema in `src/lib/schemas/index.ts` |
| **Hydration error (dates)** | React console error on page load | SSR/client timezone difference | Use `mounted` state + `suppressHydrationWarning` pattern |
| **Dropbox wrong folder** | Files not syncing or wrong files shown | Missing `namespace_id` for shared folder | `UPDATE dropbox_oauth_tokens SET namespace_id = '13490620643'` |
| **Hot reload broken** | Code changes not appearing in browser | Webpack/Next.js cache corruption | Run `/deploydev` skill or `rm -rf .next && docker compose restart app` |
| **Worker not running** | Email/pins not syncing | Worker container crashed or stuck | Check logs: `docker logs app-worker-1` then restart if needed |
| **Nest token expired** | Camera 401 errors or blank images | OAuth token expired (~30 days) | Check Pushover alerts, follow instructions to refresh token |
| **UUID generation error** | `function uuid_generate_v4() does not exist` | Using wrong UUID function | Use `gen_random_uuid()` not `uuid_generate_v4()` |
| **Port already in use** | Dev server won't start | Previous process still running | `docker compose down` then `docker compose up -d` |
| **Out of memory** | Container crashes or slow | Memory limit exceeded | Check container limits in docker-compose.yml |

---

## Decision Trees

### "How do I add a new database field?"

```
1. Create migration in scripts/migrations/
   ↓
2. Update TypeScript types in src/types/database.ts
   ↓
3. Update Zod schema in src/lib/schemas/index.ts (if user-facing)
   ↓
4. Run migration: /migrate <filename>
   ↓
5. Run /build to catch type errors
   ↓
6. Update UI components to use new field
   ↓
7. Test locally, then /deploy
```

### "Email sync not working?"

```
Is worker container running?
├─ No → docker compose up -d worker
└─ Yes → Check logs: docker logs app-worker-1
    ├─ Token error? → Reconnect at /settings/gmail
    ├─ Health check failing? → Check /api/cron/sync-emails directly
    └─ No errors? → Check health_check_state table for last run time
```

### "Which file do I edit?"

```
What are you changing?
├─ Database schema → scripts/init.sql + migration
├─ TypeScript types → src/types/database.ts
├─ Validation rules → src/lib/schemas/index.ts
├─ Read data → src/lib/actions.ts
├─ Write data → src/lib/mutations.ts
├─ UI component → src/components/**
├─ Page → src/app/**/page.tsx
└─ Background job → scripts/unified-worker.js
```

### "Tests failing?"

```
What's the error?
├─ Import error → Check file paths, run `npm install`
├─ Type error → Run `/build` to see TypeScript errors
├─ Database error → Check if migration ran, verify connection
├─ Timeout error → Increase timeout or fix slow query
└─ Assertion error → Review test logic and expected behavior
```

### "Camera not working?"

```
Which camera type?
├─ Modern Nest (Google Device Access)
│   ├─ Check OAuth token in camera_credentials table
│   ├─ Verify NEST_PROJECT_ID in environment
│   ├─ Test token refresh endpoint
│   └─ Check logs for 401 errors
│
└─ Nest Legacy (Dropcam API)
    ├─ Check token expiration date
    ├─ Verify user_token cookie is valid
    ├─ Run: npm run nest:update-token <new-token>
    └─ Check Pushover alerts for expiration warnings
```

---

## Debugging Strategies

### Application Errors

**Client-side errors:**
```bash
# 1. Check browser console
# Open DevTools → Console tab

# 2. Check Network tab for failed requests
# Look for 4xx or 5xx status codes

# 3. Check server logs
docker compose logs app --tail 100
```

**Server-side errors:**
```bash
# 1. Check application logs
docker compose logs app --tail 100 | grep -i error

# 2. Check for unhandled promises
docker compose logs app | grep "UnhandledPromiseRejection"

# 3. Check database connection
docker compose exec app psql $DATABASE_URL -c "SELECT 1"

# 4. Verify environment variables
docker compose exec app printenv | grep -E "DATABASE_URL|NEXTAUTH"
```

### Database Issues

**Connection errors:**
```bash
# 1. Check database container is running
docker compose ps db

# 2. Test connection from app container
docker compose exec app psql $DATABASE_URL -c "SELECT 1"

# 3. Check database logs
docker compose logs db --tail 50

# 4. Verify credentials
echo $DATABASE_URL  # Should match .env.local
```

**Query errors:**
```bash
# 1. Check for SQL syntax errors in logs
docker compose logs app | grep "SQL"

# 2. Test query directly in psql
docker compose exec db psql -U propman -d propertymanagement

# 3. Check for missing tables/columns
\dt  # List tables
\d table_name  # Describe table
```

### Worker Issues

**Worker not running tasks:**
```bash
# 1. Check worker logs
docker logs app-worker-1 --tail 100

# 2. Check worker state file
cat scripts/.unified-worker-state.json

# 3. Check health_check_state table
# Use /prod-db skill
SELECT * FROM health_check_state ORDER BY last_checked_at DESC;

# 4. Verify endpoints work directly
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-emails

# 5. Check environment variables
docker exec app-worker-1 printenv | grep -E "APP_HOST|EMAIL_SYNC"
```

### OAuth Issues

**Token expired or invalid:**
```bash
# 1. Check token in database
# Google: google_oauth_tokens table
# Dropbox: dropbox_oauth_tokens table
# Nest: camera_credentials table (encrypted)

# 2. Test token refresh
# Navigate to /settings/gmail or /settings/dropbox
# Click "Reconnect" button

# 3. Check OAuth redirect URI matches
# Google Console: http://localhost:3000/api/oauth/google/callback (dev)
#                 https://spmsystem.com/api/oauth/google/callback (prod)
```

---

## Performance Issues

### Slow Page Loads

```bash
# 1. Check database query performance
# Look for N+1 queries or missing indexes
docker compose logs app | grep "slow query"

# 2. Check for large data transfers
# Use browser DevTools → Network tab → Size column

# 3. Profile server actions
# Add console.time/timeEnd around slow operations

# 4. Check server resource usage
docker stats  # Watch CPU/Memory usage
```

### High Memory Usage

```bash
# 1. Check container memory limits
docker stats

# 2. Check for memory leaks
# Look for steadily increasing memory over time

# 3. Check worker state file size
ls -lh scripts/.unified-worker-state.json

# 4. Restart container if needed
docker restart app-worker-1
```

---

## Production-Specific Issues

### "Health check failing"

```bash
# 1. Check health endpoint directly
curl -s https://spmsystem.com/api/health | jq

# 2. Check what's failing
# Look at .checks.workers object

# 3. Check worker logs
ssh root@143.110.229.185 "docker logs app-worker-1 --tail 100"

# 4. Check health_check_state table
# Use /prod-db skill
```

### "Deployment succeeded but changes not visible"

```bash
# 1. Verify correct version deployed
curl -s https://spmsystem.com/api/health | jq '.version'

# 2. Clear browser cache
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# 3. Check if files actually updated
ssh root@143.110.229.185 "cd /root/app && git log -1 --oneline"

# 4. Verify containers restarted
ssh root@143.110.229.185 "docker ps --format '{{.Names}}\t{{.Status}}'"
```

### "Cron jobs not running"

```bash
# 1. Check crontab
ssh root@143.110.229.185 "crontab -l"

# 2. Check cron service
ssh root@143.110.229.185 "systemctl status cron"

# 3. Check log files
ssh root@143.110.229.185 "tail -50 /var/log/dropbox-sync.log"

# 4. Test endpoint directly
ssh root@143.110.229.185 "curl -H 'Authorization: Bearer $CRON_SECRET' http://localhost:3000/api/cron/sync-dropbox"
```

---

## Code Patterns for Common Fixes

### Hydration-Safe Date Display

```typescript
'use client'
import { useState, useEffect } from 'react'

export function DateDisplay({ date }: { date: Date }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <span suppressHydrationWarning>{date.toISOString()}</span>
  return <span>{date.toLocaleDateString()}</span>
}
```

### SQL with Integer Cast

```sql
-- WRONG: "operator is not unique" error
WHERE due_date <= CURRENT_DATE + $1

-- CORRECT: explicit cast
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)
```

### Enum Label Display

```typescript
// Always use label maps from database.ts
import { billTypeLabels } from '@/types/database'

<span>{billTypeLabels[bill.bill_type]}</span>  // "Property Tax" not "property_tax"
```

### Optional Foreign Keys

```sql
-- Use LEFT JOIN when FK can be NULL
SELECT b.*, p.name as property_name, v.name as vendor_name
FROM bills b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN vendors v ON b.vendor_id = v.id
WHERE b.due_date <= CURRENT_DATE + ($1::INTEGER)
```

---

## Getting Help

**Before asking for help:**

1. Check this troubleshooting guide
2. Search logs for error messages
3. Check recent git commits for related changes
4. Test in isolation (create minimal reproduction)

**Information to provide:**

- Error message (full stack trace)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs
- Environment (dev vs production)
- Recent changes (git log)

**Skills that can help:**

- `/health` - Check production status
- `/prod-logs` - View production logs
- `/prod-db` - Query production database
- `/build` - Check for TypeScript errors
- `/test` - Run test suite
