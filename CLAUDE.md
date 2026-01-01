# Property Management System

## WHAT: Project Context

Personal property management app for Anne managing 10 properties across 6 jurisdictions plus 7 vehicles.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind + shadcn/ui, PostgreSQL (Docker), Gmail OAuth

**Users:**
- Owners (full access): Anne, Todd, Michael, Amelia
- Bookkeeper (bills/payments only): Barbara Brady @ CBIZ

**Assets:**
- 10 properties: 4 Vermont, 2 Brooklyn condos, RI house, Martinique, Paris, San Jose
- 7 vehicles: 5 RI-registered (Anne), 2 CA-registered (Todd)
- 70+ vendors organized by specialty and location

## WHY: Business Requirements

**CRITICAL - Never miss:**
1. Property tax payments (quarterly/semi-annual across 6 jurisdictions)
2. Insurance policy renewals (Berkley One, GEICO)
3. Check confirmation - Bank of America has reliability issues; flag unconfirmed checks >14 days

**Core Workflows:**
- Quick vendor lookup: "Who handles HVAC in Rhode Island?" → Select property + specialty
- Payment confirmation: pending → sent → confirmed (track days waiting)
- BuildingLink message triage: Filter noise (packages) from important (elevator outages, maintenance)
- Shared task lists for contractors (Justin @ Parker Construction manages RI + VT)

**Mobile-first:** All interfaces optimized for iPhone. Large touch targets, simple navigation.

## HOW: Development Patterns

### Commands
```bash
docker compose up -d          # Start app + database
docker compose logs -f app    # View app logs
npm run dev                   # Local dev (if not using Docker)
```

### Key Files
| Purpose | Location |
|---------|----------|
| Database schema | `scripts/init.sql` |
| TypeScript types | `src/types/database.ts` |
| Server actions | `src/lib/actions.ts` |
| Mutations | `src/lib/mutations.ts` |
| Gmail sync | `src/lib/gmail/` |

### Code Conventions
- Server Components by default, "use client" only when needed
- Server Actions for data mutations (no API routes)
- Use `date-fns` for date formatting
- Icons from `lucide-react`
- Forms with `react-hook-form` + `zod` validation

### Database Patterns
- PostgreSQL enums for constrained values (see @.claude/rules/database.md)
- UUID primary keys via `gen_random_uuid()`
- `updated_at` triggers on all mutable tables
- Cast integers in date arithmetic: `CURRENT_DATE + ($1::INTEGER)`

### Git Workflow
- Branch format: `feature/description` or `fix/description`
- Run build before committing significant changes
- Commit messages: imperative mood, explain why not what

### Local Tools (User Homebrew)

The system homebrew (`/opt/homebrew`) is for work - don't touch it. Use the local user homebrew for this project:

```bash
# Local homebrew location
~/homebrew/bin/brew

# Install packages
~/homebrew/bin/brew install <package>
```

**Installed Python packages** (via pip3 --user):
- `pymupdf` - PDF text extraction (import as `fitz`)

```python
# Extract text from PDF
import fitz
doc = fitz.open("file.pdf")
text = doc[0].get_text()  # First page
```

## Authorization Matrix

| Resource | Owner | Bookkeeper |
|----------|-------|-----------|
| Properties | Full CRUD | No access |
| Vehicles | Full CRUD | No access |
| Vendors | Full CRUD | View only |
| Bills/Payments | Full CRUD | Full CRUD |
| Insurance | Full CRUD | View only |
| Reports | Full access | No access |
| Settings | Full access | No access |

Bookkeeper access enforced via middleware restricting routes to: `/`, `/payments/**`, `/settings` (profile only)

## Property Tax Identifiers

| Property | Jurisdiction | ID Type | Value |
|----------|-------------|---------|-------|
| Vermont Main House | Dummerston, VT | SPAN | 186-059-10695 |
| Booth House | Dummerston, VT | SPAN | 186-059-10098 |
| Guest House | Dummerston, VT | SPAN | 186-059-10693 |
| Vermont Land | Brattleboro, VT | SPAN | 081-025-11151 |
| Brooklyn PH2E | NYC | Block/Lot | 02324/1305 |
| Brooklyn PH2F | NYC | Block/Lot | 02324/1306 |
| Rhode Island House | Providence, RI | Parcel | 016-0200-0000 |
| 125 Dana Avenue | Santa Clara, CA | APN | 274-15-034 |

