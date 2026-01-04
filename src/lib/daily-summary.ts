"use server"

import { query } from "./db"
import type { DashboardPinnedItem, UpcomingItem } from "@/types/database"
import { formatCurrency, formatDate } from "./utils"
import { getBuildingLinkNeedsAttention, getDashboardPinnedItems, getUpcomingWeek, type NeedsAttentionItems } from "./actions"

export interface BuildingLinkSummaryItem {
  type: "outage" | "package" | "flagged"
  subject: string
  unit: string
  receivedAt: string
  snippet?: string
}

export interface PinnedNoteItem {
  id: string
  content: string
  entityType: string
  entityId: string
  entityTitle: string
  dueDate: string | null
  createdBy: string | null
  href: string
}

export interface DailySummaryData {
  date: string
  // Use same data as dashboard for consistency - these come from getDashboardPinnedItems()
  overdueItems: DashboardPinnedItem[]  // Items with status 'overdue'
  urgentItems: DashboardPinnedItem[]   // Items with status 'urgent' (due this week)
  upcomingItems: UpcomingItem[]  // Items coming up (next 7 days) from getUpcomingWeek()
  pinnedNotes: PinnedNoteItem[]  // User's pinned notes with due dates
  recentEmails: EmailSummary[]
  buildingLinkItems: BuildingLinkSummaryItem[]
  stats: SummaryStats
}

export interface EmailSummary {
  vendorName: string | null
  subject: string
  receivedAt: string
  isUrgent: boolean
  snippet?: string
  bodyHtml?: string
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

  // === USE SAME DATA SOURCES AS DASHBOARD FOR CONSISTENCY ===
  // This ensures the daily summary shows the same counts as the dashboard
  const [pinnedData, upcomingWeek, buildingLinkAttention] = await Promise.all([
    getDashboardPinnedItems(),
    getUpcomingWeek(),
    getBuildingLinkNeedsAttention().catch((error) => {
      console.error("[Daily Summary] Failed to get BuildingLink data:", error)
      return { activeOutages: [], uncollectedPackages: [], flaggedMessages: [] } as NeedsAttentionItems
    }),
  ])

  // Split pinned items by status - same logic as dashboard
  // Exclude vendors from needs attention (they don't have due dates and are shown elsewhere)
  const overdueItems = pinnedData.items.filter(item => item.status === 'overdue' && item.entityType !== 'vendor')
  const urgentItems = pinnedData.items.filter(item => item.status === 'urgent' && item.entityType !== 'vendor')

  // Get recent emails - only vendor-matched emails, not personal/marketing
  const recentEmails = await query<{
    vendor_name: string | null
    subject: string
    received_at: string
    is_important: boolean
    body_snippet: string | null
    body_html: string | null
  }>(`
    SELECT v.name as vendor_name, vc.subject, vc.received_at, vc.is_important, vc.body_snippet, vc.body_html
    FROM vendor_communications vc
    INNER JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.received_at >= CURRENT_DATE - 1
      AND vc.direction = 'inbound'
      AND v.specialty != 'other'
      AND NOT (vc.labels && ARRAY['CATEGORY_PROMOTIONS', 'SPAM']::text[])
    ORDER BY vc.received_at DESC
    LIMIT 10
  `)

  // Get stats
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

  // Get pinned notes with due dates (next 30 days)
  const pinnedNotesRaw = await query<{
    id: string
    note: string
    entity_type: string
    entity_id: string
    due_date: string | null
    user_name: string | null
  }>(`
    SELECT pn.id, pn.note, pn.entity_type, pn.entity_id, pn.due_date, pn.user_name
    FROM pin_notes pn
    WHERE pn.due_date IS NOT NULL
      AND pn.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ORDER BY pn.due_date
  `)

