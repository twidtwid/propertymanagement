---
paths: docker-compose*, Dockerfile*, scripts/unified-worker.js
---

# Development

## Local Dev

Use `/deploydev` skill to restart with clean caches.

Manual: `docker compose stop app && rm -rf .next && docker compose up -d app`

## Containers

| Container | Purpose |
|-----------|---------|
| app-app-1 | Next.js app |
| app-db-1 | PostgreSQL |
| app-worker-1 | Background tasks |

## Worker Tasks

| Task | Interval |
|------|----------|
| Email sync | 10 min |
| Smart pins | 60 min |
| Camera snapshots | 5 min |
| Daily summary | 6 PM NYC |

State file: `scripts/.unified-worker-state.json`

## Python

Use `uv run python scripts/*.py` (manages dependencies automatically)
