"use server"

import { query } from "./db"
import type { Bill, PropertyTax, InsurancePolicy, MaintenanceTask, Vehicle } from "@/types/database"
import { formatCurrency, formatDate, daysUntil } from "./utils"
import { getBuildingLinkNeedsAttention, type NeedsAttentionItems, type BuildingLinkMessage } from "./actions"

export interface BuildingLinkSummaryItem {
  type: "outage" | "package" | "flagged"
  subject: string
  unit: string
  receivedAt: string
  snippet?: string
}

export interface DailySummaryData {
  date: string
  urgentItems: UrgentItem[]
  upcomingItems: UpcomingItem[]
  recentEmails: EmailSummary[]
  buildingLinkItems: BuildingLinkSummaryItem[]
  stats: SummaryStats
}

export interface UrgentItem {
  type: "payment_overdue" | "check_unconfirmed" | "insurance_expiring" | "registration_expired" | "inspection_overdue" | "urgent_email" | "building_outage"
  title: string
  description: string
  daysOverdue?: number
  amount?: number
  link?: string
}

export interface UpcomingItem {
  type: "bill_due" | "tax_due" | "insurance_expiring" | "registration_due" | "maintenance_due"
  title: string
  description: string
  dueDate: string
  daysUntil: number
  amount?: number
  link?: string
}

export interface EmailSummary {
  vendorName: string | null
  subject: string
  receivedAt: string
  isUrgent: boolean
}

export interface SummaryStats {
  totalBillsDue: number
  totalBillsAmount: number
  urgentTasksCount: number
  newEmailsToday: number
  buildingLinkAttentionCount: number
}

