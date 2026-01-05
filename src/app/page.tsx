export const dynamic = 'force-dynamic'

import { StatusBanner } from "@/components/dashboard/status-banner"
import { UnifiedPinnedItems } from "@/components/dashboard/unified-pinned-items"
import { NeedsReview } from "@/components/dashboard/needs-review"
import { UpcomingWeek } from "@/components/dashboard/upcoming-week"
import { QuickActionsBar } from "@/components/dashboard/quick-actions-bar"
import { BuildingLinkSummary } from "@/components/dashboard/buildinglink-summary"
import { EmailInboxSummary } from "@/components/dashboard/email-inbox-summary"
import { AutoPayConfirmations } from "@/components/dashboard/autopay-confirmations"
import { UpcomingAutopays } from "@/components/dashboard/upcoming-autopays"
import {
  getDashboardPinnedItems,
  getUpcomingWeek,
  getActiveProperties,
  getBuildingLinkNeedsAttention,
  getPinnedIds,
  getVendorsFiltered,
  getPendingPaymentSuggestions,
  getRecentAutoPayConfirmations,
  getUpcomingAutopays,
} from "@/lib/actions"
import { query } from "@/lib/db"

export default async function Dashboard() {
  const [
    pinnedData,
    upcomingWeek,
    properties,
    buildingLink,
    pinnedVendorIds,
    paymentSuggestions,
    autoPayConfirmations,
    upcomingAutopays,
    recentEmailsRaw,
  ] = await Promise.all([
    getDashboardPinnedItems(),
    getUpcomingWeek(),
    getActiveProperties(),
    getBuildingLinkNeedsAttention(),
    getPinnedIds('vendor'),
    getPendingPaymentSuggestions(),
    getRecentAutoPayConfirmations(7, 10),
    getUpcomingAutopays(7, 10),
    query<{
      id: string
      vendor_name: string | null
      subject: string
      received_at: string
      is_important: boolean
      body_snippet: string | null
      body_html: string | null
    }>(`
      SELECT vc.id, v.name as vendor_name, vc.subject, vc.received_at, vc.is_important, vc.body_snippet, vc.body_html
      FROM vendor_communications vc
      INNER JOIN vendors v ON vc.vendor_id = v.id
      WHERE vc.received_at >= CURRENT_DATE - 7
        AND vc.direction = 'inbound'
        AND NOT (v.specialties = ARRAY['other']::vendor_specialty[])
        AND v.name != 'BuildingLink'
        AND NOT (vc.labels && ARRAY['CATEGORY_PROMOTIONS', 'SPAM']::text[])
      ORDER BY vc.received_at DESC
      LIMIT 15
    `),
  ])

  // Get email IDs that are already in payment suggestions
  const suggestionEmailIds = new Set(
    paymentSuggestions
      .filter(s => s.email_id)
      .map(s => s.email_id)
  )

  // Filter out emails that are already suggestions, those go in the "Needs Review" section
  const otherEmails = recentEmailsRaw
    .filter(e => !suggestionEmailIds.has(e.id))
    .map((e) => ({
      vendorName: e.vendor_name,
      subject: e.subject || "(No subject)",
      receivedAt: e.received_at,
      isUrgent: e.is_important,
      snippet: e.body_snippet || undefined,
      bodyHtml: e.body_html || undefined,
    }))

  // Get pinned vendors for quick actions
  const pinnedVendors = pinnedVendorIds.size > 0
    ? await getVendorsFiltered({ search: '' }).then(vendors =>
        vendors.filter(v => pinnedVendorIds.has(v.id))
      )
    : []

  // Transform BuildingLink data for the summary component
  const buildingLinkItems: Array<{ type: "outage" | "package" | "flagged"; subject: string; unit: string; receivedAt: string; snippet?: string }> = [
    ...buildingLink.activeOutages.map((item) => ({
      type: "outage" as const,
      subject: item.subject || "Service Outage",
      unit: item.unit || "",
      receivedAt: item.received_at,
      snippet: item.body_snippet || undefined,
    })),
    ...buildingLink.uncollectedPackages.map((item) => ({
      type: "package" as const,
      subject: item.subject || "Package",
      unit: item.unit || "",
      receivedAt: item.received_at,
      snippet: item.body_snippet || undefined,
    })),
    ...buildingLink.flaggedMessages.map((item) => ({
      type: "flagged" as const,
      subject: item.subject || "Flagged Item",
      unit: item.unit || "",
      receivedAt: item.received_at,
      snippet: item.body_snippet || undefined,
    })),
  ]

  // Find next due item for "All Clear" message
  const nextDue = upcomingWeek[0]
  const nextDueDate = nextDue
    ? nextDue.daysUntil === 0
      ? "today"
      : nextDue.daysUntil === 1
      ? "tomorrow"
      : `in ${nextDue.daysUntil} days`
    : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Welcome back. Here&apos;s what needs your attention.
        </p>
      </div>

      {/* Status Banner - most prominent */}
      <StatusBanner
        overdueCount={pinnedData.stats.overdueCount}
        urgentCount={pinnedData.stats.urgentCount}
        hasItems={pinnedData.stats.totalCount > 0}
        nextDueDate={nextDueDate}
        nextDueDescription={nextDue?.title}
      />

      {/* Quick Actions & BuildingLink - top priority, Quick Actions first on mobile */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions - first on mobile */}
        <QuickActionsBar
          properties={properties}
          pinnedVendors={pinnedVendors}
        />

        {/* BuildingLink Summary - second on mobile */}
        {buildingLinkItems.length > 0 && (
          <BuildingLinkSummary items={buildingLinkItems} />
        )}
      </div>


      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Unified Pinned Items - exclude vendors (they're already in quick actions) */}
          <UnifiedPinnedItems items={pinnedData.items.filter(item => item.entityType !== 'vendor')} />

          {/* Needs Review - emails that may need payment tracking */}
          <NeedsReview suggestions={paymentSuggestions} />

          {/* Coming Up (7 days) */}
          <UpcomingWeek items={upcomingWeek} />

          {/* Other Vendor Emails */}
          <EmailInboxSummary suggestions={[]} otherEmails={otherEmails} />
        </div>

        <div className="space-y-6">
          {/* Upcoming Autopays - heads up about payments coming soon */}
          <UpcomingAutopays autopays={upcomingAutopays} />

          {/* Auto-Pay Confirmations */}
          <AutoPayConfirmations confirmations={autoPayConfirmations} />
        </div>
      </div>
    </div>
  )
}
