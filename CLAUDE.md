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

## Claude Skills & Commands

### Skills (read-only reference)
| Skill | Purpose |
|-------|---------|
| `/test` | Run test suite |
| `/build` | Run Next.js build (check for TypeScript errors) |
| `/health` | Check production health |
| `/schema` | Database schema reference |

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

**Providers:**
| Jurisdiction | Method | Script |
|--------------|--------|--------|
| NYC | Open Data API | `src/lib/taxes/providers/nyc-open-data.ts` |
| Santa Clara CA | Playwright | `scripts/lookup_scc_tax.py` |
| Providence RI | Playwright | `scripts/lookup_providence_tax.py` |
| Vermont | Playwright | `scripts/lookup_vermont_tax.py` |

**Note:** Brooklyn condos have 421-a tax abatement (~$110-120/year actual vs API estimates). Manually update from NYC Finance bills.

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

| Property | Jurisdiction | ID Type | Value |
|----------|--------------|---------|-------|
| Vermont Main House | Dummerston, VT | SPAN | 186-059-10695 |
| Booth House | Dummerston, VT | SPAN | 186-059-10098 |
| Guest House | Dummerston, VT | SPAN | 186-059-10693 |
| Vermont Land | Brattleboro, VT | SPAN | 081-025-11151 |
| Brooklyn PH2E | NYC | Block/Lot | 02324/1305 |
| Brooklyn PH2F | NYC | Block/Lot | 02324/1306 |
| Rhode Island House | Providence, RI | Parcel | 016-0200-0000 |
| 125 Dana Avenue | Santa Clara, CA | APN | 274-15-034 |

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

### UI Components
- shadcn/ui components in `src/components/ui/`
- Most Radix primitives already installed (check package.json)
- Use `buttonVariants` for consistent button styling in AlertDialog
