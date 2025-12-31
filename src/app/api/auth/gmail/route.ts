import { NextResponse } from "next/server"
import { getAuthUrl, getGmailConnectionInfo, revokeTokens } from "@/lib/gmail"

/**
 * GET /api/auth/gmail
 * Returns the Gmail connection status and OAuth URL.
 */
export async function GET() {
  try {
    const targetEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
    const connectionInfo = await getGmailConnectionInfo(targetEmail)
    const authUrl = getAuthUrl()

    return NextResponse.json({
      ...connectionInfo,
      authUrl,
    })
  } catch (error) {
    console.error("Error getting Gmail status:", error)
    return NextResponse.json(
      { error: "Failed to get Gmail connection status" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/gmail
 * Disconnects Gmail by revoking and removing tokens.
 */
export async function DELETE() {
  try {
    const targetEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
    await revokeTokens(targetEmail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error disconnecting Gmail:", error)
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    )
  }
}
