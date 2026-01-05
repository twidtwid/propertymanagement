import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getConnectedDropboxEmail, deleteFile } from "@/lib/dropbox"

/**
 * DELETE /api/dropbox/delete
 * Delete a file from Dropbox.
 * Query params:
 *   - path: full file path in Dropbox
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const targetEmail = await getConnectedDropboxEmail()
    if (!targetEmail) {
      return NextResponse.json({ error: "Dropbox not connected" }, { status: 400 })
    }

    const path = request.nextUrl.searchParams.get("path")
    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    // Security: Block deletion from Personal folder
    const normalizedPath = path.toLowerCase()
    if (normalizedPath.startsWith("/personal") || normalizedPath.includes("/personal/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only allow deletion from Tickets folder
    if (!normalizedPath.includes("/tickets/")) {
      return NextResponse.json({ error: "Can only delete ticket photos" }, { status: 403 })
    }

    await deleteFile(targetEmail, path)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    )
  }
}
