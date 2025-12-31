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

| Jurisdiction | Schedule | Installments | Typical Due Dates |
|--------------|----------|--------------|-------------------|
| NYC (Brooklyn) | Quarterly | 4 | Jul 1, Oct 1, Jan 1, Apr 1 |
| Providence, RI | Quarterly | 4 | Jul 24, Oct 24, Jan 24, Apr 24 |
| Vermont (Dummerston) | Semi-annual | 2 | Aug 15, Feb 15 |
| Vermont (Brattleboro) | Semi-annual | 2 | Aug 15, Feb 15 |
| Santa Clara, CA | Semi-annual | 2 | Dec 10, Apr 10 |

## Tax Lookup Methods

| Jurisdiction | Method | API/URL |
|--------------|--------|---------|
| NYC | NYC Open Data API | `data.cityofnewyork.us/resource/8y4t-faws.json` |
| Providence RI | Manual lookup | `providenceri.gov/tax-calculator` |
| Vermont | NEMRC Database | `nemrc.info/web_data/vtdumm/searchT.php` |
| Santa Clara CA | Playwright script | `scripts/lookup_scc_tax.py` (requires browser automation) |

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
