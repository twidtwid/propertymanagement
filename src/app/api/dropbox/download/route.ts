import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getConnectedDropboxEmail, getDownloadLink } from "@/lib/dropbox"

/**
 * GET /api/dropbox/download
 * Get a temporary download link for a file.
 * Query params:
 *   - path: full file path in Dropbox
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get whichever account has Dropbox connected
    const targetEmail = await getConnectedDropboxEmail()
    if (!targetEmail) {
      return NextResponse.json({ error: "Dropbox not connected" }, { status: 400 })
    }

    const path = request.nextUrl.searchParams.get("path")
    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    // Security: Block access to Personal folder
    const normalizedPath = path.toLowerCase()
    if (normalizedPath.startsWith("/personal") || normalizedPath.includes("/personal/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const link = await getDownloadLink(targetEmail, path)
    return NextResponse.json({ link })
  } catch (error) {
    console.error("Error getting download link:", error)
    return NextResponse.json(
      { error: "Failed to get download link" },
      { status: 500 }
    )
  }
}
