import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { query } from "@/lib/db"

interface FileSummary {
  dropbox_path: string
  summary: string
}

/**
 * GET /api/dropbox/summaries
 * Get summaries for a list of file paths.
 * Query params:
 *   - paths: comma-separated list of file paths
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pathsParam = searchParams.get("paths")

    if (!pathsParam) {
      return NextResponse.json({ summaries: {} })
    }

    const paths = pathsParam.split(",").map(p => decodeURIComponent(p))

    if (paths.length === 0) {
      return NextResponse.json({ summaries: {} })
    }

    // Query all summaries for the given paths
    const placeholders = paths.map((_, i) => `$${i + 1}`).join(", ")
    const rows = await query<FileSummary>(
      `SELECT dropbox_path, summary FROM dropbox_file_summaries WHERE dropbox_path IN (${placeholders})`,
      paths
    )

    // Convert to a map for easy lookup
    const summaries: Record<string, string> = {}
    for (const row of rows) {
      summaries[row.dropbox_path] = row.summary
    }

    return NextResponse.json({ summaries })
  } catch (error) {
    console.error("Error fetching summaries:", error)
    return NextResponse.json({ error: "Failed to fetch summaries" }, { status: 500 })
  }
}
