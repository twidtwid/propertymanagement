# Troubleshooting Guide

**Load manually when debugging issues.**

## Quick Fixes

| Problem | Fix |
|---------|-----|
| Date arithmetic error | Use `CURRENT_DATE + ($1::INTEGER)` |
| Zod validation fails | Sync `init.sql` enum with `schemas/index.ts` |
| Hydration error | Use `mounted` state + `suppressHydrationWarning` |
| Hot reload broken | `/deploydev` or `rm -rf .next && restart` |
| Worker not running | `docker logs app-worker-1`, restart if needed |
| Nest token expired | Check Pushover alerts, run `npm run nest:update-token` |
| UUID error | Use `gen_random_uuid()` not `uuid_generate_v4()` |

## File Edit Guide

| Change | File |
|--------|------|
| DB schema | `scripts/init.sql` + migration |
| Types | `src/types/database.ts` |
| Validation | `src/lib/schemas/index.ts` |
| Read data | `src/lib/actions.ts` |
| Write data | `src/lib/mutations.ts` |
| Background job | `scripts/unified-worker.js` |

## Hydration-Safe Date Pattern

```typescript
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return <span suppressHydrationWarning>...</span>
```

## Debug Commands

```bash
docker compose logs app --tail 100          # App logs
docker logs app-worker-1 --tail 100         # Worker logs
curl -s https://spmsystem.com/api/health | jq  # Health check
```