  // Fetch entity titles for pinned notes
  const pinnedNotes: PinnedNoteItem[] = await Promise.all(
    pinnedNotesRaw.map(async (note) => {
      let entityTitle = "Unknown"
      if (note.entity_type === 'vendor') {
        const v = await query<{ name: string; company: string | null }>(`SELECT name, company FROM vendors WHERE id = $1`, [note.entity_id])
        entityTitle = v[0]?.company || v[0]?.name || "Vendor"
      } else if (note.entity_type === 'bill') {
        const b = await query<{ description: string | null; bill_type: string }>(`SELECT description, bill_type FROM bills WHERE id = $1`, [note.entity_id])
        entityTitle = b[0]?.description || b[0]?.bill_type || "Bill"
      } else if (note.entity_type === 'ticket') {
        const t = await query<{ title: string }>(`SELECT title FROM maintenance_tasks WHERE id = $1`, [note.entity_id])
        entityTitle = t[0]?.title || "Ticket"
      } else if (note.entity_type === 'property_tax') {
        const pt = await query<{ jurisdiction: string; installment: number }>(`SELECT jurisdiction, installment FROM property_taxes WHERE id = $1`, [note.entity_id])
        entityTitle = pt[0] ? `${pt[0].jurisdiction} Q${pt[0].installment}` : "Property Tax"
      } else if (note.entity_type === 'insurance_policy' || note.entity_type === 'insurance_premium') {
        const ip = await query<{ carrier_name: string; policy_type: string }>(`SELECT carrier_name, policy_type FROM insurance_policies WHERE id = $1`, [note.entity_id])
        entityTitle = ip[0] ? `${ip[0].carrier_name} ${ip[0].policy_type}` : "Insurance"
      } else if (note.entity_type === 'document') {
        // Documents store title in pinned_items.metadata
        const pin = await query<{ metadata: { title?: string; name?: string } | null }>(`SELECT metadata FROM pinned_items WHERE entity_type = 'document' AND entity_id = $1`, [note.entity_id])
        entityTitle = pin[0]?.metadata?.title || pin[0]?.metadata?.name || "Document"
      }
      // Generate href based on entity type
      let href = '/'
      switch (note.entity_type) {
        case 'vendor': href = `/vendors/${note.entity_id}`; break
        case 'bill': href = `/payments`; break
        case 'ticket': href = `/tickets/${note.entity_id}`; break
        case 'property_tax': href = `/payments/taxes`; break
        case 'insurance_policy':
        case 'insurance_premium': href = `/insurance/${note.entity_id}`; break
        case 'buildinglink_message': href = `/buildinglink`; break
        case 'document': href = `/documents`; break
      }
      return {
        id: note.id,
        content: note.note,
        entityType: note.entity_type,
        entityId: note.entity_id,
        entityTitle,
        dueDate: note.due_date,
        createdBy: note.user_name,
        href,
      }
    })
  )

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

