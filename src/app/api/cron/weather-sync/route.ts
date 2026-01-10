import { NextRequest, NextResponse } from "next/server"
import { syncWeatherAlerts } from "@/lib/weather/sync"

/**
 * GET /api/cron/weather-sync
 * Cron endpoint for weather alert sync - runs every 30 minutes.
 * Requires CRON_SECRET for authentication.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization")
    const secret = authHeader?.replace("Bearer ", "")

    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Cron] Starting weather alert sync...")

    const result = await syncWeatherAlerts()

    console.log("[Cron] Weather sync complete:", result)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[Cron] Weather sync error:", error)
    return NextResponse.json(
      { error: "Weather sync failed", details: String(error) },
      { status: 500 }
    )
  }
}
