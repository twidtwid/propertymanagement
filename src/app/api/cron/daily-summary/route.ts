import { NextRequest, NextResponse } from "next/server"
import { generateDailySummary, formatSummaryAsText, formatSummaryAsHtml } from "@/lib/daily-summary"

/**
 * GET /api/cron/daily-summary
 * Generates and returns the daily summary.
 * Can be called manually or by a cron job.
 *
 * Query params:
 *   format=text|html|json (default: json)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow in development without secret
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
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
      const text = formatSummaryAsText(summary)
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain" },
      })
    }

    if (format === "html") {
      const html = formatSummaryAsHtml(summary)
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      })
    }

    // Default: JSON
    return NextResponse.json({
      success: true,
      summary,
      message: `Generated summary with ${summary.urgentItems.length} urgent items`,
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