export async function generateDailySummary(): Promise<DailySummaryData> {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  // Get overdue bills
  const overdueBills = await query<Bill>(`
    SELECT b.*, row_to_json(p.*) as property
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status = 'pending' AND b.due_date < CURRENT_DATE
    ORDER BY b.due_date
  `)

  // Get unconfirmed checks
  const unconfirmedChecks = await query<Bill>(`
    SELECT b.*, row_to_json(p.*) as property
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status = 'sent'
      AND b.payment_method = 'check'
      AND b.payment_date IS NOT NULL
      AND b.confirmation_date IS NULL
      AND b.payment_date + b.days_to_confirm < CURRENT_DATE
    ORDER BY b.payment_date
  `)

  // Get expiring insurance
  const expiringPolicies = await query<InsurancePolicy>(`
    SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
    FROM insurance_policies ip
    LEFT JOIN properties p ON ip.property_id = p.id
    LEFT JOIN vehicles v ON ip.vehicle_id = v.id
    WHERE ip.expiration_date <= CURRENT_DATE + 30
      AND ip.expiration_date >= CURRENT_DATE
    ORDER BY ip.expiration_date
  `)

  // Get vehicles with expired/expiring registration
  const vehicleAlerts = await query<Vehicle>(`
    SELECT * FROM vehicles
    WHERE is_active = TRUE
      AND (
        registration_expires <= CURRENT_DATE + 30
        OR inspection_expires <= CURRENT_DATE
      )
    ORDER BY registration_expires
  `)

  // Get upcoming bills (next 7 days)
  const upcomingBills = await query<Bill>(`
    SELECT b.*, row_to_json(p.*) as property
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status = 'pending'
      AND b.due_date >= CURRENT_DATE
      AND b.due_date <= CURRENT_DATE + 7
    ORDER BY b.due_date
  `)

  // Get upcoming taxes (next 30 days)
  const upcomingTaxes = await query<PropertyTax>(`
    SELECT pt.*, row_to_json(p.*) as property
    FROM property_taxes pt
    JOIN properties p ON pt.property_id = p.id
    WHERE pt.status = 'pending'
      AND pt.due_date >= CURRENT_DATE
      AND pt.due_date <= CURRENT_DATE + 30
    ORDER BY pt.due_date
  `)

  // Get recent emails - only vendor-matched emails, not personal/marketing
  const recentEmails = await query<{
    vendor_name: string | null
    subject: string
    received_at: string
    is_important: boolean
  }>(`
    SELECT v.name as vendor_name, vc.subject, vc.received_at, vc.is_important
    FROM vendor_communications vc
    INNER JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.received_at >= CURRENT_DATE - 1
      AND vc.direction = 'inbound'
      AND v.specialty != 'other'
      AND NOT (vc.labels && ARRAY['CATEGORY_PROMOTIONS', 'SPAM']::text[])
    ORDER BY vc.received_at DESC
    LIMIT 10
  `)

  // Get stats - only count vendor-matched emails (excluding spam/marketing)
  const statsResult = await query<{
    bills_count: string
    bills_amount: string
    urgent_tasks: string
    new_emails: string
  }>(`
    SELECT
      (SELECT COUNT(*) FROM bills WHERE status = 'pending' AND due_date <= CURRENT_DATE + 7) as bills_count,
      (SELECT COALESCE(SUM(amount), 0) FROM bills WHERE status = 'pending' AND due_date <= CURRENT_DATE + 7) as bills_amount,
      (SELECT COUNT(*) FROM maintenance_tasks WHERE status IN ('pending', 'in_progress') AND priority IN ('urgent', 'high')) as urgent_tasks,
      (SELECT COUNT(*)
       FROM vendor_communications vc
       INNER JOIN vendors v ON vc.vendor_id = v.id
       WHERE vc.received_at >= CURRENT_DATE
         AND vc.direction = 'inbound'
         AND v.specialty != 'other'
         AND NOT (vc.labels && ARRAY['CATEGORY_PROMOTIONS', 'SPAM']::text[])) as new_emails
  `)

  const stats = statsResult[0] || { bills_count: "0", bills_amount: "0", urgent_tasks: "0", new_emails: "0" }

  // Get BuildingLink needs attention items using Anne's user flags
  // (Anne receives the daily summary email)
  const anneEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
  const anneUser = await query<{ id: string }>(
    "SELECT id FROM profiles WHERE email = $1",
    [anneEmail]
  )
  const anneUserId = anneUser[0]?.id || "00000000-0000-0000-0000-000000000000"

  let buildingLinkAttention: NeedsAttentionItems = {
    activeOutages: [],
    uncollectedPackages: [],
    flaggedMessages: [],
  }
  try {
    buildingLinkAttention = await getBuildingLinkNeedsAttention()
  } catch (error) {
    console.error("[Daily Summary] Failed to get BuildingLink data:", error)
  }

  // Build urgent items
  const urgentItems: UrgentItem[] = []

  for (const bill of overdueBills) {
    const daysOver = -daysUntil(bill.due_date)
    urgentItems.push({
      type: "payment_overdue",
      title: `Overdue: ${bill.description || bill.bill_type}`,
      description: `Due ${formatDate(bill.due_date)} (${daysOver} days overdue) - ${formatCurrency(Number(bill.amount))}`,
      daysOverdue: daysOver,
      amount: Number(bill.amount),
      link: `/payments`,
    })
  }

  for (const check of unconfirmedChecks) {
    const daysSinceSent = -daysUntil(check.payment_date!)
    urgentItems.push({
      type: "check_unconfirmed",
      title: `Unconfirmed check: ${check.description || check.bill_type}`,
      description: `Sent ${formatDate(check.payment_date!)} (${daysSinceSent} days) - ${formatCurrency(Number(check.amount))}`,
      daysOverdue: daysSinceSent - (check.days_to_confirm || 14),
      amount: Number(check.amount),
      link: `/payments`,
    })
  }

  for (const policy of expiringPolicies) {
    if (policy.expiration_date && daysUntil(policy.expiration_date) <= 7) {
      urgentItems.push({
        type: "insurance_expiring",
        title: `Insurance expiring: ${policy.carrier_name}`,
        description: `${policy.policy_type} expires ${formatDate(policy.expiration_date)}`,
        daysOverdue: -daysUntil(policy.expiration_date),
        link: `/insurance`,
      })
    }
  }

  for (const vehicle of vehicleAlerts) {
    if (vehicle.registration_expires && daysUntil(vehicle.registration_expires) <= 0) {
      urgentItems.push({
        type: "registration_expired",
        title: `Registration expired: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        description: `Expired ${formatDate(vehicle.registration_expires)}`,
        daysOverdue: -daysUntil(vehicle.registration_expires),
        link: `/vehicles/${vehicle.id}`,
      })
    }
    if (vehicle.inspection_expires && daysUntil(vehicle.inspection_expires) <= 0) {
      urgentItems.push({
        type: "inspection_overdue",
        title: `Inspection overdue: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        description: `Expired ${formatDate(vehicle.inspection_expires)}`,
        daysOverdue: -daysUntil(vehicle.inspection_expires),
        link: `/vehicles/${vehicle.id}`,
      })
    }
  }

  // Add BuildingLink outages as urgent items
  for (const outage of buildingLinkAttention.activeOutages) {
    urgentItems.push({
      type: "building_outage",
      title: `Building Outage: ${outage.subject}`,
      description: `${outage.unit !== 'unknown' ? `Unit ${outage.unit} - ` : ''}${formatDate(outage.received_at)}`,
      link: `/buildinglink`,
    })
  }

  // Build BuildingLink summary items
  const buildingLinkItems: BuildingLinkSummaryItem[] = []

  for (const outage of buildingLinkAttention.activeOutages) {
    buildingLinkItems.push({
      type: "outage",
      subject: outage.subject,
      unit: outage.unit,
      receivedAt: outage.received_at,
      snippet: outage.body_snippet || undefined,
    })
  }

  for (const pkg of buildingLinkAttention.uncollectedPackages) {
    buildingLinkItems.push({
      type: "package",
      subject: pkg.subject,
      unit: pkg.unit,
      receivedAt: pkg.received_at,
      snippet: pkg.body_snippet || undefined,
    })
  }

  for (const flagged of buildingLinkAttention.flaggedMessages) {
    buildingLinkItems.push({
      type: "flagged",
      subject: flagged.subject,
      unit: flagged.unit,
      receivedAt: flagged.received_at,
      snippet: flagged.body_snippet || undefined,
    })
  }

  // Build upcoming items
  const upcomingItems: UpcomingItem[] = []

  for (const bill of upcomingBills) {
    upcomingItems.push({
      type: "bill_due",
      title: bill.description || bill.bill_type,
      description: `Due ${formatDate(bill.due_date)} - ${formatCurrency(Number(bill.amount))}`,
      dueDate: bill.due_date,
      daysUntil: daysUntil(bill.due_date),
      amount: Number(bill.amount),
      link: `/payments`,
    })
  }

  for (const tax of upcomingTaxes) {
    upcomingItems.push({
      type: "tax_due",
      title: `Property Tax: ${tax.jurisdiction} Q${tax.installment}`,
      description: `Due ${formatDate(tax.due_date)} - ${formatCurrency(Number(tax.amount))}`,
      dueDate: tax.due_date,
      daysUntil: daysUntil(tax.due_date),
      amount: Number(tax.amount),
      link: `/payments/taxes`,
    })
  }

  for (const policy of expiringPolicies) {
    if (policy.expiration_date && daysUntil(policy.expiration_date) > 7) {
      upcomingItems.push({
        type: "insurance_expiring",
        title: `${policy.carrier_name} - ${policy.policy_type}`,
        description: `Expires ${formatDate(policy.expiration_date)}`,
        dueDate: policy.expiration_date,
        daysUntil: daysUntil(policy.expiration_date),
        link: `/insurance`,
      })
    }
  }

  for (const vehicle of vehicleAlerts) {
    if (vehicle.registration_expires && daysUntil(vehicle.registration_expires) > 0 && daysUntil(vehicle.registration_expires) <= 30) {
      upcomingItems.push({
        type: "registration_due",
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        description: `Registration expires ${formatDate(vehicle.registration_expires)}`,
        dueDate: vehicle.registration_expires,
        daysUntil: daysUntil(vehicle.registration_expires),
        link: `/vehicles/${vehicle.id}`,
      })
    }
  }

  // Sort upcoming items by date
  upcomingItems.sort((a, b) => a.daysUntil - b.daysUntil)

  return {
    date: todayStr,
    urgentItems,
    upcomingItems,
    recentEmails: recentEmails.map((e) => ({
      vendorName: e.vendor_name,
      subject: e.subject || "(No subject)",
      receivedAt: e.received_at,
      isUrgent: e.is_important,
    })),
    buildingLinkItems,
    stats: {
      totalBillsDue: parseInt(stats.bills_count),
      totalBillsAmount: parseFloat(stats.bills_amount),
      urgentTasksCount: parseInt(stats.urgent_tasks),
      newEmailsToday: parseInt(stats.new_emails),
      buildingLinkAttentionCount: buildingLinkItems.length,
    },
  }
}

