# Property Management System

> Personal property management app for Anne managing 10 properties across 6 jurisdictions plus 7 vehicles.

## Quick Reference

| Item | Value |
|------|-------|
| **Tech Stack** | Next.js 14 (App Router), TypeScript, Tailwind + shadcn/ui, PostgreSQL |
| **Production** | spmsystem.com (143.110.229.185) |
| **Version** | Check `package.json` for current version |
| **Deploy** | Use `/deploy` command (the ONE way to deploy) |

### Users
| User | Role | Access |
|------|------|--------|
| Anne, Todd, Michael, Amelia | Owner | Full access |
| Barbara Brady (CBIZ) | Bookkeeper | Bills/payments only |

### Assets
- **10 properties:** 4 Vermont, 2 Brooklyn condos, RI house, Martinique, Paris, San Jose
- **7 vehicles:** 5 RI-registered (Anne), 2 CA-registered (Todd)
- **70+ vendors** organized by specialty and location

---

## 🚨 DEPLOYMENT POLICY

**CRITICAL: Never deploy to production manually. Only deploy using the `/deploy` skill.**

- ❌ DO NOT run deployment commands yourself (docker compose, ssh, etc.)
- ❌ DO NOT manually push to production
- ❌ DO NOT restart production services directly
- ✅ ONLY use the `/deploy` skill when deployment is needed
- ✅ The `/deploy` skill handles tests, version bump, commit, push, and deployment automatically

This ensures consistency, proper version tracking, and complete audit trail for all deployments.

---

## File Locations

### Core Application
| Purpose | Location |
|---------|----------|
| Database schema | `scripts/init.sql` |
| TypeScript types | `src/types/database.ts` |
| Zod schemas | `src/lib/schemas/index.ts` |
| Server actions (reads) | `src/lib/actions.ts` |
| Server actions (writes) | `src/lib/mutations.ts` |
| Utilities | `src/lib/utils.ts` |

### Integrations
| Integration | Files |
|-------------|-------|
| Gmail | `src/lib/gmail/` (auth, client, sync, matcher) |
| Dropbox | `src/lib/dropbox/` (auth, files, sync, types) |
| Tax lookup | `src/lib/taxes/` (sync, providers/) |
| Banking import | `src/lib/banking/` (csv-parser, matcher) |

### Components
| Category | Location |
|----------|----------|
| UI primitives | `src/components/ui/` (shadcn) |
| Layout | `src/components/layout/` |
| Forms | `src/components/forms/` |
| Feature-specific | `src/components/{feature}/` |

---

## Production Environment

### Server Details
| Item | Value |
|------|-------|
| Provider | DigitalOcean Droplet |
| IP Address | 143.110.229.185 |
| Domain | spmsystem.com |
| SSH | `ssh root@143.110.229.185` |
| App Directory | /root/app |

### Docker Containers
| Container | Purpose |
|-----------|---------|
| app-app-1 | Next.js web application |
| app-db-1 | PostgreSQL database (user: propman) |
| app-daily-summary-1 | Daily summary email scheduler |
| app-email-sync-1 | Gmail sync service |

### Production Cron Jobs
| Schedule | Task | Log |
|----------|------|-----|
| Every 15 min | Dropbox sync | /var/log/dropbox-sync.log |
| 3 AM daily | Database backup | /var/log/backup.log |
| 6 AM daily | Disk check | /var/log/disk-check.log |
| Sunday 4 AM | Docker prune | /var/log/docker-prune.log |

### Quick Commands
```bash
# View logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"

# Database shell
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"

# Health check
curl -s https://spmsystem.com/api/health

# Restart app
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml --env-file .env.production restart app"
```

---

## Development

### Local Development Server

**Use `/deploydev` skill to restart dev with clean caches**

```bash
# Quick restart (clears cache, restarts app only - fastest)
docker compose stop app && rm -rf .next && docker compose up -d app

# Full restart (if quick fails)
docker compose down && rm -rf .next && docker compose up -d

# Check if ready
docker compose logs app --tail 20
```

