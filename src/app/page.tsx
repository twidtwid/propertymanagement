export const dynamic = 'force-dynamic'

import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatusBanner } from "@/components/dashboard/status-banner"
import { UnifiedPinnedItems } from "@/components/dashboard/unified-pinned-items"
import { UpcomingWeek } from "@/components/dashboard/upcoming-week"
import { QuickActionsBar } from "@/components/dashboard/quick-actions-bar"
import { BuildingLinkSummary } from "@/components/dashboard/buildinglink-summary"
import {
  getNewDashboardStats,
  getDashboardPinnedItems,
  getUpcomingWeek,
  getActiveProperties,
  getBuildingLinkNeedsAttention,
  getPinnedIds,
  getVendorsFiltered,
} from "@/lib/actions"

export default async function Dashboard() {
  const [
    stats,
    pinnedData,
    upcomingWeek,
    properties,
    buildingLink,
    pinnedVendorIds,
  ] = await Promise.all([
    getNewDashboardStats(),
    getDashboardPinnedItems(),
    getUpcomingWeek(),
    getActiveProperties(),
    getBuildingLinkNeedsAttention(),
    getPinnedIds('vendor'),
  ])

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

      {/* Compact Stats Row */}
      <StatsCards stats={stats} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Unified Pinned Items */}
          <UnifiedPinnedItems items={pinnedData.items} />

          {/* Coming Up (7 days) */}
          <UpcomingWeek items={upcomingWeek} />
        </div>

        <div className="space-y-6">
          {/* BuildingLink Summary */}
          {buildingLinkItems.length > 0 && (
            <BuildingLinkSummary items={buildingLinkItems} />
          )}

          {/* Quick Actions */}
          <QuickActionsBar
            properties={properties}
            pinnedVendors={pinnedVendors}
          />
        </div>
      </div>
    </div>
  )
}
