import { NextRequest, NextResponse } from "next/server"
import { runDropboxSync } from "@/lib/dropbox/sync"

/**
 * GET /api/cron/dropbox-sync
 * Cron endpoint for Dropbox sync - runs every 15 minutes.
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

    console.log("[Cron] Starting Dropbox sync...")

    const result = await runDropboxSync({ verbose: true })

    console.log("[Cron] Dropbox sync complete:", result)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("[Cron] Dropbox sync error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    )
  }
}
