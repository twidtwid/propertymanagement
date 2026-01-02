import { NextResponse } from "next/server"
import { getAuthUrl, getDropboxConnectionInfo, revokeTokens } from "@/lib/dropbox"
import { getUser } from "@/lib/auth"

/**
 * GET /api/auth/dropbox
 * Returns the Dropbox connection status and OAuth URL.
 */
export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const targetEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
    const connectionInfo = await getDropboxConnectionInfo(targetEmail)
    const authUrl = await getAuthUrl()

    return NextResponse.json({
      ...connectionInfo,
      authUrl,
    })
  } catch (error) {
    console.error("Error getting Dropbox status:", error)
    return NextResponse.json(
      { error: "Failed to get Dropbox connection status" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/dropbox
 * Disconnects Dropbox by revoking and removing tokens.
 */
export async function DELETE() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const targetEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
    await revokeTokens(targetEmail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error disconnecting Dropbox:", error)
    return NextResponse.json(
      { error: "Failed to disconnect Dropbox" },
      { status: 500 }
    )
  }
}
