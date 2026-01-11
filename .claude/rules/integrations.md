---
paths: src/lib/dropbox/**, src/lib/gmail/**, src/lib/taxes/**, scripts/*tax*.py, scripts/*dropbox*
---

# Integrations

## Dropbox Document Sync

OAuth tokens encrypted (AES-256-GCM) in `dropbox_oauth_tokens`.

**Critical config:** `namespace_id = '13490620643'` for shared folder "Property Management"
- Without this, Dropbox returns wrong folder contents
- Auto-set on OAuth callback, but verify after reconnection issues

**Tables:**
- `dropbox_folder_mappings` - Entity → folder path
- `dropbox_file_summaries` - AI-generated summaries (Claude Haiku)

**Key function:** `src/lib/dropbox/files.ts:getInsuranceFolderPaths()`
- Returns `{ entityPath, portfolioPath }` for insurance document display

**Folder paths:**
- Properties: `/Properties/{property_name}`
- Vehicles: `/Vehicles/{vehicle_name}`
- Insurance portfolio: `/Insurance Portfolio`

**Production Cron Jobs:**
| Schedule | Endpoint | Log | Purpose |
|----------|----------|-----|---------|
| */15 * * * * | `/api/cron/dropbox-sync` | dropbox-sync.log | Sync files |
| 0 * * * * | `/api/cron/refresh-dropbox-token` | dropbox-refresh.log | Keep token fresh |

**Token Refresh:**
- Access tokens expire in 4 hours
- Hourly cron refreshes if <2 hours remaining
- On-demand refresh if <1 hour remaining (in `getDropboxClient`)
- If refresh fails → user must reconnect at `/settings/dropbox`

**Commands:**
```bash
npm run dropbox:sync          # Incremental (new files only)
npm run dropbox:sync:force    # Force regenerate all AI summaries
```

**Troubleshooting:**
- "Unauthorized" errors → Token expired, check refresh cron or reconnect
- Wrong folder contents → Missing `namespace_id`, run: `UPDATE dropbox_oauth_tokens SET namespace_id = '13490620643'`

## Gmail Integration

OAuth tokens encrypted in `gmail_oauth_tokens`.

**Tables:**
- `vendor_communications` - Synced emails (CASCADE DELETE with vendor)

**Matching:** Email address/domain → vendor

**Background sync:** Unified worker (`app-worker-1`) handles:
- Email sync: Every 10 minutes
- Daily summary email: 6:00 PM NYC time

## Tax Lookup System

### Automated Providers

| Jurisdiction | Method | File |
|--------------|--------|------|
| NYC | Open Data API | `src/lib/taxes/providers/nyc-open-data.ts` |
| Santa Clara CA | Playwright | `scripts/lookup_scc_tax.py` |
| Providence RI | Playwright | `scripts/lookup_providence_tax.py` |
| Dummerston VT | Playwright/NEMRC | `scripts/lookup_vermont_tax.py` |

### Manual Entry Required

| Jurisdiction | Source | Schedule |
|--------------|--------|----------|
| Brattleboro, VT | Town mailed bills | Quarterly (Aug/Nov/Feb/May) |
| Dummerston, VT | Town mailed bills | Semi-annual (Aug/Feb) |
| Providence, RI | City mailed bills | Quarterly (Jul/Oct/Jan/Apr) |

**Note:** Brooklyn condos have 421-a tax abatement (~$110-120/year actual vs API estimates).

### Tax Sync Architecture

1. NYC syncs via web app API
2. Other jurisdictions use external Python/Playwright scripts
3. Scripts POST to `/api/taxes/sync/callback`
4. Callback syncs to `tax_lookup_results` AND `property_taxes`

**Tables:**
- `tax_lookup_configs` - Per-property lookup config
- `tax_lookup_results` - Synced tax data
- `tax_sync_log` - Audit log
- `property_taxes` - Payment entries for UI

**Commands:**
```bash
npm run tax:sync:live       # All scrapers → local app
npm run tax:sync:scc        # Santa Clara only
npm run tax:sync:providence # Providence only
npm run tax:sync:vermont    # Vermont only
```

### PDF Tax Bill Workflow

1. Read PDF with Claude (extracts amounts, due dates, parcel IDs)
2. Update property record with `parcel_id`, `span_number` if missing
3. Insert `property_taxes` records with jurisdiction, installments, amounts
4. Mark paid installments as 'confirmed' with `payment_date`, `confirmation_date`

### Property Tax Identifiers

| Property | Jurisdiction | SPAN / Parcel |
|----------|--------------|---------------|
| Vermont Main House | Dummerston, VT | 186-059-10695 / 000453 |
| Booth House | Dummerston, VT | 186-059-10098 / 000446 |
| Vermont Guest House | Dummerston, VT | 186-059-10693 / 000454 |
| 22 Kelly Rd | Brattleboro, VT | 081-025-11151 / 00010009.000 |
| Brooklyn PH2E | NYC | Block 02324 / Lot 1305 |
| Brooklyn PH2F | NYC | Block 02324 / Lot 1306 |
| Rhode Island House | Providence, RI | 016-0200-0000 |
| 125 Dana Avenue | Santa Clara, CA | APN 274-15-034 |

### Tax Data Sources

| Jurisdiction | Source | URL |
|--------------|--------|-----|
| Dummerston, VT | NEMRC | nemrc.com |
| Brattleboro, VT | AxisGIS | axisgis.com/BrattleboroVT/ |
| Providence, RI | Catalis Tax & CAMA | providenceri.gov |
| NYC | NYC Open Data | data.cityofnewyork.us |
| Santa Clara, CA | County Tax Portal | dtac.sccgov.org |
