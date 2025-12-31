# Gmail Integration Phase 2 Plan

**Status**: Phase 2 Core Implementation Complete (Dec 30, 2025)

## Phase 1 Summary (Completed)

### Accomplishments
1. **Gmail OAuth Connected** - Successfully connected anne@annespalter.com
2. **Email Analysis Complete** - Analyzed 48,021 emails from 2025
3. **Vendors Discovered & Added** - Found and added 12 new vendors:

| Vendor | Specialty | Email |
|--------|-----------|-------|
| SHL-NY (Smart Home Living) | A/V, Smart Home | Kameni@shl-ny.com |
| BuildingLink | Property Management | notify@buildinglink.com |
| Nest | Smart Home | notifications@nest.com |
| AKAM Property Management | Property Management | abarbul@akam.com |
| Dead River Company | Fuel Oil | noreply@deadriver.com |
| Major Air | HVAC | cody@majorair.net |
| Star Shep Insurance | Insurance | mchiappetta@starshep.com |
| Providence Water Supply Board | Water Utility | no-reply@invoicecloud.net |
| Bald Hill Dodge | Auto Service | serviceteam@baldhill.com |
| Berkley One Insurance | Insurance | berkleyone@service.berkleyone.com |
| Ward Lumber | Building Materials | marketing@wardlumber.ccsend.com |

**Professional Added:**
- Barbara Brady (CBIZ) - Bookkeeper

### Email Pattern Analysis
- **Total Emails**: 48,021
- **Unique Senders**: 3,131
- **Payment-related**: 733
- **Invoice-related**: 636
- **Confirmations**: 389
- **Renewals**: 270
- **Service**: 223
- **Scheduled/Appointments**: 212
- **Quotes/Estimates**: 85
- **Urgent**: 44

---

## Phase 2: Email Ingestion & Vendor Journal

### Goals
1. Store vendor email communications in the database
2. Display email history on vendor detail pages (Journal tab)
3. Enable real-time email sync (every 10 minutes)
4. Detect and notify on urgent emails
5. Generate daily summary digests

### Database Setup (Already Done)
The `vendor_communications` table already exists from Phase 1 setup.

### Implementation Status

| Task | Status | Notes |
|------|--------|-------|
| Email Sync Service | DONE | `src/lib/gmail/sync.ts`, `matcher.ts` |
| Sync Cron Endpoint | DONE | `/api/cron/sync-emails` (10-min polling) |
| Historical Import | DONE | `/api/gmail/import` endpoint |
| Urgent Detection | DONE | Built into sync.ts |
| Vendor Journal Tab | PENDING | UI components needed |
| Daily Summary | PENDING | Cron job and email template needed |

### Implementation Tasks

#### Task 1: Email Sync Service - COMPLETED
Created a service that:
- Fetches new emails every 10 minutes
- Matches emails to vendors by email address
- Stores matched emails in `vendor_communications` table
- Extracts key metadata (subject, date, attachments, snippets)
- Detects urgent emails by subject/body keywords

**Files Created:**
- `src/lib/gmail/sync.ts` - Email sync logic
- `src/lib/gmail/matcher.ts` - Vendor email matching
- `src/app/api/cron/sync-emails/route.ts` - Cron endpoint for Vercel
- `vercel.json` - Cron configuration (*/10 * * * *)

**Implementation Notes:**
- Using polling every 10 minutes (push notifications can be added later)
- Track last sync timestamp to avoid duplicate processing
- Process emails in batches of 50 to avoid rate limits
- Urgent email detection built into sync process

#### Task 2: Vendor Detail Page with Journal Tab - PENDING
Enhance vendor pages to show communication history.

**Files to Create/Modify:**
- `src/app/vendors/[id]/page.tsx` - Add tabbed interface
- `src/components/vendors/vendor-journal.tsx` - Email timeline component
- `src/components/vendors/email-preview.tsx` - Expandable email viewer
- `src/lib/actions.ts` - Add `getVendorCommunications()` action

**Journal Features:**
- Timeline view of emails (newest first)
- Direction indicator (inbound/outbound arrows)
- Subject and snippet preview
- Click to expand full email body
- Attachment indicators
- Filter by date range
- Search within communications

#### Task 3: Historical Email Import
One-time import of all 2025 vendor emails.

**Process:**
1. Query for all emails from known vendor addresses
2. Process in batches of 100
3. Store in `vendor_communications`
4. Show progress indicator