export async function formatSummaryAsText(summary: DailySummaryData): Promise<string> {
  const lines: string[] = []

  lines.push("=" .repeat(60))
  lines.push(`  DAILY PROPERTY MANAGEMENT SUMMARY - ${summary.date}`)
  lines.push("=" .repeat(60))
  lines.push("")

  // Urgent items
  if (summary.urgentItems.length > 0) {
    lines.push("URGENT ITEMS REQUIRING ATTENTION:")
    lines.push("-".repeat(40))
    for (const item of summary.urgentItems) {
      lines.push(`  [!] ${item.title}`)
      lines.push(`      ${item.description}`)
    }
    lines.push("")
  }

  // Upcoming items
  if (summary.upcomingItems.length > 0) {
    lines.push("COMING UP NEXT 7-30 DAYS:")
    lines.push("-".repeat(40))
    for (const item of summary.upcomingItems.slice(0, 10)) {
      lines.push(`  - ${item.title}`)
      lines.push(`    ${item.description}`)
    }
    lines.push("")
  }

  // Recent emails
  if (summary.recentEmails.length > 0) {
    lines.push("RECENT VENDOR EMAILS:")
    lines.push("-".repeat(40))
    for (const email of summary.recentEmails.slice(0, 5)) {
      const urgentMark = email.isUrgent ? " [URGENT]" : ""
      lines.push(`  - ${email.vendorName || "Unknown"}: ${email.subject}${urgentMark}`)
    }
    lines.push("")
  }

  // BuildingLink items
  if (summary.buildingLinkItems.length > 0) {
    lines.push("BUILDINGLINK - NEEDS ATTENTION:")
    lines.push("-".repeat(40))
    const outages = summary.buildingLinkItems.filter(i => i.type === 'outage')
    const packages = summary.buildingLinkItems.filter(i => i.type === 'package')
    const flagged = summary.buildingLinkItems.filter(i => i.type === 'flagged')

    if (outages.length > 0) {
      lines.push("  [!] ACTIVE OUTAGES:")
      for (const item of outages) {
        lines.push(`      - ${item.subject}`)
        lines.push(`        Unit ${item.unit} | ${formatDate(item.receivedAt)}`)
      }
    }

    if (packages.length > 0) {
      lines.push(`  [P] UNCOLLECTED PACKAGES (${packages.length}):`)
      for (const item of packages.slice(0, 5)) {
        lines.push(`      - ${item.subject}`)
        lines.push(`        Unit ${item.unit} | ${formatDate(item.receivedAt)}`)
      }
      if (packages.length > 5) {
        lines.push(`      ...and ${packages.length - 5} more`)
      }
    }

    if (flagged.length > 0) {
      lines.push("  [*] FLAGGED ITEMS:")
      for (const item of flagged) {
        lines.push(`      - ${item.subject}`)
        lines.push(`        Unit ${item.unit} | ${formatDate(item.receivedAt)}`)
      }
    }
    lines.push("")
  }

  // Stats
  lines.push("SUMMARY STATS:")
  lines.push("-".repeat(40))
  lines.push(`  Bills due this week: ${summary.stats.totalBillsDue} (${formatCurrency(summary.stats.totalBillsAmount)})`)
  lines.push(`  Urgent tasks: ${summary.stats.urgentTasksCount}`)
  lines.push(`  New emails today: ${summary.stats.newEmailsToday}`)
  lines.push(`  BuildingLink items: ${summary.stats.buildingLinkAttentionCount}`)
  lines.push("")
  lines.push("=" .repeat(60))

  return lines.join("\n")
}

