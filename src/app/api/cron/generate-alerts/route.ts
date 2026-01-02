/**
 * Cron endpoint to generate alerts
 * Run daily with daily summary, or manually trigger
 *
 * Authentication: Requires CRON_SECRET header
 */

import { NextResponse } from "next/server"
import { generateAlerts, cleanupAlerts } from "@/lib/alerts/generate"

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Generate new alerts and resolve stale ones
    const generateResults = await generateAlerts()

    // Clean up expired alerts
    const cleanupResults = await cleanupAlerts()

    return NextResponse.json({
      success: true,
      generated: {
        created: generateResults.created,
        resolved: generateResults.resolved,
        errors: generateResults.errors,
      },
      cleanup: {
        dismissed: cleanupResults.dismissed,
        deleted: cleanupResults.deleted,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Alert generation failed:", error)
    return NextResponse.json(
      { error: "Alert generation failed", details: String(error) },
      { status: 500 }
    )
  }
}

// Also support GET for easy manual triggering
export async function GET(request: Request) {
  return POST(request)
}
