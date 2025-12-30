"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { queryOne } from "./db"
import type { Profile } from "@/types/database"

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: "owner" | "bookkeeper"
}

export async function getUser(): Promise<AuthUser | null> {
  const cookieStore = cookies()
  const authCookie = cookieStore.get("auth_user")

  if (!authCookie?.value) {
    return null
  }

  try {
    const userData = JSON.parse(authCookie.value) as AuthUser
    return userData
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser()
  if (!user) {
    redirect("/auth/login")
  }
  return user
}

export async function requireOwner(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== "owner") {
    redirect("/")
  }
  return user
}

export async function login(email: string): Promise<AuthUser | null> {
  // Stub auth - in production, verify password hash
  const user = await queryOne<Profile>(
    "SELECT id, email, full_name, role FROM profiles WHERE email = $1",
    [email]
  )

  if (!user) {
    return null
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  }

  // Set auth cookie
  const cookieStore = cookies()
  cookieStore.set("auth_user", JSON.stringify(authUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  return authUser
}

export async function logout() {
  const cookieStore = cookies()
  cookieStore.delete("auth_user")
  redirect("/auth/login")
}
