import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, storeTokens } from "@/lib/dropbox/auth"

/**
 * Get the base URL for redirects (handles reverse proxy correctly)
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://spmsystem.com"
}

/**
 * GET /api/auth/dropbox/callback
 * Handles the OAuth callback from Dropbox.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const baseUrl = getBaseUrl()

  // Handle errors from Dropbox
  if (error) {
    console.error("OAuth error from Dropbox:", error, errorDescription)
    return NextResponse.redirect(
      `${baseUrl}/settings/dropbox?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // Validate code parameter
  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings/dropbox?error=missing_code`
    )
  }

  try {
    // Exchange code for tokens
    const credentials = await exchangeCodeForTokens(code)

    // Use the configured notification email (we know who's connecting)
    const userEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"

    // Store tokens in database
    await storeTokens(userEmail, credentials)

    // Redirect to settings page with success
    return NextResponse.redirect(
      `${baseUrl}/settings/dropbox?success=true`
    )
  } catch (error) {
    console.error("Error handling Dropbox OAuth callback:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return NextResponse.redirect(
      `${baseUrl}/settings/dropbox?error=${encodeURIComponent(errorMessage)}`
    )
  }
}