Dev server should show "Ready in XXXms" when compilation is complete.

**When to restart:**
- After code changes when hot reload fails
- When seeing webpack or font errors
- After pulling new changes from git

---

## Claude Skills & Commands

### Skills (read-only reference)
| Skill | Purpose |
|-------|---------|
| `/test` | Run test suite |
| `/build` | Run Next.js build (check for TypeScript errors) |
| `/health` | Check production health |
| `/schema` | Database schema reference |
| `/deploydev` | Restart dev environment with clean caches |

### Commands (actions)
| Command | Purpose |
|---------|---------|
| `/deploy` | **THE deployment command** - tests, version bump, commit, deploy |
| `/backup` | Full production database backup to local |
| `/prod-logs` | View production application logs |
| `/prod-db` | Open production database shell |
| `/migrate` | Run a migration on production |

---

## NPM Scripts

```bash
# Development
npm run dev                    # Start local dev server
npm run build                  # Production build
npm run lint                   # Lint check

# Testing
npm run test                   # Watch mode
npm run test:run               # Single run

# Tax sync (Python/Playwright scrapers)
npm run tax:sync               # Dry run all
npm run tax:sync:live          # Post to local app
npm run tax:sync:scc           # Santa Clara County
npm run tax:sync:providence    # Providence RI
npm run tax:sync:vermont       # Vermont

# Dropbox sync
npm run dropbox:sync           # Incremental (new files only)
npm run dropbox:sync:force     # Force regenerate all AI summaries
```

---

## Database

### Key Enums
```
user_role: owner | bookkeeper
payment_status: pending | sent | confirmed | overdue | cancelled
payment_method: check | auto_pay | online | wire | cash | other
bill_type: property_tax | insurance | utility | maintenance | mortgage | hoa | other
insurance_type: homeowners | auto | umbrella | flood | earthquake | liability | health | travel | other
vendor_specialty: hvac | plumbing | electrical | roofing | general_contractor | landscaping | cleaning | fuel_oil | fireplace | insurance | auto | elevator | flooring | parking | masonry | alarm_security | audiovisual | ... (31 total)
```

### Key Tables
| Table | Purpose |
|-------|---------|
| properties | Real estate assets |
| vehicles | Cars/trucks |
| vendors | Service providers |
| vendor_contacts | Multiple contacts per vendor (one is_primary) |
| bills | Payment entries with status workflow |
| property_taxes | Tax payments by jurisdiction/installment |
| insurance_policies | Policy details with coverage_details JSONB |
| dropbox_folder_mappings | Entity → Dropbox folder paths |
| dropbox_file_summaries | AI-generated document summaries |
| pinned_items | Shared pins (smart + user) visible to all users |

### Query Patterns
```sql
-- CRITICAL: Cast integers in date arithmetic
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)  -- CORRECT
WHERE due_date <= CURRENT_DATE + $1              -- WRONG (ambiguous)

-- UUID generation
INSERT INTO ... (id, ...) VALUES (gen_random_uuid(), ...)

-- Optional relations need LEFT JOIN
SELECT b.*, p.name FROM bills b LEFT JOIN properties p ON b.property_id = p.id
```

### Migrations Applied
| # | Description |
|---|-------------|
| 002-006 | Tax lookup system, configs, audit log |
| 007 | Property visibility (restricted properties) |
| 008-011 | Dropbox schema, data import, insurance portfolio |
| 012 | Vendor contacts (multiple per vendor) |
| 013 | BuildingLink flags, alert enhancements |
| 014-015 | Berkley auto insurance, vendor data merge |
| 016 | Data reconciliation |
| 019-023 | **Unified pinning system** (smart + user pins, dismissals, performance) |
| 024-025 | Pin notes with due dates |

---

## Integrations

### Dropbox Document Sync

