import { NextResponse } from "next/server"

/**
 * POST /api/auth/login
 *
 * DEPRECATED: Direct login is no longer supported.
 * Use magic link authentication via /api/auth/magic-link instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Direct login is disabled. Please use the magic link to sign in.",
      redirect: "/auth/login"
    },
    { status: 403 }
  )
}
