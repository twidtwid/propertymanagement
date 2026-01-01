import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createMagicLink } from "@/lib/auth"
import { sendEmail } from "@/lib/gmail"

const requestSchema = z.object({
  email: z.string().email(),
})

/**
 * POST /api/auth/magic-link
 * Request a magic link for passwordless login.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = requestSchema.parse(body)

    // Create magic link token
    const { token, exists } = await createMagicLink(email)

    if (!exists) {
      // Don't reveal whether email exists - return success anyway
      // This prevents email enumeration attacks
      return NextResponse.json({
        success: true,
        message: "If an account exists, a login link has been sent.",
      })
    }

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const magicLinkUrl = `${baseUrl}/auth/verify?token=${token}`

    // Send email via Gmail API
    const notificationEmail = process.env.NOTIFICATION_EMAIL
    if (!notificationEmail) {
      console.error("NOTIFICATION_EMAIL not configured - cannot send magic link")
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      )
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #1d4ed8; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Property Management</div>
  </div>

  <p>Hi,</p>

  <p>Click the button below to sign in to your Property Management account:</p>

  <p style="text-align: center;">
    <a href="${magicLinkUrl}" class="button">Sign In</a>
  </p>

  <p>Or copy and paste this link into your browser:</p>
  <p style="word-break: break-all; color: #6b7280; font-size: 14px;">
    ${magicLinkUrl}
  </p>

  <div class="warning">
    This link expires in 15 minutes and can only be used once.
  </div>

  <div class="footer">
    <p>If you didn't request this email, you can safely ignore it.</p>
    <p>Property Management System</p>
  </div>
</body>
</html>
`

    try {
      await sendEmail(
        notificationEmail,
        email,
        "Sign in to Property Management",
        htmlBody
      )
    } catch (emailError) {
      console.error("Failed to send magic link email:", emailError)
      return NextResponse.json(
        { error: "Failed to send login email. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists, a login link has been sent.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    console.error("Magic link error:", error)
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}
