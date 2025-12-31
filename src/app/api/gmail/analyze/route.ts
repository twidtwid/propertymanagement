import { NextRequest, NextResponse } from "next/server"
import { isGmailConnected, analyzeEmails, formatAnalysisSummary } from "@/lib/gmail"
import { z } from "zod"

const analyzeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
})

/**
 * POST /api/gmail/analyze
 * Analyze emails for a date range and return a report.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const result = analyzeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const targetEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"

    // Check if Gmail is connected
    const connected = await isGmailConnected(targetEmail)
    if (!connected) {
      return NextResponse.json(
        { error: "Gmail is not connected. Please connect Gmail first." },
        { status: 400 }
      )
    }

    const startDate = new Date(result.data.startDate)
    const endDate = new Date(result.data.endDate)

    // Validate date range
    if (startDate > endDate) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 }
      )
    }

    // Run the analysis
    const report = await analyzeEmails(targetEmail, startDate, endDate)

    // Generate formatted summary
    const summary = formatAnalysisSummary(report)

    return NextResponse.json({
      report,
      summary,
    })
  } catch (error) {
    console.error("Error analyzing emails:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/gmail/analyze
 * Quick endpoint to analyze all of 2025 (for convenience).
 */
export async function GET() {
  try {
    const targetEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"

    // Check if Gmail is connected
    const connected = await isGmailConnected(targetEmail)
    if (!connected) {
      return NextResponse.json(
        { error: "Gmail is not connected. Please connect Gmail first." },
        { status: 400 }
      )
    }

    // Analyze all of 2025
    const startDate = new Date("2025-01-01")
    const endDate = new Date("2025-12-31")

    const report = await analyzeEmails(targetEmail, startDate, endDate)
    const summary = formatAnalysisSummary(report)

    return NextResponse.json({
      report,
      summary,
    })
  } catch (error) {
    console.error("Error analyzing emails:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
