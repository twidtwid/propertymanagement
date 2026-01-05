import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

interface FileSummary {
  id: string
  user_description: string | null
  summary: string | null
}

/**
 * GET /api/dropbox/description
 * Get user description for a file
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const path = request.nextUrl.searchParams.get("path")
    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    const row = await queryOne<FileSummary>(
      `SELECT id, user_description, summary FROM dropbox_file_summaries WHERE dropbox_path = $1`,
      [path]
    )

    return NextResponse.json({
      description: row?.user_description || row?.summary || null,
      isUserDescription: !!row?.user_description,
    })
  } catch (error) {
    console.error("Error getting description:", error)
    return NextResponse.json({ error: "Failed to get description" }, { status: 500 })
  }
}

/**
 * POST /api/dropbox/description
 * Set user description for a file
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { path, description } = await request.json()
    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    // Upsert the description
    await query(
      `INSERT INTO dropbox_file_summaries (dropbox_path, file_name, user_description)
       VALUES ($1, $2, $3)
       ON CONFLICT (dropbox_path)
       DO UPDATE SET user_description = $3, updated_at = NOW()`,
      [path, path.split("/").pop() || "unknown", description || null]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving description:", error)
    return NextResponse.json({ error: "Failed to save description" }, { status: 500 })
  }
}
