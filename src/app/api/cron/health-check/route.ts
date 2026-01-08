import { NextRequest, NextResponse } from "next/server"
import { runHealthChecks } from "@/lib/health/runner"

/**
 * POST /api/cron/health-check
 * Runs all health checks and sends Pushover notifications on failures.
 * Should be called every 15 minutes by cron.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    console.error("[Health] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[Health] Running health checks...")
    const { results, summary } = await runHealthChecks()

    console.log("[Health] Results:", {
      passed: summary.passed,
      failed: summary.failed,
      notified: summary.notified,
      recovered: summary.recovered,
    })

    // Log details for any failures
    for (const result of results) {
      if (!result.result.ok) {
        console.log(`[Health] ${result.name}: ${result.result.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      checks: results.map((r) => ({
        name: r.name,
        ok: r.result.ok,
        message: r.result.message,
        status: r.newStatus,
        notified: r.notified,
        recovered: r.recovered,
      })),
    })
  } catch (error) {
    console.error("[Health] Error running health checks:", error)
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
 * GET /api/cron/health-check
 * Returns current health status without sending notifications.
 * Useful for manual checks.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Import checks directly for read-only check
  const { healthChecks } = await import("@/lib/health/checks")

  const checks = await Promise.all(
    healthChecks.map(async (check) => {
      try {
        const result = await check.check()
        return {
          name: check.name,
          ok: result.ok,
          message: result.message,
          severity: check.severity,
          details: result.details,
        }
      } catch (error) {
        return {
          name: check.name,
          ok: false,
          message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          severity: check.severity,
        }
      }
    })
  )

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok).length

  return NextResponse.json({
    status: failed === 0 ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    summary: { total: checks.length, passed, failed },
    checks,
  })
}

export const dynamic = "force-dynamic"
export const maxDuration = 30
