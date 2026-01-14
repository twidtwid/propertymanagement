---
paths: src/app/payments/**, src/components/payments/**, src/lib/**/bill*
---

# Payments

## Status Flow

`pending` → `sent` → `confirmed` (or `overdue` if past due_date, or `cancelled`)

## Check Confirmation

Bank of America unreliable. Track checks from sent → confirmed.

- `days_to_confirm = 14` (default)
- Flag unconfirmed checks >14 days
- Smart pins auto-pin unconfirmed checks

## Bill Types

| Type | Recurrence | Examples |
|------|------------|----------|
| property_tax | quarterly/semi_annual | Town/school taxes |
| insurance | annual | Premiums |
| utility | monthly | Electric, water, internet |
| mortgage | monthly | Loan payments |
| hoa | monthly | Condo fees |

## Unified Payment View

Payments page consolidates:
- `bills` table
- `property_taxes` table
- `insurance_policies` (premiums)

## Alert Triggers

- Due within 7 days (warning)
- Overdue (critical)
- Check unconfirmed >14 days (warning)
- Insurance expiring <60 days (warning)
