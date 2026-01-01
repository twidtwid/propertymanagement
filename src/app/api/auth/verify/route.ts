import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyMagicLink } from "@/lib/auth"

const verifySchema = z.object({
  token: z.string().min(1),
})

/**
 * POST /api/auth/verify
 * Verify a magic link token and create a session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = verifySchema.parse(body)

    const user = await verifyMagicLink(token)

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired login link. Please request a new one." },
        { status: 401 }
      )
    }

    // Set auth cookie directly in the API route
    const cookieStore = cookies()
    cookieStore.set("auth_user", JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    console.error("Verify token error:", error)
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}
