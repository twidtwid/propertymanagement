# Property Management System

A web application for managing properties, vehicles, vendors, payments, insurance, and maintenance tasks.

## Features

- **Dashboard** - Overview of properties, upcoming payments, urgent tasks, and quick vendor lookup
- **Properties** - Manage 10+ properties across multiple jurisdictions (VT, NY, RI, CA, France, Martinique)
- **Vehicles** - Track 7 vehicles with registration and inspection dates
- **Vendors** - Directory with specialty-based lookup ("Who do I call for HVAC in Rhode Island?")
- **Payments** - Track bills with check confirmation workflow (Bank of America reliability)
- **Insurance** - Monitor policies and expiration dates across all properties and vehicles
- **Maintenance** - Task tracking and shared task lists for contractors

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git

### Running the Application

1. **Clone and navigate to the project:**
   ```bash
   cd propertymanagement
   ```

2. **Start the application:**
   ```bash
   docker-compose up
   ```

3. **Open your browser:**
   - Application: http://localhost:3000
   - Database runs on port 5432

4. **First run:** The database will be automatically initialized with the schema and seed data.

### Development

To rebuild after making changes:
```bash
docker-compose up --build
```

To stop the application:
```bash
docker-compose down
```

To reset the database (deletes all data):
```bash
docker-compose down -v
docker-compose up
```

## Users (Development)

Quick login buttons are available on the login page:

| User | Role | Access |
|------|------|--------|
| Anne | Owner | Full access |
| Todd | Owner | Full access |
| Michael | Owner | Full access |
| Amelia | Owner | Full access |
| Barbara Brady (CBIZ) | Bookkeeper | Bills & payments only |

## Technology Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components
- **Database:** PostgreSQL 16
- **Container:** Docker

## Project Structure

```
/src
├── /app                 # Next.js App Router pages
│   ├── page.tsx         # Dashboard
│   ├── /properties      # Property management
│   ├── /vehicles        # Vehicle tracking
│   ├── /vendors         # Vendor directory
│   ├── /payments        # Bills and taxes
│   ├── /insurance       # Policies and claims
│   ├── /maintenance     # Tasks and history
│   ├── /documents       # Document storage
│   ├── /reports         # Analytics
│   └── /settings        # User preferences
├── /components          # React components
│   ├── /ui              # shadcn/ui components
│   ├── /layout          # App shell, sidebar, header
│   └── /dashboard       # Dashboard widgets
├── /lib                 # Utilities and database
└── /types               # TypeScript types
```

## Key Features

### Payment Confirmation Workflow
Checks are tracked from "sent" to "confirmed" status. Payments that haven't been confirmed within 14 days are flagged for Bank of America verification.

### Quick Vendor Lookup
Select a property and service type to instantly find the assigned vendor with contact information.

### Shared Task Lists
Create task lists for contractors (like Justin from Parker Construction) that can be shared and tracked.

## Environment Variables

Create `.env.local` for local development:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/propertymanagement
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## License

Private - All rights reserved.
