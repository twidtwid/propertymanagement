import { NextRequest, NextResponse } from "next/server"
import { generateDailySummary, formatSummaryAsText, formatSummaryAsHtml } from "@/lib/daily-summary"
import { sendDailySummaryEmail, checkAndSendUrgentNotifications } from "@/lib/notifications"
import { generateAlerts, cleanupAlerts } from "@/lib/alerts/generate"

/**
 * GET /api/cron/daily-summary
 * Generates and returns the daily summary.
 * Can be called manually or by a cron job.
 *
 * Query params:
 *   format=text|html|json (default: json)
 *   send=true to also send the email
 */
export async function GET(request: NextRequest) {
  // Always verify cron secret (no dev bypass for security)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    console.error("[Daily Summary] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[Daily Summary] Generating summary...")

    const summary = await generateDailySummary()

    const format = request.nextUrl.searchParams.get("format") || "json"

    console.log("[Daily Summary] Generated:", {
      urgentItems: summary.urgentItems.length,
      upcomingItems: summary.upcomingItems.length,
      recentEmails: summary.recentEmails.length,
    })

    if (format === "text") {
      const text = await formatSummaryAsText(summary)
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain" },
      })
    }

    if (format === "html") {
      const html = await formatSummaryAsHtml(summary)
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      })
    }

    // Check if we should send the email
    const shouldSend = request.nextUrl.searchParams.get("send") === "true"

    let emailResult = null
    if (shouldSend) {
      console.log("[Daily Summary] Sending email...")
      emailResult = await sendDailySummaryEmail()
    }

    // Default: JSON
    return NextResponse.json({
      success: true,
      summary,
      emailSent: shouldSend ? emailResult?.success : false,
      emailMessageId: emailResult?.messageId,
      message: `Generated summary with ${summary.urgentItems.length} urgent items${shouldSend ? (emailResult?.success ? " - email sent" : " - email failed") : ""}`,
    })
  } catch (error) {
    console.error("[Daily Summary] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/daily-summary
 * Generates the daily summary and sends it via email.
 * Also checks for urgent items and sends notifications.
 */
export async function POST(request: NextRequest) {
  // Always verify cron secret (no dev bypass for security)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    console.error("[Daily Summary] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[Daily Summary] Starting scheduled summary...")

    // Generate UI alerts first
    console.log("[Daily Summary] Generating UI alerts...")
    const alertResults = await generateAlerts()
    console.log("[Daily Summary] Alert generation:", {
      created: alertResults.created,
      resolved: alertResults.resolved,
      errors: alertResults.errors.length,
    })

    // Clean up old alerts
    const cleanupResults = await cleanupAlerts()
    console.log("[Daily Summary] Alert cleanup:", cleanupResults)

    // Check and send urgent notifications (email)
    const urgentResult = await checkAndSendUrgentNotifications()
    console.log("[Daily Summary] Urgent notifications:", urgentResult)

    // Send daily summary email
    const summaryResult = await sendDailySummaryEmail()

    return NextResponse.json({
      success: true,
      summary: {
        emailSent: summaryResult.success,
        messageId: summaryResult.messageId,
        error: summaryResult.error,
      },
      alerts: {
        created: alertResults.created,
        resolved: alertResults.resolved,
        errors: alertResults.errors,
        cleanup: cleanupResults,
      },
      urgentNotifications: urgentResult,
      message: summaryResult.success
        ? "Daily summary sent successfully"
        : `Failed to send summary: ${summaryResult.error}`,
    })
  } catch (error) {
    console.error("[Daily Summary] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
export const maxDuration = 60
