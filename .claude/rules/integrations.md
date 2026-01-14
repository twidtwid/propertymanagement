---
paths: src/lib/dropbox/**, src/lib/gmail/**, src/lib/taxes/**
---

# Integrations

## Dropbox

**Critical:** `namespace_id = '13490620643'` for shared folder access.

| Table | Purpose |
|-------|---------|
| `dropbox_oauth_tokens` | Encrypted tokens + namespace_id |
| `dropbox_folder_mappings` | Entity → folder path |
| `dropbox_file_summaries` | AI summaries (Haiku) |

Token refresh: hourly cron, on-demand if <1hr remaining.

## Gmail

| Table | Purpose |
|-------|---------|
| `gmail_oauth_tokens` | Encrypted tokens |
| `vendor_communications` | Synced emails (matched by domain) |

Sync: every 10 min via worker. Daily summary: 6 PM NYC.

## Tax Lookup

| Jurisdiction | Method | File |
|--------------|--------|------|
| NYC | Open Data API | `src/lib/taxes/providers/nyc-open-data.ts` |
| Santa Clara | Playwright | `scripts/lookup_scc_tax.py` |
| Providence | Playwright | `scripts/lookup_providence_tax.py` |
| Dummerston VT | Playwright | `scripts/lookup_vermont_tax.py` |
| Brattleboro VT | Manual | - |

Flow: Scripts POST → `/api/taxes/sync/callback` → `property_taxes` table

```bash
npm run tax:sync:live  # All scrapers
```
