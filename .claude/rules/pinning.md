---
paths: src/components/ui/pin*, src/lib/**/pin*
---

# Pinning

Shared across all users (family-wide).

## Pin Types

| Type | Color | Behavior |
|------|-------|----------|
| Smart (system) | Orange | Auto-generated, dismiss to hide |
| User | Yellow | Manual, unpin to delete |

## Smart Pin Criteria

| Source | Triggers |
|--------|----------|
| Bills | Due ≤7 days, overdue, unconfirmed checks >14 days |
| Tickets | Urgent/high priority + pending/in_progress |
| BuildingLink | Critical messages, uncollected packages |

## Table: `pinned_items`

- `entity_type` + `entity_id` (unique constraint)
- `is_system_pin` - true=smart, false=user
- `dismissed_at` - smart pins only (user pins deleted)
- `metadata` - JSONB cache (title, amount, due_date)

## Sync

- After mutations: call `syncSmartPinsBills()` or `syncSmartPinsTickets()`
- Background: worker runs `/api/cron/sync-smart-pins` every 60 min

## UI

Pin button leftmost: `[Star] [Icon] [Content] [Actions]`

Dismiss smart pin → 10s undo toast. Unpin user pin → permanent (no undo).
