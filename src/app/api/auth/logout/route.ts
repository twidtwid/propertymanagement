import { NextResponse } from "next/server"
import { cookies } from "next/headers"

async function handleLogout() {
  const cookieStore = cookies()
  cookieStore.delete("auth_user")
  return NextResponse.json({ success: true })
}

export async function POST() {
  return handleLogout()
}

export async function DELETE() {
  return handleLogout()
}