**Architecture:**
- OAuth tokens stored encrypted in `dropbox_oauth_tokens`
- Shared folder accessed via `namespace_id` (13490620643 for "Property Management")
- Folders mapped to entities in `dropbox_folder_mappings`
- AI summaries generated with Claude Haiku, stored in `dropbox_file_summaries`
- Sync runs every 15 minutes via production cron

**Key Functions:**
```typescript
// src/lib/dropbox/files.ts
getInsuranceFolderPaths(propertyId, vehicleId, carrierName)
  // Returns { entityPath, portfolioPath } for insurance document display
  // entityPath = property/vehicle specific Insurance folder
  // portfolioPath = portfolio-wide (Berkley One) folder

// src/lib/dropbox/sync.ts
runDropboxSync({ verbose, forceRegenerate })
  // Scans all mapped folders, generates AI summaries for new files
```

**Folder Mappings:**
| Entity Type | Example Path |
|-------------|--------------|
| property | `/Properties/Rhode Island House` |
| vehicle | `/Vehicles/2019 Audi Q7` |
| insurance_portfolio | `/Insurance Portfolio` |

### Gmail Integration

- OAuth tokens encrypted in `gmail_oauth_tokens`
- Emails synced to `vendor_communications`
- Matched to vendors via email address/domain
- Daily summary emails sent via `app-daily-summary-1` container

### Tax Lookup System

**Automated Providers:**
| Jurisdiction | Method | Script |
|--------------|--------|--------|
| NYC | Open Data API | `src/lib/taxes/providers/nyc-open-data.ts` |
| Santa Clara CA | Playwright | `scripts/lookup_scc_tax.py` |
| Providence RI | Playwright | `scripts/lookup_providence_tax.py` |
| Dummerston, VT | Playwright/NEMRC | `scripts/lookup_vermont_tax.py` |

**Manual Entry (from PDF tax bills):**
| Jurisdiction | Source | Notes |
|--------------|--------|-------|
| Brattleboro, VT | Town mailed bills | Quarterly (Aug/Nov/Feb/May). Enter SPAN, Parcel ID, SCL code. |
| Dummerston, VT | Town mailed bills | Semi-annual (Aug/Feb). NEMRC for property details. |
| Providence, RI | City mailed bills | Quarterly (Jul/Oct/Jan/Apr). Catalis for property cards. |

**Workflow for PDF Tax Bills:**
1. Read PDF with Claude (extracts amounts, due dates, parcel IDs)
2. Update property record with parcel_id, span_number if missing
3. Insert property_taxes records with jurisdiction, installments, amounts
4. Mark paid installments as 'confirmed' with payment_date, confirmation_date
5. Sync to production: Export local table, truncate prod, import

**Note:** Brooklyn condos have 421-a tax abatement (~$110-120/year actual vs API estimates). Manually update from NYC Finance bills.

---

## Pinning System

### Overview

The unified pinning system allows highlighting important items across the application. All pins are **shared across all users** (family-wide), with two types:

| Pin Type | Color | Icon | Description | User Action |
|----------|-------|------|-------------|-------------|
| **Smart Pins** | 🟠 Orange | ⚡ Zap | Auto-generated by system based on urgency/attention | Dismiss (hides until criteria change) |
| **User Pins** | 🟡 Yellow | ⭐ Star | Manually pinned by users | Unpin (deletes completely) |

### Architecture

**Database Schema** (`pinned_items` table):
```sql
CREATE TABLE pinned_items (
  id UUID PRIMARY KEY,
  entity_type pinned_entity_type NOT NULL,  -- vendor, bill, ticket, etc.
  entity_id UUID NOT NULL,

  -- Smart vs User Pin
  is_system_pin BOOLEAN DEFAULT false,      -- true = smart pin, false = user pin

  -- Cached metadata (avoids joins)
  metadata JSONB,                            -- title, amount, due_date, etc.

  -- Audit trail
  pinned_at TIMESTAMP DEFAULT NOW(),
  pinned_by UUID REFERENCES profiles(id),
  pinned_by_name TEXT,                       -- "Anne pinned this"

  -- Dismissal tracking (smart pins only)
  dismissed_at TIMESTAMP,
  dismissed_by UUID REFERENCES profiles(id),
  dismissed_by_name TEXT,

  UNIQUE(entity_type, entity_id)
);
```