## Automated Property Tax Lookup System

### Overview
Automated weekly sync of property tax data from government sources. Data feeds into the calendar and payments page.

### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    TAX LOOKUP SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│  Web App (Serverless)              External Scripts (Playwright) │
│  ├── NYC Open Data API  ────────►  ├── Santa Clara County       │
│  └── /api/cron/sync-taxes          ├── Providence (City Hall)   │
│                                    └── Vermont (NEMRC)          │
│                    │                          │                  │
│                    └──────────┬───────────────┘                  │
│                               ▼                                  │
│                    /api/taxes/sync/callback                      │
│                               │                                  │
│                               ▼                                  │
│           ┌─────────────────────────────────────┐                │
│           │  tax_lookup_results (audit)         │                │
│           │  property_taxes (calendar/payments) │                │
│           └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Providers & Scripts

| Provider | Method | Script | Automated? |
|----------|--------|--------|------------|
| NYC (Brooklyn) | Open Data API | `src/lib/taxes/providers/nyc-open-data.ts` | ⚠️ See note |
| Santa Clara, CA | Playwright | `scripts/lookup_scc_tax.py` | ✅ Weekly cron |
| Providence, RI | Playwright | `scripts/lookup_providence_tax.py` | ✅ Weekly cron |
| Vermont (Dummerston) | Playwright | `scripts/lookup_vermont_tax.py` | ✅ Weekly cron |
| Vermont (Brattleboro) | AxisGIS | Manual | ❌ Manual |

**⚠️ NYC 421-a Tax Abatement:** The Brooklyn condos (PH2E, PH2F) have 421-a tax abatements through 2036. The Open Data API returns assessed values, NOT actual tax bills. The abatement reduces annual taxes to ~$110-120/year (not the thousands the API would estimate). These values are stored in `init.sql` and should be updated manually from actual NYC Finance bills. The API sync is disabled for these properties - taxes are annual (1 installment due July 1st).

### Running Tax Sync

```bash
# Run all scrapers (dry run - shows what would be synced)
npm run tax:sync

# Run all scrapers and post to local app
npm run tax:sync:live

# Individual providers
npm run tax:sync:scc         # Santa Clara County
npm run tax:sync:providence  # Providence RI
npm run tax:sync:vermont     # Vermont (Dummerston)

# NYC syncs via web app API
curl -X POST http://localhost:3000/api/cron/sync-taxes
```

### Weekly Cron Setup

Add to crontab (macOS/Linux):
```bash
# Run tax sync every Monday at 6 AM (ensure app is running)
0 6 * * 1 cd /Users/toddhome/repo/propertymanagement && python3 scripts/sync_all_taxes.py --callback http://localhost:3000/api/taxes/sync/callback >> /tmp/tax-sync.log 2>&1
```

### Database Tables

- `tax_lookup_configs` - Per-property lookup configuration (provider, params)
- `tax_lookup_results` - Raw sync results with full data for debugging
- `tax_sync_log` - Audit log of all sync attempts
- `property_taxes` - Payment entries shown on calendar/payments page

### Key Files

| Purpose | Location |
|---------|----------|
| Tax types | `src/lib/taxes/types.ts` |
| Sync orchestration | `src/lib/taxes/sync.ts` |
| Sync to payments | `src/lib/taxes/sync-to-payments.ts` |
| NYC provider | `src/lib/taxes/providers/nyc-open-data.ts` |
| Callback endpoint | `src/app/api/taxes/sync/callback/route.ts` |
| Cron endpoint | `src/app/api/cron/sync-taxes/route.ts` |
| Master runner | `scripts/sync_all_taxes.py` |
| SCC scraper | `scripts/lookup_scc_tax.py` |
| Providence scraper | `scripts/lookup_providence_tax.py` |
| Vermont scraper | `scripts/lookup_vermont_tax.py` |
| Seed configs | `scripts/migrations/003_seed_tax_configs.sql` |
| Seed payments | `scripts/migrations/004_seed_property_taxes.sql` |

## Vendor Specialties

