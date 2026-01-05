import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getConnectedDropboxEmail, uploadFile, createFolder } from "@/lib/dropbox"

/**
 * POST /api/dropbox/upload
 * Upload a file to Dropbox.
 * FormData:
 *   - file: the file to upload
 *   - path: target folder path in Dropbox (e.g., "/Tickets/abc123")
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

    // Get whichever account has Dropbox connected
    const targetEmail = await getConnectedDropboxEmail()
    if (!targetEmail) {
      return NextResponse.json({ error: "Dropbox not connected" }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folderPath = formData.get("path") as string | null

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    if (!folderPath) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    // Security: Block uploads to Personal folder
    const normalizedPath = folderPath.toLowerCase()
    if (normalizedPath.startsWith("/personal") || normalizedPath.includes("/personal/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Validate file type (images only)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
    }

    // Ensure folder exists
    await createFolder(targetEmail, folderPath)

    // Upload the file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filePath = `${folderPath}/${file.name}`

    const result = await uploadFile(targetEmail, filePath, buffer)

    return NextResponse.json({
      success: true,
      file: {
        name: result.name,
        path: result.path_display,
        size: result.size,
      },
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