  return {
    date: todayStr,
    overdueItems,
    urgentItems,
    upcomingItems: upcomingWeek,
    pinnedNotes,
    recentEmails: recentEmails.map((e) => ({
      vendorName: e.vendor_name,
      subject: e.subject || "(No subject)",
      receivedAt: e.received_at,
      isUrgent: e.is_important,
      snippet: e.body_snippet || undefined,
      bodyHtml: e.body_html || undefined,
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

// Helper to format days description
function formatDaysDescription(days: number | null, dueDate: string | null): string {
  if (days === null || dueDate === null) return ''
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

export async function formatSummaryAsText(summary: DailySummaryData): Promise<string> {
  const lines: string[] = []

  lines.push("=" .repeat(60))
  lines.push(`  DAILY PROPERTY MANAGEMENT SUMMARY - ${summary.date}`)
  lines.push("=" .repeat(60))
  lines.push("")

  // Overdue items (most critical)
  if (summary.overdueItems.length > 0) {
    lines.push("🔴 OVERDUE:")
    lines.push("-".repeat(40))
    for (const item of summary.overdueItems) {
      const daysOverdue = item.daysUntilOrOverdue ? Math.abs(item.daysUntilOrOverdue) : 0
      lines.push(`  [!!] ${item.title}`)
      lines.push(`       ${item.subtitle || ''}${item.amount ? ` - ${formatCurrency(item.amount)}` : ''} - ${daysOverdue} DAYS OVERDUE`)
    }
    lines.push("")
  }

  // Urgent items (need attention this week)
  if (summary.urgentItems.length > 0) {
    lines.push("🟠 DUE THIS WEEK:")
    lines.push("-".repeat(40))
    for (const item of summary.urgentItems) {
      const daysDesc = formatDaysDescription(item.daysUntilOrOverdue, item.dueDate)
      lines.push(`  [!] ${item.title}`)
      lines.push(`      ${item.subtitle || ''}${item.amount ? ` - ${formatCurrency(item.amount)}` : ''} - ${daysDesc}`)
    }
    lines.push("")
  }

  // Pinned notes with due dates
  if (summary.pinnedNotes.length > 0) {
    lines.push("📌 YOUR PINNED NOTES:")
    lines.push("-".repeat(40))
    for (const note of summary.pinnedNotes) {
      lines.push(`  - "${note.content}"`)
      lines.push(`    → ${note.entityTitle}${note.dueDate ? ` | Due: ${formatDate(note.dueDate)}` : ''}`)
    }
    lines.push("")
  }

  // Upcoming items
  if (summary.upcomingItems.length > 0) {
    lines.push("COMING UP NEXT 7 DAYS:")
    lines.push("-".repeat(40))
    for (const item of summary.upcomingItems.slice(0, 10)) {
      const daysDesc = item.daysUntil === 0 ? 'today' : item.daysUntil === 1 ? 'tomorrow' : `in ${item.daysUntil} days`
      lines.push(`  - ${item.title}`)
      lines.push(`    ${item.subtitle || ''}${item.amount ? ` - ${formatCurrency(item.amount)}` : ''} - Due ${daysDesc}`)
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
      if (email.snippet) {
        lines.push(`    ${email.snippet.substring(0, 100)}${email.snippet.length > 100 ? '...' : ''}`)
      }
      lines.push(`    Received: ${formatDate(email.receivedAt)}`)
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://spmsystem.com'
  const hasAttentionItems = summary.overdueItems.length > 0 || summary.urgentItems.length > 0

  // Status banner content
  let statusBanner = ''
  if (hasAttentionItems) {
    const parts: string[] = []
    if (summary.overdueItems.length > 0) {
      parts.push(`${summary.overdueItems.length} overdue`)
    }
    if (summary.urgentItems.length > 0) {
      parts.push(`${summary.urgentItems.length} due soon`)
    }
    statusBanner = `
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
        <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #991b1b;">⚠️ ${parts.join(', ')} need attention</h1>
        <a href="${appUrl}" style="color: #3b82f6; text-decoration: none; font-size: 14px;">View Dashboard →</a>
      </div>
    `
  } else {
    // Find next due item
    const nextDue = summary.upcomingItems[0]
    const nextDueText = nextDue
      ? `Next payment due ${nextDue.daysUntil === 0 ? 'today' : nextDue.daysUntil === 1 ? 'tomorrow' : `in ${nextDue.daysUntil} days`}: ${nextDue.title}`
      : 'No upcoming payments in the next 30 days.'
    statusBanner = `
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
        <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #166534;">✅ All clear</h1>
        <p style="margin: 0; color: #4b5563; font-size: 14px;">${nextDueText}</p>
      </div>
    `
  }

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
  <p style="color: #6b7280; margin-bottom: 8px; font-size: 13px;">${summary.date}</p>

  ${statusBanner}
`

  // OVERDUE Section (Red)
  if (summary.overdueItems.length > 0) {
    html += `<h2 style="color: #dc2626; margin: 24px 0 12px 0; font-size: 16px;">🔴 OVERDUE (${summary.overdueItems.length})</h2>`
    for (const item of summary.overdueItems) {
      const daysOverdue = item.daysUntilOrOverdue ? Math.abs(item.daysUntilOrOverdue) : 0
      html += `
        <a href="${appUrl}${item.href}" style="display: block; background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 8px 0; border-radius: 4px; text-decoration: none;">
          <strong style="color: #1f2937;">${item.title}</strong><br>
          <span style="color: #dc2626; font-weight: 600;">${item.amount ? formatCurrency(item.amount) + ' — ' : ''}${item.subtitle ? item.subtitle + ' — ' : ''}${daysOverdue} DAYS OVERDUE</span>
        </a>
      `
    }
  }

  // DUE THIS WEEK Section (Orange)
  if (summary.urgentItems.length > 0) {
    html += `<h2 style="color: #ea580c; margin: 24px 0 12px 0; font-size: 16px;">🟠 DUE THIS WEEK (${summary.urgentItems.length})</h2>`
    for (const item of summary.urgentItems) {
      const daysDesc = formatDaysDescription(item.daysUntilOrOverdue, item.dueDate)
      html += `
        <a href="${appUrl}${item.href}" style="display: block; background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; margin: 8px 0; border-radius: 4px; text-decoration: none;">
          <strong style="color: #1f2937;">${item.title}</strong><br>
          <span style="color: #9a3412;">${item.amount ? formatCurrency(item.amount) + ' — ' : ''}${item.subtitle ? item.subtitle + ' — ' : ''}${daysDesc}</span>
        </a>
      `
    }
  }

  // PINNED NOTES Section (Yellow)
  if (summary.pinnedNotes.length > 0) {
    html += `<h2 style="color: #ca8a04; margin: 24px 0 12px 0; font-size: 16px;">📌 YOUR PINNED NOTES</h2>`
    for (const note of summary.pinnedNotes) {
      html += `
        <a href="${appUrl}${note.href}" style="display: block; background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; margin: 8px 0; border-radius: 4px; text-decoration: none;">
          <strong style="color: #1f2937;">"${note.content}"</strong><br>
          <span style="color: #6b7280; font-size: 13px;">→ ${note.entityTitle}${note.dueDate ? ` • Due: ${formatDate(note.dueDate)}` : ''}${note.createdBy ? ` • Added by ${note.createdBy}` : ''}</span>
        </a>
      `
    }
  }

  // COMING UP Section (Blue)
  if (summary.upcomingItems.length > 0) {
    html += `<h2 style="color: #2563eb; margin: 24px 0 12px 0; font-size: 16px;">📅 COMING UP (Next 7 Days)</h2>`
    for (const item of summary.upcomingItems.slice(0, 8)) {
      const daysDesc = item.daysUntil === 0 ? 'Due today' : item.daysUntil === 1 ? 'Due tomorrow' : `Due in ${item.daysUntil} days`
      html += `
        <a href="${appUrl}${item.href}" style="display: block; background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 8px 0; border-radius: 4px; text-decoration: none;">
          <strong style="color: #1f2937;">${item.title}</strong><br>
          <span style="color: #1d4ed8;">${item.amount ? formatCurrency(item.amount) + ' — ' : ''}${item.subtitle ? item.subtitle + ' — ' : ''}${daysDesc}</span>
        </a>
      `
    }
    if (summary.upcomingItems.length > 8) {
      html += `<p style="color: #6b7280; font-size: 13px; margin: 8px 0;">...and ${summary.upcomingItems.length - 8} more items</p>`
    }
  }

  // BUILDINGLINK Section (Amber)
  if (summary.buildingLinkItems.length > 0) {
    html += `<h2 style="color: #d97706; margin: 24px 0 12px 0; font-size: 16px;">🏢 BUILDINGLINK</h2>`
    const outages = summary.buildingLinkItems.filter(i => i.type === 'outage')
    const packages = summary.buildingLinkItems.filter(i => i.type === 'package')
    const flagged = summary.buildingLinkItems.filter(i => i.type === 'flagged')

    if (outages.length > 0) {
      html += `<p style="font-weight: 600; color: #dc2626; margin: 12px 0 8px 0; font-size: 14px;">🚨 Active Outages (${outages.length})</p>`
      for (const item of outages) {
        html += `
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 8px 0; border-radius: 4px;">
            <strong style="color: #1f2937;">${item.subject}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">${item.unit !== 'unknown' ? `Unit ${item.unit} • ` : ''}${formatDate(item.receivedAt)}</span>
          </div>
        `
      }
    }

    if (packages.length > 0) {
      html += `<p style="font-weight: 600; color: #7c3aed; margin: 12px 0 8px 0; font-size: 14px;">📦 Uncollected Packages (${packages.length})</p>`
      for (const item of packages.slice(0, 5)) {
        html += `
          <div style="background: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 12px 16px; margin: 8px 0; border-radius: 4px;">
            <strong style="color: #1f2937;">${item.subject}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">${item.unit !== 'unknown' ? `Unit ${item.unit} • ` : ''}${formatDate(item.receivedAt)}</span>
          </div>
        `
      }
      if (packages.length > 5) {
        html += `<p style="color: #6b7280; font-size: 13px; margin: 8px 0;">...and ${packages.length - 5} more packages</p>`
      }
    }

    if (flagged.length > 0) {
      html += `<p style="font-weight: 600; color: #ca8a04; margin: 12px 0 8px 0; font-size: 14px;">⭐ Flagged Items (${flagged.length})</p>`
      for (const item of flagged) {
        html += `
          <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; margin: 8px 0; border-radius: 4px;">
            <strong style="color: #1f2937;">${item.subject}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">${item.unit !== 'unknown' ? `Unit ${item.unit} • ` : ''}${formatDate(item.receivedAt)}</span>
          </div>
        `
      }
    }
  }

  // VENDOR EMAILS Section
  if (summary.recentEmails.length > 0) {
    html += `<h2 style="color: #4b5563; margin: 24px 0 12px 0; font-size: 16px;">📧 VENDOR EMAILS TODAY (${summary.recentEmails.length})</h2>`
    for (const email of summary.recentEmails.slice(0, 5)) {
      const urgentBadge = email.isUrgent ? '<span style="display: inline-block; background: #ef4444; color: white; font-size: 11px; padding: 2px 6px; border-radius: 3px; margin-left: 8px;">URGENT</span>' : ''
      html += `
        <details style="background: #f9fafb; padding: 12px 16px; margin: 8px 0; border-radius: 4px; border: 1px solid #e5e7eb;">
          <summary style="cursor: pointer; list-style: none; user-select: none;">
            <strong style="color: #1f2937;">${email.vendorName || "Unknown"}</strong>${urgentBadge}<br>
            <span style="color: #6b7280; font-size: 13px;">${email.subject}</span>
          </summary>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            ${email.snippet ? `<p style="color: #4b5563; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">${email.snippet}</p>` : ''}
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Received: ${formatDate(email.receivedAt)}</p>
          </div>
        </details>
      `
    }
    if (summary.recentEmails.length > 5) {
      html += `<p style="color: #6b7280; font-size: 13px; margin: 8px 0;">...and ${summary.recentEmails.length - 5} more emails</p>`
    }
  }

  // Footer
  html += `
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #6b7280; font-size: 13px; text-align: center;">
    <p style="margin: 0 0 8px 0;">
      <a href="${appUrl}" style="color: #3b82f6; text-decoration: none;">View Dashboard</a> &bull;
      <a href="${appUrl}/reports/daily-summary" style="color: #3b82f6; text-decoration: none;">View Full Report</a>
    </p>
    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
      SPM System - Property Management for Anne
    </p>
  </div>
</body>
</html>
`

  return html
}

// Generate dynamic subject line based on summary data
export async function generateSubjectLine(summary: DailySummaryData): Promise<string> {
  if (summary.overdueItems.length > 0 || summary.urgentItems.length > 0) {
    const parts: string[] = []
    if (summary.overdueItems.length > 0) {
      parts.push(`${summary.overdueItems.length} overdue`)
    }
    if (summary.urgentItems.length > 0) {
      parts.push(`${summary.urgentItems.length} due soon`)
    }
    return `⚠️ ${parts.join(', ')} - SPM Daily`
  }
  return `✅ All clear - SPM Daily Summary`
}
