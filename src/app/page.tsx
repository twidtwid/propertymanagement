export const dynamic = 'force-dynamic'

import { StatsCards } from "@/components/dashboard/stats-cards"
import { QuickContact } from "@/components/dashboard/quick-contact"
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments"
import { UrgentTasks } from "@/components/dashboard/urgent-tasks"
import { ConfirmationAlerts } from "@/components/dashboard/confirmation-alerts"
import {
  getDashboardStats,
  getActiveProperties,
  getUpcomingBills,
  getUpcomingPropertyTaxes,
  getUrgentTasks,
  getBillsNeedingConfirmation,
} from "@/lib/actions"

export default async function Dashboard() {
  const [stats, properties, bills, taxes, urgentTasks, needsConfirmation] =
    await Promise.all([
      getDashboardStats(),
      getActiveProperties(),
      getUpcomingBills(30),
      getUpcomingPropertyTaxes(90),
      getUrgentTasks(),
      getBillsNeedingConfirmation(),
    ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Welcome back. Here&apos;s what needs your attention.
        </p>
      </div>

      <StatsCards stats={stats} />

      {needsConfirmation.length > 0 && (
        <ConfirmationAlerts bills={needsConfirmation} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <UpcomingPayments bills={bills} taxes={taxes} />
          <UrgentTasks tasks={urgentTasks} />
        </div>
        <div>
          <QuickContact properties={properties} />
        </div>
      </div>
    </div>
  )
}
