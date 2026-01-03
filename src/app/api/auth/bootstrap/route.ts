import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { queryOne } from "@/lib/db"
import type { Profile } from "@/types/database"

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/bootstrap?secret=xxx&email=xxx
 *
 * Temporary bootstrap endpoint to create a session without email.
 * Used for initial production setup before Gmail OAuth is configured.
 *
 * DELETE THIS FILE after Gmail OAuth is working!
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret")
  const email = request.nextUrl.searchParams.get("email")

  // Check bootstrap secret
  const expectedSecret = process.env.CRON_SECRET
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 })
  }

  // Get user from database
  const user = await queryOne<Profile>(
    "SELECT id, email, full_name, role FROM profiles WHERE email = $1",
    [email]
  )

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Set auth cookie
  // Use COOKIE_SECURE env var to control secure flag (for HTTP testing in production)
  const isSecure = process.env.COOKIE_SECURE === "false"
    ? false
    : process.env.NODE_ENV === "production"

  const cookieStore = cookies()
  cookieStore.set("auth_user", JSON.stringify({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  }), {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  // Redirect to dashboard
  return NextResponse.redirect(new URL("/", request.url))
}
