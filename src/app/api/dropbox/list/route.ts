import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getConnectedDropboxEmail, listFolder, listFolderContinue, searchFiles } from "@/lib/dropbox"

/**
 * GET /api/dropbox/list
 * List contents of a Dropbox folder.
 * Query params:
 *   - path: folder path (relative to root)
 *   - cursor: pagination cursor for continue
 *   - search: search query
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

    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get("path") || ""
    const cursor = searchParams.get("cursor")
    const searchQuery = searchParams.get("search")

    // Handle search
    if (searchQuery) {
      const results = await searchFiles(targetEmail, searchQuery)
      return NextResponse.json({
        entries: results,
        cursor: "",
        has_more: false,
        path,
        is_search: true,
      })
    }

    // Handle pagination continue
    if (cursor) {
      const result = await listFolderContinue(targetEmail, cursor)
      return NextResponse.json({ ...result, path })
    }

    // List folder
    const result = await listFolder(targetEmail, path)
    return NextResponse.json({ ...result, path })
  } catch (error) {
    console.error("Error listing Dropbox folder:", error)
    return NextResponse.json(
      { error: "Failed to list folder" },
      { status: 500 }
    )
  }
}