**Supported Entity Types**:
- `vendor` - Service providers
- `bill` - Payment entries
- `insurance_policy` - Policies
- `property_tax` - Tax payments
- `insurance_premium` - Premium payments
- `ticket` - Maintenance tasks
- `buildinglink_message` - BuildingLink communications
- `document` - Dropbox files

### Smart Pin Logic

Smart pins are automatically generated based on business rules. They run via:
- **Hourly cron**: `/api/cron/sync-smart-pins` (production)
- **Auto-triggers**: After mutations (bill confirmation, ticket closure, etc.)
- **Manual reset**: Settings → Smart Pins → Reset All

**Smart Pin Criteria**:

| Source | Criteria | Function |
|--------|----------|----------|
| **Bills** | Due within 7 days OR overdue OR unconfirmed checks >14 days | `syncSmartPinsBills()` |
| **Tickets** | Urgent or high priority, status = pending/in_progress | `syncSmartPinsTickets()` |
| **BuildingLink** | Critical or important messages, uncollected packages | `syncSmartPinsBuildingLink()` |

**Example**: Bill becomes smart pinned if:
```typescript
const isDueOrOverdue = bill.status === 'pending' &&
  (bill.due_date <= addDays(new Date(), 7) || isPast(bill.due_date))

const needsConfirmation = bill.status === 'sent' &&
  bill.payment_method === 'check' &&
  bill.days_waiting > 14
```

### User Workflows

