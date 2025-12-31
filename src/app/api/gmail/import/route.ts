import { NextRequest, NextResponse } from "next/server"
import { importHistoricalEmails } from "@/lib/gmail/sync"

/**
 * POST /api/gmail/import
 * Import historical emails for a date range.
 *
 * Body: { startDate: string, endDate: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    console.log(`[Import] Starting historical import from ${startDate} to ${endDate}`)

    const result = await importHistoricalEmails(start, end)

    console.log("[Import] Complete:", result)

    const message = result.success
      ? `Imported ${result.emailsStored} emails (${result.emailsMatched} matched to vendors)`
      : "Import failed"

    return NextResponse.json({
      ...result,
      message,
    })
  } catch (error) {
    console.error("[Import] Error:", error)
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
 * GET /api/gmail/import
 * Get import status/history.
 */
export async function GET() {
  // For now, just return a placeholder
  // Could be extended to show import history from a log table
  return NextResponse.json({
    status: "ready",
    message: "POST to this endpoint to start an import",
    example: {
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    },
  })
}

export const maxDuration = 300 // 5 minutes max for large imports
