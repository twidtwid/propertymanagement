import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { runDropboxSync } from "@/lib/dropbox/sync"

/**
 * POST /api/dropbox/sync
 * Run Dropbox sync - scan files, generate summaries, update counts.
 *
 * Query params:
 *   - force: "true" to regenerate all summaries
 *   - secret: CRON_SECRET for automated calls
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const forceRegenerate = searchParams.get("force") === "true"
    const secret = searchParams.get("secret")

    // Allow either authenticated owner or cron secret
    const cronSecret = process.env.CRON_SECRET
    const isCronCall = cronSecret && secret === cronSecret

    if (!isCronCall) {
      const user = await getUser()
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      if (user.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    console.log(`[Dropbox Sync] Starting${forceRegenerate ? " (force regenerate)" : ""}...`)

    const result = await runDropboxSync({
      forceRegenerate,
      verbose: true
    })

    console.log(`[Dropbox Sync] Complete:`, result)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("[Dropbox Sync] Error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}
