# Property Management System

A web application for managing properties, vehicles, vendors, payments, insurance, and maintenance tasks across multiple jurisdictions.

## Features

- **Dashboard** - Overview of properties, upcoming payments, urgent tasks, and quick vendor lookup
- **Properties** - Manage 10 properties across 6 jurisdictions (VT, NY, RI, CA, France, Martinique)
- **Vehicles** - Track 7 vehicles with registration and inspection dates
- **Vendors** - Directory with specialty-based lookup ("Who handles HVAC in Rhode Island?")
- **Payments** - Track bills with check confirmation workflow (Bank of America reliability issues)
- **Insurance** - Monitor policies and expiration dates
- **Maintenance** - Task tracking and shared task lists for contractors
- **BuildingLink** - Aggregated building management messages for Brooklyn condos
- **Gmail Integration** - Automatic vendor email sync and communication tracking

---

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git

### Running the Application

1. **Clone and navigate to the project:**
   ```bash
   git clone https://github.com/twidtwid/propertymanagement.git
   cd propertymanagement
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Open your browser:**
   - Application: http://localhost:3000
   - Database: localhost:5432

4. **First run:** Database auto-initializes with schema and seed data.

### Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Rebuild after code changes
docker-compose up --build

# Stop application
docker-compose down

# Reset database (deletes all data)
docker-compose down -v && docker-compose up -d
```

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start PostgreSQL separately, then:
npm run dev
```

---

## Environment Variables

Create `.env.local` for local development:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/propertymanagement

# Gmail OAuth (optional - for email sync)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Token encryption (generate with: openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_key

# Notification recipient
NOTIFICATION_EMAIL=anne@annespalter.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Users

Quick login buttons are available on the login page:

| User | Email | Role | Access |
|------|-------|------|--------|
| Anne | anne@annespalter.com | Owner | Full access |
| Todd | todd@dailey.info | Owner | Full access |
| Michael | michael@example.com | Owner | Full access |
| Amelia | amelia@example.com | Owner | Full access |
| Barbara Brady | barbara@cbiz.com | Bookkeeper | Bills & payments only |

---

## Technology Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components
- **Database:** PostgreSQL 16
- **Container:** Docker
- **Email:** Gmail API with OAuth

---

## Project Structure

```
/src
├── /app                    # Next.js App Router pages
│   ├── page.tsx            # Dashboard
│   ├── /properties         # Property management
│   ├── /vehicles           # Vehicle tracking
│   ├── /vendors            # Vendor directory
│   ├── /payments           # Bills and taxes
│   ├── /insurance          # Policies and claims
│   ├── /maintenance        # Tasks and history
│   ├── /buildinglink       # Building management messages
│   ├── /documents          # Document storage
│   ├── /reports            # Analytics
│   └── /settings           # User preferences & Gmail
├── /components             # React components
│   ├── /ui                 # shadcn/ui components
│   ├── /layout             # App shell, sidebar, header
│   ├── /dashboard          # Dashboard widgets
│   ├── /payments           # Payment components
│   └── /buildinglink       # BuildingLink components
├── /lib                    # Utilities and database
│   ├── db.ts               # PostgreSQL client
│   ├── actions.ts          # Server actions (queries)
│   ├── mutations.ts        # Server actions (mutations)
│   └── /gmail              # Gmail integration
└── /types                  # TypeScript types
    └── database.ts         # Type definitions
