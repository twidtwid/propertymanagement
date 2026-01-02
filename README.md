# Property Management System

A web application for managing properties, vehicles, vendors, payments, insurance, and maintenance tasks across multiple jurisdictions.

## Features

- **Dashboard** - Overview of properties, upcoming payments, urgent tasks, and quick vendor lookup
- **Properties** - Manage 10 properties across 6 jurisdictions (VT, NY, RI, CA, France, Martinique)
- **Vehicles** - Track 7 vehicles with registration and inspection dates
- **Vendors** - Directory with specialty-based lookup ("Who handles HVAC in Rhode Island?")
- **Payments** - Track bills with check confirmation workflow
- **Insurance** - Full policy management with coverage details and expiration tracking
- **Maintenance** - Task tracking and shared task lists for contractors
- **BuildingLink** - Aggregated building management messages for Brooklyn condos
- **Gmail Integration** - Automatic vendor email sync and communication tracking
- **Dropbox Integration** - Document browsing with AI-generated summaries and QuickLook previews

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
docker-compose up -d

# Open http://localhost:3000
```

Database auto-initializes with schema and seed data on first run.

### Common Commands

```bash
docker-compose up -d           # Start all services
docker-compose logs -f app     # View app logs
docker-compose down            # Stop all services
docker-compose down -v         # Stop and reset database
```

---

## Production

### Server Details

| | |
|-|-|
| **Domain** | spmsystem.com |
| **Server** | DigitalOcean Droplet (143.110.229.185) |
| **SSH** | `ssh root@143.110.229.185` |
| **App Dir** | /root/app |

### Quick Production Commands

```bash
# Deploy latest code
ssh root@143.110.229.185 "cd /root/app && git pull && \
  docker compose -f docker-compose.prod.yml --env-file .env.production build app && \
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d app"

# View logs
ssh root@143.110.229.185 "docker logs app-app-1 --tail 100"

# Database shell
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"

# Health check
curl -s https://spmsystem.com/api/health

# Full backup to local machine
ssh root@143.110.229.185 "docker exec app-db-1 pg_dump -U propman -d propertymanagement --no-owner --no-acl" \
  > backups/backup_full_$(date +%Y%m%d_%H%M%S).sql
```

### Running Migrations

```bash
# Run a migration on production
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" \
  < scripts/migrations/XXX_migration_name.sql
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

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **Database:** PostgreSQL 16
- **Deployment:** Docker, DigitalOcean
- **Email:** Gmail API with OAuth

---

## Project Structure

```
src/
├── app/                    # Next.js pages
│   ├── page.tsx           # Dashboard
│   ├── properties/        # Property management
│   ├── vehicles/          # Vehicle tracking
│   ├── vendors/           # Vendor directory
│   ├── payments/          # Bills and taxes
│   ├── insurance/         # Policy management
│   └── ...
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...
├── lib/                   # Utilities
│   ├── actions.ts        # Server actions (queries)
│   ├── mutations.ts      # Server actions (writes)
│   ├── db.ts             # Database client
│   └── gmail/            # Gmail integration
└── types/                 # TypeScript types

scripts/
├── init.sql              # Database schema
├── migrations/           # Database migrations
└── *.py                  # Tax lookup scrapers
```

---

## Key Features

### Payment Confirmation Workflow

Checks are tracked: Pending → Sent → Confirmed

Payments in "Sent" status for over 14 days are flagged (Bank of America reliability tracking).

### Property Visibility

Some properties (e.g., 125 Dana Avenue) are restricted to specific users. The `property_visibility` table controls who can see each property.

### Insurance Management

Full CRUD for insurance policies:
- Policy detail pages with coverage breakdown
- Property and vehicle pages show linked policies
- Expiration tracking with alerts

### Tax Automation

Automated scrapers fetch property tax data from:
- NYC Open Data API
- Santa Clara County
- Providence, RI
- Vermont (NEMRC)

### Dropbox Document Integration

- Browse documents from mapped Dropbox folders
- AI-generated one-line summaries for each file (Claude Haiku)
- QuickLook-style previews for images and PDFs
- Document counts displayed on property/vehicle pages
- Automated sync every 15 minutes via cron

---

## Environment Variables

Create `.env.local` for local development:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/propertymanagement

# Gmail OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Token encryption (openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_key

NOTIFICATION_EMAIL=anne@annespalter.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Dropbox OAuth (optional)
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_REDIRECT_URI=http://localhost:3000/api/auth/dropbox/callback

# Cron authentication (openssl rand -hex 32)
CRON_SECRET=your_cron_secret
```

---

## Backup & Restore

### Create Backup

```bash
# From production to local
ssh root@143.110.229.185 "docker exec app-db-1 pg_dump -U propman -d propertymanagement --no-owner --no-acl" \
  > backups/backup_full_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Backup

```bash
# To local dev
docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement < backups/backup_file.sql

# To production (careful!)
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" < backups/backup_file.sql
```

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v0.3.0 | Jan 2026 | Dropbox document browser with AI summaries, QuickLook previews, automated 15-min sync |
| v0.2.0 | Jan 2026 | Insurance detail/edit pages, property visibility, Dropbox data import |
| v0.1.1 | Jan 2026 | Worker container fixes, health check improvements |
| v0.1.0 | Dec 2025 | Initial production deployment |

---

## Claude Code Integration

This project uses Claude Code for AI-assisted development. Key resources:

- `CLAUDE.md` - AI-optimized project context and commands
- `.claude/rules/` - Domain-specific rules (database, payments, security)
- `.claude/skills/` - Automated workflows (deploy, backup, etc.)

### Available Skills

| Command | Description |
|---------|-------------|
| `/proddeploy` | Deploy to production with version bump |
| `/backup` | Full database backup from prod |
| `/prod-logs` | View production logs |
| `/prod-db` | Open production database shell |
| `/migrate` | Run migration on production |

---

## License

Private - All rights reserved.