**Dismissing Smart Pins** (Orange ⚡):
1. User clicks orange star
2. Sets `dismissed_at = NOW()` (doesn't delete)
3. Shows 10-second toast with "Undo" button
4. Pin disappears from UI
5. Won't reappear unless:
   - User clicks "Reset All" in Settings
   - Underlying conditions change significantly

**Unpinning User Pins** (Yellow ⭐):
1. User clicks yellow star
2. Deletes row completely from `pinned_items`
3. No undo (permanent)
4. Can re-pin manually anytime

**Creating User Pins**:
1. User clicks gray star on unpinned item
2. Inserts row with `is_system_pin = false`
3. Metadata cached (title, amount, etc.)
4. Shared with all family members immediately

### Performance Optimizations

**Indexes** (Migration 023):
```sql
-- Hot path: fetch active smart pins by type
CREATE INDEX idx_pinned_items_smart_active
ON pinned_items(entity_type, is_system_pin, dismissed_at)
WHERE is_system_pin = true;

-- Fast entity lookup
CREATE INDEX idx_pinned_items_entity_lookup
ON pinned_items(entity_type, entity_id);

-- Dismissal analytics
CREATE INDEX idx_pinned_items_dismissed_at
ON pinned_items(dismissed_at)
WHERE dismissed_at IS NOT NULL;
```

**Metadata Caching**:
- Avoids expensive joins in daily summary emails
- Stores: title, amount, due_date, priority, etc.
- Updated on pin creation, not on every fetch

**Query Pattern**:
```typescript
// Fetch smart pins (exclude dismissed)
const smartPins = await query(
  `SELECT * FROM pinned_items
   WHERE entity_type = $1
     AND is_system_pin = true
     AND dismissed_at IS NULL`,
  ['bill']
)

// Fetch user pins (never dismissed)
const userPins = await query(
  `SELECT * FROM pinned_items
   WHERE entity_type = $1
     AND is_system_pin = false`,
  ['vendor']
)
```

### UI Components

**PinButton** (`src/components/ui/pin-button.tsx`):
- Universal star button for all entity types
- Props: `entityType`, `entityId`, `isPinned`, `pinType`, `metadata`
- Orange stars for smart pins, yellow for user pins
- Loading spinner during toggle
- Handles optimistic updates

**PinnedSection** (`src/components/ui/pinned-section.tsx`):
- Accented card wrapper for pinned items
- Props: `count`, `title`, `variant` ('smart' | 'user')
- Info tooltip explaining pin types
- Orange theme for smart pins, yellow for user pins

**Placement**: Pin button is **leftmost** in all rows for consistency:
```
[⭐ Star] [Icon] [Content...] [Actions]
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pinned/list` | POST | Get all pinned IDs by entity type |
| `/api/pinned/toggle` | POST | Toggle pin state (create/dismiss/delete) |
| `/api/pinned/undo` | POST | Restore dismissed smart pin |
| `/api/smart-pins/reset` | POST | Clear all dismissals, re-sync (owner-only) |

### Auto-Sync Triggers

Smart pins automatically sync after these mutations:

```typescript
// After bill confirmation
await confirmBillPayment(id)
await syncSmartPinsBills() // Remove from smart pins

// After bill status/due date change
await updateBill(id, { status: 'paid' })
if (statusChanged || dueDateChanged) {
  await syncSmartPinsBills()
}

// After ticket priority change
await updateTicket(id, { priority: 'high' })
if (priorityChanged) {
  await syncSmartPinsTickets()
}

// After ticket closure
await closeTicket(id)
await syncSmartPinsTickets() // Remove from smart pins
```

### Best Practices

**DO**:
- ✅ Keep metadata minimal (only what's needed for display)
- ✅ Use smart pins for system-generated urgency
- ✅ Use user pins for long-term important items
- ✅ Run sync after mutations that affect pin criteria
- ✅ Show undo for smart pin dismissals (10s window)

**DON'T**:
- ❌ Delete smart pins (dismiss instead)
- ❌ Store large objects in metadata (no full entities)
- ❌ Forget to sync after bill/ticket mutations
- ❌ Create user pins programmatically (only via UI)
- ❌ Show undo for user pin deletions (permanent by design)

### Troubleshooting

**Dismissed items keep reappearing?**
- Check if underlying conditions still meet smart pin criteria
- Run cleanup: Settings → Smart Pins → Reset All

**Smart pins not appearing?**
- Check hourly cron is running: `docker logs app-smart-pins-sync-1`
- Manually trigger: `npm run smart-pins:sync` (dev only)
- Verify sync functions are called after mutations

**Performance issues?**
- Check indexes exist: `\d pinned_items` in psql
- Run cleanup: `SELECT cleanup_orphaned_pins()`
- Check analytics: `SELECT * FROM pinned_items_stats`

---

## Code Conventions

### React/Next.js
- Server Components by default, "use client" only when needed
- Server Actions for mutations (no API routes for data)
- Forms: `react-hook-form` + `zod` validation
- Icons: `lucide-react`
- Dates: `date-fns` (formatDate, formatDateTime from utils)

### TypeScript
- All database types in `src/types/database.ts`
- Zod schemas mirror database enums in `src/lib/schemas/index.ts`
- When adding enum values: update BOTH PostgreSQL AND Zod schema

### Components
- EntityDocuments: `title` prop overrides default "Documents" label
- Forms support create/edit via optional entity prop
- Use `useTransition` for optimistic updates with server actions

---

## Business Rules

### Critical - Never Miss
1. **Property tax payments** - Quarterly/semi-annual across 6 jurisdictions
2. **Insurance renewals** - Berkley One (Anne), GEICO (Todd)
3. **Check confirmation** - Bank of America unreliable; flag unconfirmed >14 days

### Payment Status Flow
```
pending → sent → confirmed
              ↘ overdue (if past due)
              ↘ cancelled
```

### Property Visibility
- `property_visibility` table whitelists users per property
- If no rows exist for a property, all owners can see it
- Currently: 125 Dana Avenue restricted to Anne + Todd only

### Insurance Carriers
| Carrier | Covers |
|---------|--------|
| Berkley One | Anne's properties + vehicles (portfolio policy) |
| GEICO | Todd's CA property + vehicles |

---

## Authorization Matrix

| Resource | Owner | Bookkeeper |
|----------|-------|------------|
| Properties | Full CRUD | No access |
| Vehicles | Full CRUD | No access |
| Vendors | Full CRUD | View only |
| Bills/Payments | Full CRUD | Full CRUD |
| Insurance | Full CRUD | View only |
| Reports | Full access | No access |
| Settings | Full access | Profile only |

Enforced via middleware restricting bookkeeper to: `/`, `/payments/**`, `/settings`

---

## Property Tax Identifiers

| Property | Jurisdiction | SPAN / Parcel | Other IDs | Assessed Value |
|----------|--------------|---------------|-----------|----------------|
| Vermont Main House | Dummerston, VT | 186-059-10695 / 000453 | SCL: 059 | $870,300 |
| Booth House | Dummerston, VT | 186-059-10098 / 000446 | SCL: 059 | $521,700 |
| Vermont Guest House | Dummerston, VT | 186-059-10693 / 000454 | SCL: 059 | $413,000 |
| 22 Kelly Rd | Brattleboro, VT | 081-025-11151 / 00010009.000 | SCL: 025 | $211,130 |
| Brooklyn PH2E | NYC | Block 02324 / Lot 1305 | | ~$110/yr (421-a) |
| Brooklyn PH2F | NYC | Block 02324 / Lot 1306 | | ~$120/yr (421-a) |
| Rhode Island House | Providence, RI | 016-0200-0000 | Acct: 10845, Map/Lot: 16-200 | $1,197,700 |
| 125 Dana Avenue | Santa Clara, CA | APN 274-15-034 | | |

### Tax Data Sources

| Jurisdiction | Source | URL | Notes |
|--------------|--------|-----|-------|
| Dummerston, VT | NEMRC | nemrc.com | Property database with building details |
| Brattleboro, VT | AxisGIS | axisgis.com/BrattleboroVT/ | Manual lookup required |
| Providence, RI | Catalis Tax & CAMA | providenceri.gov | Full property cards with history |
| NYC | NYC Open Data | data.cityofnewyork.us | API access, but 421-a not reflected |
| Santa Clara, CA | County Tax Portal | dtac.sccgov.org | |

---

## Detailed Rules

See modular rules for deep dives:
- `.claude/rules/database.md` - Schema, enums, relationships, query patterns
- `.claude/rules/payments.md` - Payment workflows, tax schedules, confirmation logic
- `.claude/rules/security.md` - Authorization, RLS policies, data handling

---

## Development Patterns

### Adding New Features
1. Add database columns/tables via migration in `scripts/migrations/`
2. Update TypeScript types in `src/types/database.ts`
3. Update Zod schemas in `src/lib/schemas/index.ts`
4. Add server actions in `actions.ts` (reads) or `mutations.ts` (writes)
5. Create/update components
6. Run `/build` to verify TypeScript
7. Run `/test` to verify tests pass
8. Deploy with `/deploy`

### Common Gotchas
- **Zod validation errors** → Check enum values match database
- **Date arithmetic errors** → Cast to INTEGER: `$1::INTEGER`
- **Empty Dropbox folders** → Check `namespace_id` is set in `dropbox_oauth_tokens`
- **Insurance docs not showing** → Check `getInsuranceFolderPaths` returns correct paths
- **Hydration errors with dates** → Docker server runs UTC, client uses local timezone. Use `mounted` state pattern: render dates only after `useEffect(() => setMounted(true), [])` and add `suppressHydrationWarning` to the element
- **Email HTML style bleeding** → Vendor emails contain `<style>` and `<link>` tags with global CSS that bleeds into the page. Always sanitize with `sanitizeEmailHtml()` before using `dangerouslySetInnerHTML`

### UI Components
- shadcn/ui components in `src/components/ui/`
- Most Radix primitives already installed (check package.json)
- Use `buttonVariants` for consistent button styling in AlertDialog
