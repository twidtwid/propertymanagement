"use server"

import { query } from "./db"
import { sendEmail, sendUrgentNotificationEmail } from "./gmail/send"
import { generateDailySummary, formatSummaryAsHtml } from "./daily-summary"
import { formatCurrency, formatDate } from "./utils"

const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
const SENDER_EMAIL = NOTIFICATION_EMAIL // Same account sends and receives

export type NotificationType =
  | "payment_overdue"
  | "check_unconfirmed"
  | "insurance_expiring"
  | "registration_expiring"
  | "vendor_urgent"
  | "daily_summary"

interface NotificationContext {
  title: string
  details: string
  link?: string
  amount?: number
}

/**
 * Log a sent notification to the database.
 */
async function logNotification(
  recipientEmail: string,
  notificationType: string,
  subject: string,
  bodyHtml: string,
  gmailMessageId?: string
): Promise<void> {
  await query(
    `INSERT INTO notification_log (recipient_email, notification_type, subject, body_html, gmail_message_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [recipientEmail, notificationType, subject, bodyHtml, gmailMessageId || null]
  )
}

/**
 * Check if a notification was already sent today for this type/context.
 */
async function wasNotificationSentToday(
  notificationType: string,
  subject: string
): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notification_log
     WHERE notification_type = $1 AND subject = $2
     AND sent_at >= CURRENT_DATE`,
    [notificationType, subject]
  )
  return result.length > 0 && parseInt(result[0].count) > 0
}

/**
 * Send an urgent notification if not already sent today.
 */
export async function sendUrgentNotification(
  type: NotificationType,
  context: NotificationContext
): Promise<boolean> {
  const subject = `[URGENT] ${context.title}`

  // Check if already sent today
  if (await wasNotificationSentToday(type, subject)) {
    console.log(`[Notifications] Already sent today: ${subject}`)
    return false
  }

  try {
    const messageId = await sendUrgentNotificationEmail(
      SENDER_EMAIL,
      NOTIFICATION_EMAIL,
      type,
      context.title,
      context.details
    )

    await logNotification(
      NOTIFICATION_EMAIL,
      type,
      subject,
      context.details,
      messageId
    )

    console.log(`[Notifications] Sent urgent: ${subject}`)
    return true
  } catch (error) {
    console.error(`[Notifications] Failed to send: ${subject}`, error)
    return false
  }
}

/**
 * Generate and send the daily summary email.
 */
export async function sendDailySummaryEmail(): Promise<{
  success: boolean
  messageId?: string
  error?: string
}> {
  try {
    console.log("[Daily Summary] Generating summary...")

    const summary = await generateDailySummary()
    const htmlContent = await formatSummaryAsHtml(summary)

    console.log("[Daily Summary] Sending email to:", NOTIFICATION_EMAIL)

    const messageId = await sendEmail(
      SENDER_EMAIL,
      NOTIFICATION_EMAIL,
      `Daily Property Summary - ${summary.date}`,
      htmlContent
    )

    // Log the notification
    await logNotification(
      NOTIFICATION_EMAIL,
      "daily_summary",
      `Daily Property Summary - ${summary.date}`,
      htmlContent,
      messageId
    )

    // Store summary in daily_summaries table
    await query(
      `INSERT INTO daily_summaries (summary_date, urgent_items, upcoming_items, sent_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (summary_date) DO UPDATE SET sent_at = NOW()`,
      [summary.date, JSON.stringify(summary.urgentItems), JSON.stringify(summary.upcomingItems)]
    )

    console.log("[Daily Summary] Email sent successfully:", messageId)

    return { success: true, messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Daily Summary] Failed to send:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Check for urgent items and send notifications.
 */
export async function checkAndSendUrgentNotifications(): Promise<{
  checked: number
  sent: number
}> {
  let checked = 0
  let sent = 0

  // Check for overdue bills
  const overdueBills = await query<{
    id: string
    description: string
    amount: string
    due_date: string
  }>(`
    SELECT id, description, amount, due_date
    FROM bills
    WHERE status = 'pending' AND due_date < CURRENT_DATE
  `)

  for (const bill of overdueBills) {
    checked++
    const daysOverdue = Math.floor(
      (Date.now() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24)
    )
    const wasSent = await sendUrgentNotification("payment_overdue", {
      title: `Bill Overdue: ${bill.description || "Unknown"}`,
      details: `Amount: ${formatCurrency(Number(bill.amount))} - Due: ${formatDate(bill.due_date)} (${daysOverdue} days overdue)`,
      link: "/payments",
      amount: Number(bill.amount),
    })
    if (wasSent) sent++
  }

  // Check for unconfirmed checks (14+ days)
  const unconfirmedChecks = await query<{
    id: string
    description: string
    amount: string
    payment_date: string
    days_to_confirm: number
  }>(`
    SELECT id, description, amount, payment_date, days_to_confirm
    FROM bills
    WHERE status = 'sent'
      AND payment_method = 'check'
      AND payment_date IS NOT NULL
      AND confirmation_date IS NULL
      AND payment_date + COALESCE(days_to_confirm, 14) < CURRENT_DATE
  `)

  for (const check of unconfirmedChecks) {
    checked++
    const daysSinceSent = Math.floor(
      (Date.now() - new Date(check.payment_date).getTime()) / (1000 * 60 * 60 * 24)
    )
    const wasSent = await sendUrgentNotification("check_unconfirmed", {
      title: `Unconfirmed Check: ${check.description || "Unknown"}`,
      details: `Amount: ${formatCurrency(Number(check.amount))} - Sent: ${formatDate(check.payment_date)} (${daysSinceSent} days ago, expected ${check.days_to_confirm || 14} days)`,
      link: "/payments",
      amount: Number(check.amount),
    })
    if (wasSent) sent++
  }

  // Check for expiring insurance (7 days or less)
  const expiringPolicies = await query<{
    id: string
    carrier_name: string
    policy_type: string
    expiration_date: string
  }>(`
    SELECT id, carrier_name, policy_type, expiration_date
    FROM insurance_policies
    WHERE expiration_date <= CURRENT_DATE + 7
      AND expiration_date >= CURRENT_DATE
  `)

  for (const policy of expiringPolicies) {
    checked++
    const daysUntil = Math.floor(
      (new Date(policy.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const wasSent = await sendUrgentNotification("insurance_expiring", {
      title: `Insurance Expiring: ${policy.carrier_name}`,
      details: `${policy.policy_type} policy expires ${formatDate(policy.expiration_date)} (${daysUntil} days)`,
      link: "/insurance",
    })
    if (wasSent) sent++
  }

  // Check for expiring vehicle registrations (7 days or less)
  const expiringRegistrations = await query<{
    id: string
    year: number
    make: string
    model: string
    registration_expires: string
  }>(`
    SELECT id, year, make, model, registration_expires
    FROM vehicles
    WHERE is_active = TRUE
      AND registration_expires <= CURRENT_DATE + 7
      AND registration_expires >= CURRENT_DATE
  `)

  for (const vehicle of expiringRegistrations) {
    checked++
    const daysUntil = Math.floor(
      (new Date(vehicle.registration_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const wasSent = await sendUrgentNotification("registration_expiring", {
      title: `Registration Expiring: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      details: `Registration expires ${formatDate(vehicle.registration_expires)} (${daysUntil} days)`,
      link: `/vehicles/${vehicle.id}`,
    })
    if (wasSent) sent++
  }

  return { checked, sent }
}
