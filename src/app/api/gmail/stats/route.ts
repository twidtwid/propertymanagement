import { NextResponse } from "next/server"
import { getCommunicationStats } from "@/lib/actions"

/**
 * GET /api/gmail/stats
 * Returns email communication statistics.
 */
export async function GET() {
  try {
    const stats = await getCommunicationStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error("[Stats] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
