import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Paths that don't require authentication
const publicPaths = ["/auth/login", "/auth/signup", "/auth/callback", "/auth/verify"]

// Paths that bookkeepers can access
const bookeeperPaths = ["/", "/payments", "/settings"]

// Edge-compatible session verification using Web Crypto API
async function verifySessionEdge<T>(signedValue: string): Promise<T | null> {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    console.error("AUTH_SECRET not configured or too short")
    return null
  }

  const parts = signedValue.split(".")
  if (parts.length !== 2) {
    return null
  }

  const [encodedPayload, providedSignature] = parts

  try {
    // Import the secret key for HMAC
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    // Compute expected signature
    const signatureArrayBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(encodedPayload)
    )

    // Convert to base64url
    const signatureBytes = new Uint8Array(signatureArrayBuffer)
    let base64 = ""
    for (let i = 0; i < signatureBytes.length; i++) {
      base64 += String.fromCharCode(signatureBytes[i])
    }
    const expectedSignature = btoa(base64)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")

    // Compare signatures
    if (providedSignature !== expectedSignature) {
      return null
    }

    // Signature valid, decode payload
    const padded = encodedPayload + "=".repeat((4 - (encodedPayload.length % 4)) % 4)
    const base64Str = padded.replace(/-/g, "+").replace(/_/g, "/")
    const payload = atob(base64Str)
    return JSON.parse(payload) as T
  } catch {
    return null
  }
}

interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: "owner" | "bookkeeper"
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get("auth_user")

  // If no auth cookie, redirect to login
  if (!authCookie?.value) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify signature and parse user data
  const userData = await verifySessionEdge<AuthUser>(authCookie.value)

  if (!userData) {
    // Invalid or tampered cookie, redirect to login
    const response = NextResponse.redirect(new URL("/auth/login", request.url))
    response.cookies.delete("auth_user")
    return response
  }

  // Bookkeeper role restrictions
  if (userData.role === "bookkeeper") {
    const canAccess = bookeeperPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    )
    if (!canAccess) {
      // Redirect bookkeepers to dashboard if accessing restricted pages
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
