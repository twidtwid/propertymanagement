import { NextRequest, NextResponse } from "next/server"
import { syncEmails } from "@/lib/gmail/sync"

/**
 * GET /api/cron/sync-emails
 * Syncs new emails from Gmail.
 * Should be called every 10 minutes by Vercel Cron.
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
    console.log("[Cron] Starting email sync...")

    const result = await syncEmails({
      maxResults: 100,
    })

    console.log("[Cron] Sync complete:", result)

    const message = result.success
      ? `Synced ${result.emailsStored} emails (${result.emailsMatched} matched to vendors)`
      : "Sync failed"

    return NextResponse.json({
      ...result,
      message,
    })
  } catch (error) {
    console.error("[Cron] Sync error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Vercel cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 60 // 60 seconds max
