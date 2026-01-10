import { NextResponse } from "next/server"
import { runAutopayAnalysis, getAnalysisBacklog } from "@/lib/payments/autopay-analyzer"

/**
 * Cron endpoint to analyze emails for autopay notifications.
 * Should be called periodically (e.g., every 5 minutes) to process new emails.
 *
 * This runs in the background so dashboard loads are instant.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const backlog = await getAnalysisBacklog()
    console.log(`[Cron] Autopay analysis starting, ${backlog} emails in backlog`)

    // Process up to 30 emails per run (stays under typical timeout limits)
    const result = await runAutopayAnalysis(30)

    return NextResponse.json({
      success: true,
      ...result,
      remainingBacklog: Math.max(0, backlog - result.analyzed)
    })
  } catch (error) {
    console.error("[Cron] Autopay analysis error:", error)
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    )
  }
}

// Also support GET for easy manual triggering
export async function GET(request: Request) {
  return POST(request)
}
