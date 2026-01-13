import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, storeTokens } from "@/lib/gmail/auth"

/**
 * GET /api/auth/gmail/callback
 * Handles the OAuth callback from Google.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // Use NEXT_PUBLIC_APP_URL for redirects (request.url uses HOSTNAME=0.0.0.0 in Docker)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Handle errors from Google
  if (error) {
    console.error("OAuth error from Google:", error)
    return NextResponse.redirect(
      new URL(`/settings/gmail?error=${encodeURIComponent(error)}`, baseUrl)
    )
  }

  // Validate code parameter
  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/gmail?error=missing_code", baseUrl)
    )
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Use the configured notification email (we know who's connecting)
    const userEmail = process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"

    // Store tokens in database
    await storeTokens(userEmail, tokens)

    // Redirect to settings page with success
    return NextResponse.redirect(
      new URL(`/settings/gmail?success=true&email=${encodeURIComponent(userEmail)}`, baseUrl)
    )
  } catch (error) {
    console.error("Error handling Gmail OAuth callback:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return NextResponse.redirect(
      new URL(
        `/settings/gmail?error=${encodeURIComponent(errorMessage)}`,
        baseUrl
      )
    )
  }
}
