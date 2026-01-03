# Property Management System

A web application for managing properties, vehicles, vendors, payments, insurance, and maintenance tasks across multiple jurisdictions.

## Features

- **Dashboard** - Overview with upcoming payments, urgent tasks, and quick vendor lookup
- **Properties** - Manage 10 properties across 6 jurisdictions (VT, NY, RI, CA, France, Martinique)
- **Vehicles** - Track 7 vehicles with registration, inspection, and insurance
- **Vendors** - Directory with specialty-based lookup ("Who handles HVAC in Rhode Island?")
- **Payments** - Track bills with check confirmation workflow (pending → sent → confirmed)
- **Insurance** - Full policy management with coverage details and expiration alerts
- **Maintenance** - Task tracking and shared task lists for contractors
- **Documents** - Dropbox integration with AI-generated summaries and QuickLook previews
- **BuildingLink** - Aggregated building management messages for Brooklyn condos
- **Gmail Integration** - Automatic vendor email sync and communication tracking
- **Calendar** - Multi-view calendar (month, week, day) with all due dates

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Running Locally

```bash
# Clone the repository
git clone https://github.com/twidtwid/propertymanagement.git
cd propertymanagement

# Start everything
docker compose up -d

# Open http://localhost:3000
```

Database auto-initializes with schema and seed data on first run.

### Common Commands

```bash
docker compose up -d           # Start all services
docker compose logs -f app     # View app logs
docker compose down            # Stop all services
docker compose exec app npm run test:run  # Run tests
```

---

## Production

| | |
|-|-|
| **Domain** | spmsystem.com |
| **Server** | DigitalOcean Droplet (143.110.229.185) |
| **SSH** | `ssh root@143.110.229.185` |

### Quick Production Commands

```bash
# Health check
curl -s https://spmsystem.com/api/health

# View logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"

# Database shell
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"

# Backup database
ssh root@143.110.229.185 "docker exec app-db-1 pg_dump -U propman -d propertymanagement --no-owner --no-acl" \
  > backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Docker Containers

| Container | Purpose |
|-----------|---------|
| app-app-1 | Next.js web application |
| app-db-1 | PostgreSQL database |
| app-daily-summary-1 | Daily email scheduler |
| app-email-sync-1 | Gmail sync service |

---

## Users

Authentication uses magic links (passwordless email).

| User | Role | Access |
|------|------|--------|
| Anne | Owner | Full access |
| Todd | Owner | Full access |
| Michael | Owner | Full access |
| Amelia | Owner | Full access |
| Barbara Brady | Bookkeeper | Bills & payments only |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui components |
| Database | PostgreSQL 16 |
| Deployment | Docker, DigitalOcean |
| Email | Gmail API with OAuth |
| Documents | Dropbox API with OAuth |
| AI Summaries | Claude Haiku |

---

## Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── page.tsx           # Dashboard
│   ├── properties/        # Property management
│   ├── vehicles/          # Vehicle tracking
│   ├── vendors/           # Vendor directory
│   ├── payments/          # Bills and taxes
│   ├── insurance/         # Policy management
│   ├── documents/         # Dropbox browser
│   ├── calendar/          # Multi-view calendar
│   ├── buildinglink/      # Building messages
│   ├── reports/           # Analytics and reports
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── {feature}/        # Feature-specific components
├── lib/                   # Business logic
│   ├── actions.ts        # Server actions (reads)
│   ├── mutations.ts      # Server actions (writes)
│   ├── gmail/            # Gmail integration
│   ├── dropbox/          # Dropbox integration
│   └── taxes/            # Tax lookup system
└── types/                # TypeScript definitions

scripts/
├── init.sql              # Database schema
├── migrations/           # Database migrations (002-016)
├── fast-deploy.sh        # Production deployment
└── *.py                  # Tax lookup scrapers
```

---

## Key Features

### Payment Confirmation Workflow

Tracks checks through: **Pending → Sent → Confirmed**

Payments in "Sent" status for over 14 days are flagged (Bank of America reliability tracking).

### Property Visibility

Some properties (e.g., 125 Dana Avenue) are restricted to specific users via the `property_visibility` table.

### Insurance Management

- Full CRUD for insurance policies
- Coverage breakdown with line-item details
- Cross-linked with properties and vehicles
- Expiration tracking with alerts
- Separate document sections for property-specific and portfolio-wide docs

### Tax Automation

Automated scrapers fetch property tax data from:
- NYC Open Data API (Brooklyn)
- Santa Clara County (California)
- Providence, RI (City Hall)
- Vermont (NEMRC)

### Document Integration

- Browse documents from mapped Dropbox folders
- AI-generated one-line summaries (Claude Haiku)
- QuickLook-style previews for images and PDFs
- Document counts on property/vehicle pages
- Automated sync every 15 minutes

---

## Environment Variables

Create `.env.local` for local development:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/propertymanagement

# Gmail OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Dropbox OAuth (optional)
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_REDIRECT_URI=http://localhost:3000/api/auth/dropbox/callback

# Token encryption (openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_key

# Cron authentication
CRON_SECRET=your_cron_secret

NOTIFICATION_EMAIL=your@email.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Automated Jobs

### Production Cron Schedule

| Schedule | Task |
|----------|------|
| Every 15 min | Dropbox sync (AI summaries) |
| 3 AM daily | Database backup |
| 6 AM daily | Disk space check |
| Sunday 4 AM | Docker image cleanup |

---

## Version History

| Version | Highlights |
|---------|------------|
| v0.6.x | Dropbox integration with AI summaries, insurance document mapping, document section labels |
| v0.5.x | Vendor contacts system, maintenance task actions, clickable notifications |
| v0.4.x | Security hardening, testing infrastructure |
| v0.3.x | Dropbox document browser, QuickLook previews |
| v0.2.x | Insurance detail pages, property visibility |
| v0.1.x | Initial production deployment |

---

## Claude Code Integration

This project uses Claude Code for AI-assisted development.

### Available Commands

| Command | Description |
|---------|-------------|
| `/deploy` | Deploy to production (tests, version bump, commit, deploy) |
| `/backup` | Full database backup from production |
| `/prod-logs` | View production logs |
| `/prod-db` | Open production database shell |
| `/migrate` | Run migration on production |
| `/test` | Run test suite |
| `/build` | Check TypeScript compilation |
| `/health` | Check production health |
| `/schema` | Database schema reference |

### Key Files

- `CLAUDE.md` - AI-optimized project context
- `.claude/rules/` - Domain-specific rules (database, payments, security)
- `.claude/commands/` - Automated workflows
- `.claude/skills/` - Quick reference skills

---

## License

Private - All rights reserved.
