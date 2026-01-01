"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { query, queryOne } from "./db"
import { randomBytes } from "crypto"
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

/**
 * Create a magic link token for passwordless login.
 * Token is valid for 15 minutes.
 */
export async function createMagicLink(email: string): Promise<{ token: string; exists: boolean }> {
  // Check if user exists
  const user = await queryOne<Profile>(
    "SELECT id FROM profiles WHERE email = $1",
    [email]
  )

  if (!user) {
    return { token: "", exists: false }
  }

  // Generate secure token
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  // Delete any existing unused tokens for this email
  await query(
    "DELETE FROM magic_link_tokens WHERE email = $1 AND used_at IS NULL",
    [email]
  )

  // Store new token
  await query(
    "INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)",
    [email, token, expiresAt.toISOString()]
  )

  return { token, exists: true }
}

/**
 * Verify a magic link token and return the user (does NOT set cookie).
 * The API route should set the cookie using setAuthCookie().
 */
export async function verifyMagicLink(token: string): Promise<AuthUser | null> {
  // Find valid token
  const tokenRecord = await queryOne<{
    id: string
    email: string
    expires_at: Date
    used_at: Date | null
  }>(
    `SELECT id, email, expires_at, used_at
     FROM magic_link_tokens
     WHERE token = $1`,
    [token]
  )

  if (!tokenRecord) {
    return null // Token not found
  }

  if (tokenRecord.used_at) {
    return null // Token already used
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    return null // Token expired
  }

  // Mark token as used
  await query(
    "UPDATE magic_link_tokens SET used_at = NOW() WHERE id = $1",
    [tokenRecord.id]
  )

  // Get user
  const user = await queryOne<Profile>(
    "SELECT id, email, full_name, role FROM profiles WHERE email = $1",
    [tokenRecord.email]
  )

  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  }
}

/**
 * Set the auth cookie for a user.
 * Call this from API routes after verifying the user.
 */
export async function setAuthCookie(user: AuthUser): Promise<void> {
  const cookieStore = cookies()
  cookieStore.set("auth_user", JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
}

/**
 * DEPRECATED: Direct login is no longer supported.
 * Use magic links via createMagicLink() and verifyMagicLink() instead.
 */
export async function login(_email: string): Promise<AuthUser | null> {
  console.warn("Direct login is disabled - use magic links instead")
  return null
}

export async function logout() {
  const cookieStore = cookies()
  cookieStore.delete("auth_user")
  redirect("/auth/login")
}