```

---

## Key Features Explained

### Payment Confirmation Workflow

Checks are tracked through a confirmation workflow:
1. **Pending** - Bill created, not yet paid
2. **Sent** - Payment sent (check mailed, online payment initiated)
3. **Confirmed** - Payment verified (check cashed, transaction cleared)

Payments that remain in "Sent" status for more than 14 days are flagged for Bank of America verification.

### Quick Vendor Lookup

From the dashboard, select a property and service type to instantly find the assigned vendor with contact information. Vendors are assigned to properties with specialty designations.

### Shared Task Lists

Create task lists for contractors (like Justin from Parker Construction) that can be shared via link and tracked. Items can be checked off and converted to maintenance history.

### BuildingLink Integration

The Brooklyn condos use BuildingLink for building management. The system categorizes messages:
- **Critical** - Water shutoffs, gas leaks, building emergencies
- **Important** - Elevator outages, building notices
- **Maintenance** - Scheduled work, inspections
- **Security** - Key access log events
- **Routine** - Meeting minutes, general updates
- **Noise** - Package deliveries (filtered by default)

### Gmail Sync

Automatically syncs emails from connected Gmail accounts:
- Matches emails to vendors by sender address/domain
- Stores communications for reference on vendor pages
- Runs every 10 minutes via Docker service

---

## Database

### Accessing the Database

```bash
# Connect via Docker
docker exec -it propertymanagement-db-1 psql -U postgres -d propertymanagement

# Run a query
docker exec propertymanagement-db-1 psql -U postgres -d propertymanagement -c "SELECT * FROM properties;"

# Reset database
docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement < scripts/init.sql
```

### Key Tables

| Table | Purpose |
|-------|---------|
| properties | 10 managed properties |
| vehicles | 7 vehicles with registration tracking |
| vendors | 70+ service providers |
| property_vendors | Many-to-many property/vendor assignments |
| bills | Payment tracking with confirmation workflow |
| property_taxes | Structured property tax records |
| insurance_policies | Policy tracking with expiration alerts |
| vendor_communications | Synced Gmail messages |
| shared_task_lists | Contractor task lists |

---

## Property Tax Reference

| Property | Jurisdiction | ID Type | Value |
|----------|-------------|---------|-------|
| Vermont Main House | Dummerston, VT | SPAN | 186-059-10695 |
| Booth House | Dummerston, VT | SPAN | 186-059-10098 |
| Vermont Land | Brattleboro, VT | SPAN | 081-025-11151 |
| Brooklyn PH2E | NYC | Block/Lot | 02324/1305 |
| Brooklyn PH2F | NYC | Block/Lot | 02324/1306 |
| Brooklyn Storage 44 | NYC | Block/Lot | 02324/1352 |
| Brooklyn Storage 72 | NYC | Block/Lot | 02324/1380 |
| Rhode Island House | Providence, RI | Address | 88 Williams St |
| 125 Dana Avenue | Santa Clara, CA | APN | 274-15-034 |

### Tax Lookup Resources

- **NYC:** [NYC Open Data](https://data.cityofnewyork.us/resource/8y4t-faws.json) or [Finance Portal](https://a836-pts-access.nyc.gov)
- **Providence RI:** [Tax Calculator](https://www.providenceri.gov/tax-calculator/)
- **Vermont:** [NEMRC Database](https://www.nemrc.info) or [SPAN Finder](https://tax.vermont.gov/span-finder)
- **Santa Clara CA:** [County Portal](https://santaclaracounty.telleronline.net) (use `scripts/lookup_scc_tax.py` for automation)

---

## Insurance Summary

| Carrier | Coverage |
|---------|----------|
| Berkley One | All Anne's properties (VT, Brooklyn, RI, Martinique, Paris) and vehicles (5 RI-registered) |
| GEICO | Todd's property (125 Dana Ave, San Jose) and vehicles (2 CA-registered) |

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/init.sql` | Database schema and seed data |
| `scripts/sync-emails.js` | Standalone email sync (for cron) |
| `scripts/import-emails.js` | Historical email import |
| `scripts/lookup_scc_tax.py` | Playwright automation for Santa Clara tax lookup |

---

## Docker Services

| Service | Description | Port |
|---------|-------------|------|
| app | Next.js application | 3000 |
| db | PostgreSQL database | 5432 |
| email-sync | Gmail sync (every 10 min) | - |

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v0.5.0 | Dec 2025 | BuildingLink page, vendor category cleanup, 7 new specialties |
| v0.4.0 | Dec 2025 | Daily summary reports, vendor journal |
| v0.3.0 | Dec 2025 | Gmail integration, email sync |
| v0.2.0 | Dec 2025 | Property tax tracking, vendor data import |

---

## License

Private - All rights reserved.
