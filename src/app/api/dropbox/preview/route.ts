import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getConnectedDropboxEmail, getDownloadLink } from "@/lib/dropbox"

/**
 * GET /api/dropbox/preview
 * Proxy a file for inline preview (images and PDFs).
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

    // Determine content type from extension
    const ext = path.split(".").pop()?.toLowerCase() || ""
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    }

    const contentType = contentTypeMap[ext]
    if (!contentType) {
      return NextResponse.json({ error: "File type not supported for preview" }, { status: 400 })
    }

    // Get temporary download link and fetch the file content
    const downloadUrl = await getDownloadLink(targetEmail, path)
    const fileResponse = await fetch(downloadUrl)

    if (!fileResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch file from Dropbox" }, { status: 500 })
    }

    const fileBuffer = await fileResponse.arrayBuffer()

    // Return the file with proper content type for inline display
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(path.split("/").pop() || "file")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Error previewing file:", error)
    return NextResponse.json(
      { error: "Failed to preview file" },
      { status: 500 }
    )
  }
}
