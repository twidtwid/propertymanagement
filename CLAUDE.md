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
| Vermont Land | Brattleboro, VT | SPAN | 081-025-11151 |
| Brooklyn PH2E | NYC | Block/Lot | 02324/1305 |
| Brooklyn PH2F | NYC | Block/Lot | 02324/1306 |
| Rhode Island House | Providence, RI | Address | 88 Williams St |
| 125 Dana Avenue | Santa Clara, CA | APN | 274-15-034 |

## Vendor Specialties

30+ categories including: hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning, fuel_oil, fireplace, insurance, auto, elevator, flooring, parking, masonry, alarm_security, and more.

See `src/types/database.ts` for `VendorSpecialty` type and `VENDOR_SPECIALTY_LABELS`.

## Important Constraints

- **Check confirmation:** Bills paid by check must track `payment_date` and `confirmation_date`. Alert if unconfirmed >14 days.
- **BuildingLink:** Brooklyn condos use BuildingLink for building management. Most messages are package notifications (noise). Surface elevator outages, maintenance, HOA notices prominently.
- **Insurance carriers:** Berkley One (Anne's properties/vehicles), GEICO (Todd's CA property/vehicles)
- **Caretaker:** Justin @ Parker Construction oversees RI and VT properties

## Detailed Rules

See modular rules for specific domains:
- @.claude/rules/database.md - Schema details, enum values, relationships
- @.claude/rules/payments.md - Payment workflow, tax schedules, confirmation logic
- @.claude/rules/security.md - Authorization details, RLS policies
