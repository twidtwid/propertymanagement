---
name: deploydev
description: Restart dev environment with clean caches. Fixes webpack, font, and hot reload issues.
---

# Dev Deploy Skill

Restart local development with clean caches to resolve webpack, font, and hot reload issues.

## When to Use
- After code changes when hot reload fails
- When seeing webpack errors or stale code
- When fonts fail to load
- After pulling new changes from git
- When dev server behaves unexpectedly

## Commands

### Quick restart (recommended)
```bash
docker compose stop app && rm -rf .next && docker compose up -d app
```

### Full restart (if quick fails)
```bash
docker compose down && rm -rf .next && docker compose up -d
```

### Nuclear option (persistent issues)
```bash
docker compose down -v && rm -rf .next node_modules && docker compose build --no-cache && docker compose up -d
```

### Verify ready
```bash
docker compose logs app --tail 30 | grep -E "Ready|error|Error"
```

## Process

1. **Stop app** - `docker compose stop app`
2. **Clear cache** - `rm -rf .next`
3. **Start app** - `docker compose up -d app`
4. **Watch logs** - Wait for "Ready in XXXms"
5. **Verify** - Check http://localhost:3000 responds

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Webpack errors persist | Full restart with `docker compose down` |
| Font loading errors | Clear `.next/cache` specifically |
| Port 3000 in use | `docker compose down` to clear orphans |
| Module not found | Nuclear option (rebuild node_modules) |

## Expected Timing
- Quick restart: 15-30 seconds
- Full restart: 45-60 seconds
- Nuclear option: 2-3 minutes
