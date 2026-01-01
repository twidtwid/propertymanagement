import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Paths that don't require authentication
const publicPaths = ["/auth/login", "/auth/signup", "/auth/callback", "/auth/verify"]

// Paths that bookkeepers can access
const bookeeperPaths = ["/", "/payments", "/settings"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for auth cookie (stub auth - just checks if cookie exists)
  const authCookie = request.cookies.get("auth_user")

  // If no auth cookie, redirect to login
  if (!authCookie?.value) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Parse user role from cookie (in production, verify JWT)
  try {
    const userData = JSON.parse(authCookie.value)

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
  } catch {
    // Invalid cookie, redirect to login
    const response = NextResponse.redirect(new URL("/auth/login", request.url))
    response.cookies.delete("auth_user")
    return response
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
