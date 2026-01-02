/**
 * API route authentication wrapper.
 *
 * Provides consistent auth enforcement for all API routes.
 * Use this to protect API endpoints that aren't covered by middleware.
 */

import { NextRequest, NextResponse } from "next/server"
import { getUser, type AuthUser } from "./auth"

export type ApiHandler = (
  req: NextRequest,
  context: { user: AuthUser; params?: Record<string, string> }
) => Promise<Response>

export interface ApiAuthOptions {
  /** Only allow users with 'owner' role */
  ownerOnly?: boolean
}

/**
 * Wrap an API route handler with authentication.
 *
 * @example
 * // Basic auth (any authenticated user)
 * export const GET = withApiAuth(async (req, { user }) => {
 *   return Response.json({ message: `Hello ${user.email}` })
 * })
 *
 * @example
 * // Owner-only route
 * export const POST = withApiAuth(
 *   async (req, { user }) => {
 *     // Only owners can access this
 *     return Response.json({ success: true })
 *   },
 *   { ownerOnly: true }
 * )
 */
export function withApiAuth(
  handler: ApiHandler,
  options?: ApiAuthOptions
): (req: NextRequest, context?: { params?: Record<string, string> }) => Promise<Response> {
  return async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      const user = await getUser()

      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }

      if (options?.ownerOnly && user.role !== "owner") {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        )
      }

      return handler(req, { user, params: context?.params })
    } catch (error) {
      console.error("API auth error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
}

/**
 * Wrap an API route handler with cron authentication.
 * Requires CRON_SECRET in Authorization header or query param.
 */
export function withCronAuth(
  handler: (req: NextRequest) => Promise<Response>
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error("CRON_SECRET not configured")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Check Authorization header
    const authHeader = req.headers.get("authorization")
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null

    // Check query parameter as fallback
    const queryToken = req.nextUrl.searchParams.get("secret")

    const providedSecret = headerToken || queryToken

    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    return handler(req)
  }
}

/**
 * Utility to check if current user is an owner.
 * Use in server components or server actions.
 */
export async function isOwner(): Promise<boolean> {
  const user = await getUser()
  return user?.role === "owner"
}

/**
 * Utility to require owner role, throwing if not.
 * Use in server actions.
 */
export async function requireOwnerRole(): Promise<AuthUser> {
  const user = await getUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  if (user.role !== "owner") {
    throw new Error("Forbidden")
  }
  return user
}
