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

---

## PRODUCTION ENVIRONMENT

### Server Details
| Item | Value |
|------|-------|
| Provider | DigitalOcean Droplet |
| IP Address | 143.110.229.185 |
| Domain | spmsystem.com |
| SSH User | root |
| App Directory | /root/app |

### Database
| Item | Value |
|------|-------|
| Container | app-db-1 |
| Database Name | propertymanagement |
| User | propman |
| Port | 5432 (internal) |

### Docker Containers
| Container | Purpose |
|-----------|---------|
| app-app-1 | Next.js web application |
| app-db-1 | PostgreSQL database |
| app-daily-summary-1 | Daily summary email scheduler |
| app-email-sync-1 | Gmail sync service |

### Production Commands
```bash
# SSH to production
ssh root@143.110.229.185

# View app logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"

# Database shell
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"

# Run migration
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" < scripts/migrations/XXX.sql

# Restart app
ssh root@143.110.229.185 "cd /root/app && docker compose -f docker-compose.prod.yml --env-file .env.production restart app"

# Full rebuild and deploy
ssh root@143.110.229.185 "cd /root/app && git pull && docker compose -f docker-compose.prod.yml --env-file .env.production build app && docker compose -f docker-compose.prod.yml --env-file .env.production up -d app"

# Health check
curl -s https://spmsystem.com/api/health
```

### Backup to Local
```bash
# Full database backup to local backups/ directory
ssh root@143.110.229.185 "docker exec app-db-1 pg_dump -U propman -d propertymanagement --no-owner --no-acl" > backups/backup_full_$(date +%Y%m%d_%H%M%S).sql
```

### Migrations Applied to Production
| Migration | Description | Date |
|-----------|-------------|------|
| 002 | Tax lookup system | Dec 2024 |
| 003 | Seed tax configs | Dec 2024 |
| 004 | Seed property taxes | Jan 2025 |
| 005 | Audit log | Jan 2025 |
| 006 | Tax lookup URL field | Jan 2025 |
| 007 | Property visibility | Jan 2025 |
| 008 | Dropbox schema (agreed_value, HOA fields, coverage_details) | Jan 2025 |
| 009 | Import Dropbox data (vehicles, insurance, vendors) | Jan 2025 |
| 010 | Insurance Portfolio + umbrella/auto/fine art policies | Jan 2025 |

---

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

---

## HOW: Development Patterns

### Local Development Commands
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
| Server actions (queries) | `src/lib/actions.ts` |
| Mutations | `src/lib/mutations.ts` |
| Gmail sync | `src/lib/gmail/` |
| Visibility filtering | `src/lib/visibility.ts` |
| Insurance forms | `src/components/insurance/` |

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
- CASCADE DELETE on vendor_communications FK (deleting vendor deletes all linked emails)

### Git Workflow
- Branch format: `feature/description` or `fix/description`
- Run build before committing significant changes
- Commit messages: imperative mood, explain why not what
- Use `/proddeploy` skill for production deployments

---

## FEATURE: Property Visibility

Per-property access control for sensitive properties (e.g., 125 Dana Avenue restricted to Anne + Todd).

### How It Works
- `property_visibility` table: if rows exist for a property, ONLY those users can see it
- If no rows exist, all owners can see the property (default)
- Vehicles can be linked to properties via `vehicles.property_id` and inherit visibility

### Current Configuration
| Property | Visible To |
|----------|------------|
| 125 Dana Avenue | Anne, Todd only |
| All others | All owners |

### Key Files
| Purpose | Location |
|---------|----------|
| Visibility helper | `src/lib/visibility.ts` |
| Migration | `scripts/migrations/007_property_visibility.sql` |

---

## FEATURE: Insurance Management

Full CRUD for insurance policies with detail pages and cross-linking.

### Insurance Pages
| Route | Purpose |
|-------|---------|
| `/insurance` | List all policies (tabbed: Property, Auto, Other, Claims) |
| `/insurance/[id]` | Policy detail page |
| `/insurance/[id]/edit` | Edit policy |
| `/insurance/new` | Add new policy |

### Cross-Linking
- Property detail pages show "Insurance" tab with linked policies
- Vehicle detail pages show "Insurance" section with linked policies
- Click policy row → navigate to policy detail

### Coverage Details
Insurance policies have a `coverage_details` JSONB field for line-item coverage:
```json
{
  "dwelling": 500000,
  "contents": 250000,
  "liability": 300000,
  "deductible": 5000,
  "collision": 50000,
  "comprehensive": 50000,
  "bodily_injury": 100000,
  "property_damage": 100000
}
```

