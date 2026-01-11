---
paths: src/app/payments/**, src/components/payments/**, src/lib/**/payment*, src/lib/**/bill*
---

# Payment Processing Rules

## Payment Status Flow

```
pending → sent → confirmed
           ↓
        overdue (if past due_date without payment)
           ↓
       cancelled (manual action)
```

## Check Confirmation Workflow

**CRITICAL:** Bank of America has reliability issues. Checks must be tracked from sent to confirmed.

1. When marking a bill as "sent":
   - Set `payment_date` to today
   - Set `payment_method` to "check"
   - Set `payment_reference` to check number (if known)

2. Confirmation tracking:
   - `days_to_confirm` default is 14 days
   - If `payment_date` is set but `confirmation_date` is null after 14 days, flag as "needs confirmation"
   - UI should prominently display unconfirmed checks

3. When confirming a check:
   - Set `confirmation_date` to today
   - Optionally add `confirmation_notes`
   - Update `status` to "confirmed"

## Property Tax Schedules

| Jurisdiction | Schedule | Installments | Due Dates (2025-2026) |
|--------------|----------|--------------|----------------------|
| NYC (Brooklyn) | Quarterly | 4 | Jul 1, Oct 1, Jan 1, Apr 1 |
| Providence, RI | Quarterly | 4 | Jul 24, Oct 24, Jan 24, Apr 24 |
| Dummerston, VT | Semi-annual | 2 | Aug 20, Feb 20 |
| Brattleboro, VT | Quarterly | 4 | Aug 15, Nov 17, Feb 17, May 15 |
| Santa Clara, CA | Semi-annual | 2 | Dec 10, Apr 10 |

**Note:** Vermont tax years run Jul-Jun (e.g., "Tax Year 2025" covers Jul 2025 - Jun 2026).

## Tax Lookup Methods

| Jurisdiction | Method | Status | Source |
|--------------|--------|--------|--------|
| NYC | NYC Open Data API | ✅ Working | `src/lib/taxes/providers/nyc-open-data.ts` |
| Santa Clara CA | Playwright | ✅ Working | `scripts/lookup_scc_tax.py` |
| Providence RI | City Hall Systems | ✅ Working | `scripts/lookup_providence_tax.py` |
| Dummerston, VT | NEMRC | ✅ Working | `scripts/lookup_vermont_tax.py` |
| Brattleboro, VT | AxisGIS | ❌ Manual | axisgis.com/BrattleboroVT/ |

### Tax Assessment Data Sources

| Jurisdiction | Source | URL | Data Available |
|--------------|--------|-----|----------------|
| Dummerston, VT | NEMRC Property Database | nemrc.com | Parcel info, SPAN, building details, sales history |
| Brattleboro, VT | AxisGIS | axisgis.com/BrattleboroVT/ | Parcel maps, SPAN lookup |
| Providence, RI | Catalis Tax & CAMA | providenceri.gov | Full property cards, assessment history, building details |
| NYC | NYC Open Data / ACRIS | data.cityofnewyork.us | Tax bills (note: 421-a abatements not in API) |
| Santa Clara, CA | County Tax Portal | dtac.sccgov.org | Tax bills, assessment details |

### Vermont Tax Bill Components

Vermont tax bills combine Municipal and Education taxes:
- **Municipal Tax**: Town services (roads, fire, etc.)
- **Education Tax**: School funding (Homestead vs Non-Homestead rates)
- **Grand List Value**: Assessed value ÷ 100 (used in tax calculations)
- **SCL Code**: School code (e.g., 059 for Dummerston, 025 for Brattleboro)

### Automated Tax Sync System

**Architecture:**
1. NYC syncs via web app API (serverless-compatible)
2. Other jurisdictions use external Python/Playwright scripts
3. Scripts POST results to `/api/taxes/sync/callback`
4. Callback syncs data to both `tax_lookup_results` AND `property_taxes` tables
5. `property_taxes` feeds the calendar and payments UI

**Database Tables:**
- `tax_lookup_configs` - Per-property lookup configuration
- `tax_lookup_results` - Synced tax data (assessed values, amounts, installments)
- `tax_sync_log` - Audit log of all sync attempts
- `property_taxes` - Payment entries shown on calendar/payments

**API Endpoints:**
- `POST /api/cron/sync-taxes` - Run NYC tax sync
- `POST /api/taxes/sync/callback` - Receive results from external scrapers
- Uses `CRON_SECRET` for authentication

**Running Tax Sync:**
```bash
npm run tax:sync:live      # Run all scrapers, post to local app
npm run tax:sync:scc       # Santa Clara only
npm run tax:sync:providence # Providence only
npm run tax:sync:vermont   # Vermont only
```

**Weekly Cron (macOS/Linux):**
```bash
# Add to crontab -e
0 6 * * 1 cd /Users/toddhome/repo/propertymanagement && uv run python scripts/sync_all_taxes.py --callback http://localhost:3000/api/taxes/sync/callback
```

**Manual Sync:**
```bash
curl -X POST http://localhost:3000/api/cron/sync-taxes
```

**Provider Implementation Files:**
- `src/lib/taxes/providers/nyc-open-data.ts` - NYC Open Data API
- `src/lib/taxes/providers/santa-clara-county.ts` - SCC (requires Playwright)
- `src/lib/taxes/sync.ts` - Main sync orchestration

## Bill Types

| Type | Recurrence | Examples |
|------|------------|----------|
| property_tax | quarterly/semi_annual | Town taxes, school taxes |
| insurance | annual | Berkley One, GEICO premiums |
| utility | monthly | Electric, water, gas, internet |
| maintenance | one_time | Repairs, contractor work |
| mortgage | monthly | Brooklyn PH2F mortgage payment |
| hoa | monthly | Brooklyn condo HOA fees |
| other | varies | One-off expenses |

## Unified Payment View

The Payments page consolidates:
- Bills from `bills` table
- Property taxes from `property_taxes` table
- Insurance premiums from `insurance_policies` table

All displayed with common columns: description, property, amount, due_date, status, payment_method

## Auto-Pay Handling

Bills with `payment_method = 'auto_pay'`:
- Still track `payment_date` when the auto-pay runs
- May still need confirmation (bank statement verification)
- Display differently in UI (less urgent than manual payments)

## Overdue Logic

A bill is overdue when:
- `status = 'pending'` AND `due_date < CURRENT_DATE`

Automatic status updates:
- Daily job could update status to 'overdue', OR
- Calculate dynamically in queries/UI

## Payment Notifications

Alert triggers:
1. Payment due within 7 days (warning)
2. Payment overdue (critical)
3. Check unconfirmed >14 days (warning)
4. Insurance policy expiring within 60 days (warning)