export async function formatSummaryAsHtml(summary: DailySummaryData): Promise<string> {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
    h2 { color: #444; margin-top: 30px; }
    .urgent { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
    .upcoming { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
    .email { background: #f9fafb; padding: 12px 16px; margin: 8px 0; border-radius: 4px; border: 1px solid #e5e7eb; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
    .stat-box { background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .stat-label { color: #6b7280; font-size: 14px; }
    .urgent-badge { display: inline-block; background: #ef4444; color: white; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Daily Property Management Summary</h1>
  <p style="color: #6b7280;">${summary.date}</p>
`

  if (summary.urgentItems.length > 0) {
    html += `<h2>Urgent Items</h2>`
    for (const item of summary.urgentItems) {
      html += `<div class="urgent"><strong>${item.title}</strong><br>${item.description}</div>`
    }
  }

  if (summary.upcomingItems.length > 0) {
    html += `<h2>Coming Up</h2>`
    for (const item of summary.upcomingItems.slice(0, 10)) {
      html += `<div class="upcoming"><strong>${item.title}</strong><br>${item.description}</div>`
    }
  }

  if (summary.recentEmails.length > 0) {
    html += `<h2>Recent Vendor Emails</h2>`
    for (const email of summary.recentEmails.slice(0, 5)) {
      const urgentBadge = email.isUrgent ? '<span class="urgent-badge">URGENT</span>' : ''
      html += `<div class="email"><strong>${email.vendorName || "Unknown"}</strong>${urgentBadge}<br>${email.subject}</div>`
    }
  }

  if (summary.buildingLinkItems.length > 0) {
    html += `<h2>BuildingLink - Needs Attention</h2>`
    const outages = summary.buildingLinkItems.filter(i => i.type === 'outage')
    const packages = summary.buildingLinkItems.filter(i => i.type === 'package')
    const flagged = summary.buildingLinkItems.filter(i => i.type === 'flagged')

    if (outages.length > 0) {
      html += `<p style="font-weight: 600; color: #dc2626; margin-bottom: 8px;">🚨 Active Outages</p>`
      for (const item of outages) {
        html += `<div class="urgent"><strong>${item.subject}</strong><br><span style="color: #6b7280; font-size: 13px;">Unit ${item.unit} • ${formatDate(item.receivedAt)}</span></div>`
      }
    }

    if (packages.length > 0) {
      html += `<p style="font-weight: 600; color: #7c3aed; margin-bottom: 8px;">📦 Uncollected Packages (${packages.length})</p>`
      for (const item of packages.slice(0, 5)) {
        html += `<div class="email"><strong>${item.subject}</strong><br><span style="color: #6b7280; font-size: 13px;">Unit ${item.unit} • ${formatDate(item.receivedAt)}</span></div>`
      }
      if (packages.length > 5) {
        html += `<p style="color: #6b7280; font-size: 13px;">...and ${packages.length - 5} more</p>`
      }
    }

    if (flagged.length > 0) {
      html += `<p style="font-weight: 600; color: #ca8a04; margin-bottom: 8px;">⭐ Flagged Items</p>`
      for (const item of flagged) {
        html += `<div class="email"><strong>${item.subject}</strong><br><span style="color: #6b7280; font-size: 13px;">Unit ${item.unit} • ${formatDate(item.receivedAt)}</span></div>`
      }
    }
  }

  html += `
  <h2>Summary</h2>
  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${summary.stats.totalBillsDue}</div>
      <div class="stat-label">Bills Due This Week</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${formatCurrency(summary.stats.totalBillsAmount)}</div>
      <div class="stat-label">Amount Due</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${summary.stats.urgentTasksCount}</div>
      <div class="stat-label">Urgent Tasks</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${summary.stats.newEmailsToday}</div>
      <div class="stat-label">New Emails Today</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${summary.stats.buildingLinkAttentionCount}</div>
      <div class="stat-label">BuildingLink Items</div>
    </div>
  </div>
  <div class="footer">
    <p>This summary was automatically generated by your Property Management System.</p>
  </div>
</body>
</html>
`

  return html
}