### Key Files
| Purpose | Location |
|---------|----------|
| List page | `src/app/insurance/page.tsx` |
| Detail page | `src/app/insurance/[id]/page.tsx` |
| Edit page | `src/app/insurance/[id]/edit/page.tsx` |
| Form component | `src/components/insurance/policy-form.tsx` |
| Actions | `src/lib/actions.ts` (getInsurancePolicy, getInsurancePoliciesForProperty, etc.) |
| Mutations | `src/lib/mutations.ts` (updateInsurancePolicy) |

---

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

---

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

---

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

---

## Dropbox Document Sync

Automated sync of documents from Dropbox with AI-generated summaries.

### What It Does
- Scans mapped Dropbox folders for new/changed files
- Generates one-line AI summaries using Claude Haiku
- Removes summaries for deleted files
- Updates document counts for each property/vehicle

### Running Sync

```bash
# Incremental sync (new files only)
npm run dropbox:sync

# Force regenerate all summaries
npm run dropbox:sync:force

# Via API (requires CRON_SECRET)
curl -X POST "http://localhost:3000/api/cron/dropbox-sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Cron Setup (Production)

Add to crontab on production server to run every 15 minutes:

```bash
# Edit crontab
ssh root@143.110.229.185 "crontab -e"

# Add this line (runs every 15 minutes)
*/15 * * * * curl -s -X GET "http://localhost:3000/api/cron/dropbox-sync" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/dropbox-sync.log 2>&1
```

### Key Files

| Purpose | Location |
|---------|----------|
| Sync library | `src/lib/dropbox/sync.ts` |
| Cron endpoint | `src/app/api/cron/dropbox-sync/route.ts` |
| Manual endpoint | `src/app/api/dropbox/sync/route.ts` |
| CLI script | `scripts/dropbox_sync.ts` |
| Folder mappings | `dropbox_folder_mappings` table |
| File summaries | `dropbox_file_summaries` table |

### Folder Mappings

Properties and vehicles are mapped to Dropbox folders:

| Entity | Dropbox Path |
|--------|--------------|
| Rhode Island House | `/88 Williams St - Providence RI` |
| Brooklyn PH2E | `/34 N 7th St - Brooklyn` |
| Vermont (all 4) | `/Vermont` |
| Paris | `/Paris - 8 Rue Guynemer` |
| Insurance Portfolio | `/non-House-specific Insurance` |
| Vehicles | `/Vehicles/{name}` |

---

## Vendor Specialties

30+ categories including: hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning, fuel_oil, fireplace, insurance, auto, elevator, flooring, parking, masonry, alarm_security, and more.

See `src/types/database.ts` for `VendorSpecialty` type and `VENDOR_SPECIALTY_LABELS`.

---

## Important Constraints

- **Check confirmation:** Bills paid by check must track `payment_date` and `confirmation_date`. Alert if unconfirmed >14 days.
- **BuildingLink:** Brooklyn condos use BuildingLink for building management. Most messages are package notifications (noise). Surface elevator outages, maintenance, HOA notices prominently.
- **Insurance carriers:** Berkley One (Anne's properties/vehicles), GEICO (Todd's CA property/vehicles)
- **Caretaker:** Justin @ Parker Construction oversees RI and VT properties
- **CASCADE DELETE:** `vendor_communications` has ON DELETE CASCADE - deleting a vendor deletes all linked emails

---

## Logging & Audit System

### Architecture

Two-tier logging system:
1. **User Audit Log** - PostgreSQL table (`user_audit_log`) for compliance and user action tracking
2. **System Log** - Pino structured JSON logging for debugging and AI troubleshooting

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
```

---

## Claude Skills

Available skills for common operations (invoke with `/skillname`):

| Skill | Purpose |
|-------|---------|
| `/proddeploy` | Deploy code to production with version bump |
| `/backup` | Full production database backup to local |
| `/prod-logs` | View production application logs |
| `/prod-db` | Open production database shell |
| `/migrate` | Run a specific migration on production |

---

## Detailed Rules

See modular rules for specific domains:
- @.claude/rules/database.md - Schema details, enum values, relationships
- @.claude/rules/payments.md - Payment workflow, tax schedules, confirmation logic
- @.claude/rules/security.md - Authorization details, RLS policies
