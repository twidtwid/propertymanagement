import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { queryOne } from "@/lib/db"
import type { Profile } from "@/types/database"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email } = result.data

    // Find user (stub auth - no password check)
    const user = await queryOne<Profile>(
      "SELECT id, email, full_name, role FROM profiles WHERE email = $1",
      [email]
    )

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      )
    }

    // Create auth cookie
    const authUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    }

    const cookieStore = cookies()
    cookieStore.set("auth_user", JSON.stringify(authUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return NextResponse.json({ success: true, user: authUser })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