30+ categories including: hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning, fuel_oil, fireplace, insurance, auto, elevator, flooring, parking, masonry, alarm_security, and more.

See `src/types/database.ts` for `VendorSpecialty` type and `VENDOR_SPECIALTY_LABELS`.

## Important Constraints

- **Check confirmation:** Bills paid by check must track `payment_date` and `confirmation_date`. Alert if unconfirmed >14 days.
- **BuildingLink:** Brooklyn condos use BuildingLink for building management. Most messages are package notifications (noise). Surface elevator outages, maintenance, HOA notices prominently.
- **Insurance carriers:** Berkley One (Anne's properties/vehicles), GEICO (Todd's CA property/vehicles)
- **Caretaker:** Justin @ Parker Construction oversees RI and VT properties

## Logging & Audit System

### Architecture

Two-tier logging system:
1. **User Audit Log** - PostgreSQL table (`user_audit_log`) for compliance and user action tracking
2. **System Log** - Pino structured JSON logging for debugging and AI troubleshooting

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ API Routes   │  │ Server       │  │ Cron Jobs              │ │
│  │ (withLogging)│  │ Actions      │  │                        │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
│         │                 │                      │              │
│         └────────────┬────┴──────────────────────┘              │
│                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              REQUEST CONTEXT (AsyncLocalStorage)            ││
│  │   requestId | userId | userEmail | path | ip | userAgent   ││
│  └─────────────────────────────────────────────────────────────┘│
│                      │                                          │
│         ┌────────────┴────────────┐                             │
│         ▼                         ▼                             │
│  ┌─────────────────┐    ┌─────────────────────┐                 │
│  │   PINO LOGGER   │    │   AUDIT SERVICE     │                 │
│  │ (structured)    │    │ (user_audit_log)    │                 │
│  └────────┬────────┘    └──────────┬──────────┘                 │
│           │                        │                            │
└───────────┼────────────────────────┼────────────────────────────┘
            ▼                        ▼
    Console/stdout           PostgreSQL
```

### Key Files

| Purpose | Location |
|---------|----------|
| Core Pino logger | `src/lib/logger/index.ts` |
| Request context | `src/lib/logger/context.ts` |
| Context-aware helper | `src/lib/logger/contextual.ts` |
| Audit service | `src/lib/logger/audit.ts` |
| API route wrapper | `src/lib/logger/api-wrapper.ts` |
| Server action wrapper | `src/lib/logger/action-wrapper.ts` |
| Database migration | `scripts/migrations/005_audit_log.sql` |

### Usage

**In API routes:**
```typescript
import { withLogging } from "@/lib/logger/api-wrapper"
import { getLogger } from "@/lib/logger/contextual"

export const POST = withLogging(async (request) => {
  const log = getLogger("api.banking")
  log.info("Processing request", { data: "..." })
  // ... handler code
})
```

**In server actions/mutations:**
```typescript
import { getLogger } from "@/lib/logger/contextual"
import { audit } from "@/lib/logger/audit"

export async function createProperty(data) {
  const log = getLogger("mutations.property")
  log.info("Creating property", { name: data.name })

  // ... create property

  await audit({
    action: "create",
    entityType: "property",
    entityId: property.id,
    entityName: property.name,
  })
}
```

### Audit Log Queries

```sql
-- User activity this week
SELECT created_at, action, entity_type, entity_name, user_email
FROM user_audit_log
WHERE user_id = 'user-uuid'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Bill history
SELECT created_at, action, changes, user_email
FROM user_audit_log
WHERE entity_type = 'bill' AND entity_id = 'bill-uuid'
ORDER BY created_at;

-- Trace a request
SELECT * FROM user_audit_log
WHERE request_id = 'request-uuid';
```

### Audit Actions

Standard action types: `create`, `update`, `delete`, `login`, `logout`, `confirm`, `mark_paid`, `import`, `export`

All mutations in `src/lib/mutations.ts` are instrumented with audit logging.

## Detailed Rules

See modular rules for specific domains:
- @.claude/rules/database.md - Schema details, enum values, relationships
- @.claude/rules/payments.md - Payment workflow, tax schedules, confirmation logic
- @.claude/rules/security.md - Authorization details, RLS policies