**Files to Create:**
- `src/app/api/gmail/import/route.ts` - Import endpoint
- `src/app/settings/gmail/page.tsx` - Add import button and progress

#### Task 4: Urgent Email Detection
Detect urgent emails and send notifications.

**Detection Criteria:**
- Subject contains: urgent, emergency, immediate, ASAP, critical
- Sender is a known vendor
- Body contains urgent keywords

**Actions:**
- Send email notification to NOTIFICATION_EMAIL
- Create alert in database
- Mark email as important

**Files to Create:**
- `src/lib/gmail/detect-urgent.ts` - Urgency detection
- `src/lib/notifications.ts` - Notification sending
- `src/components/emails/urgent-notification-template.tsx` - Email template

#### Task 5: Daily Summary
Generate and send daily property management digest.

**Summary Contents:**
- Actions taken today (payments made, tasks completed)
- Urgent items requiring attention
- Upcoming items next 7 days
- New vendor emails received

**Files to Create:**
- `src/app/api/cron/daily-summary/route.ts` - Cron job
- `src/lib/daily-summary.ts` - Summary generation
- `src/components/emails/daily-summary-template.tsx` - Email template

---

## Implementation Order

### Week 1: Core Sync
1. Create `sync.ts` and `matcher.ts`
2. Implement `import/route.ts` for historical import
3. Run historical import for all 2025 emails
4. Add import UI to settings page

### Week 2: Vendor Journal
1. Create vendor detail page with tabs
2. Implement `vendor-journal.tsx` component
3. Create `email-preview.tsx` component
4. Add `getVendorCommunications()` action

### Week 3: Notifications
1. Implement urgent detection logic
2. Create notification templates
3. Set up email sending via Gmail API
4. Add 10-minute sync cron job

### Week 4: Daily Summary
1. Create summary generation logic
2. Build summary email template
3. Set up daily cron job (8 AM)
4. Add summary preferences to settings

---

## Technical Considerations

### Email Sync Strategy
**Option A: Polling (Simple)**
- Check every 10 minutes via Vercel cron
- Query: `after:[last_sync_timestamp]`
- Pros: Simple, works everywhere
- Cons: Not real-time, might miss rapid exchanges

**Option B: Gmail Push Notifications (Better)**
- Set up Google Cloud Pub/Sub
- Gmail sends notification on new email
- Webhook triggers immediate sync
- Pros: Real-time, efficient
- Cons: More complex setup, requires Cloud project

**Recommendation**: Start with polling, add push notifications later if needed.

### Vendor Matching
Match emails to vendors using:
1. Exact email match (sender email = vendor email)
2. Domain match (sender domain = vendor email domain)
3. Name match (sender name contains vendor name)

Priority: Exact > Domain > Name

### Rate Limits
- Gmail API: 250 quota units per user per second
- List messages: 5 units
- Get message: 5 units
- Batch requests help stay within limits

### Cron Schedule (Vercel)
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-emails",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 13 * * *"
    }
  ]
}
```
Note: Schedule in UTC. 13:00 UTC = 8:00 AM EST.

---

## Files to Create

### New Files
| File | Purpose |
|------|---------|
| `src/lib/gmail/sync.ts` | Email sync logic |
| `src/lib/gmail/matcher.ts` | Vendor email matching |
| `src/lib/gmail/detect-urgent.ts` | Urgency detection |
| `src/lib/notifications.ts` | Notification triggers |
| `src/lib/daily-summary.ts` | Daily digest generation |
| `src/app/api/gmail/import/route.ts` | Historical import |
| `src/app/api/cron/sync-emails/route.ts` | Periodic sync |
| `src/app/api/cron/daily-summary/route.ts` | Daily summary |
| `src/app/vendors/[id]/page.tsx` | Vendor detail with tabs |
| `src/components/vendors/vendor-journal.tsx` | Email timeline |
| `src/components/vendors/email-preview.tsx` | Email viewer |
| `src/components/emails/urgent-template.tsx` | Urgent notification |
| `src/components/emails/summary-template.tsx` | Daily summary |

### Files to Modify
| File | Changes |
|------|---------|
| `src/lib/actions.ts` | Add vendor communication queries |
| `src/app/settings/gmail/page.tsx` | Add import button |
| `vercel.json` | Add cron configuration |

---

## Next Steps

1. Review and approve this Phase 2 plan
2. Start with Task 1: Email Sync Service
3. Run historical import once sync is working
4. Build vendor journal UI
5. Add notifications and daily summary

Ready to proceed with implementation when approved.
