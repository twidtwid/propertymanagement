import { NextResponse } from "next/server"
import { syncAllSmartPins } from "@/lib/actions"

/**
 * Sync smart pins hourly
 * Run via cron: 0 * * * * (every hour on the hour)
 *
 * Usage:
 * curl -X POST "https://spmsystem.com/api/cron/sync-smart-pins" \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[Smart Pins Sync] Starting hourly sync...")
    const startTime = Date.now()

    await syncAllSmartPins()

    const duration = Date.now() - startTime
    console.log(`[Smart Pins Sync] Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: "Smart pins synced successfully",
      duration_ms: duration,
    })
  } catch (error) {
    console.error("[Smart Pins Sync] Error:", error)
    return NextResponse.json(
      {
        error: "Sync failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Allow GET for easy testing
export async function GET(request: Request) {
  return POST(request)
}
