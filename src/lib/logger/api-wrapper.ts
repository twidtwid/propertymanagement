/**
 * API Route Wrapper
 *
 * Wraps Next.js API route handlers with:
 * - Request context initialization
 * - Automatic request/response logging
 * - Error capturing with stack traces
 * - Duration tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { requestContext, createRequestContext } from './context'
import { getLogger } from './contextual'

type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

/**
 * Wrap an API route handler with logging and context
 *
 * @example
 * // In /api/billing/confirm/route.ts
 * export const POST = withLogging(async (request) => {
 *   const log = getLogger('api.billing')
 *   // ... handle request
 *   return NextResponse.json({ success: true })
 * })
 */
export function withLogging(handler: RouteHandler): RouteHandler {
  return async (request, routeContext) => {
    const user = await getUser()

    const ctx = createRequestContext(
      user,
      request.nextUrl.pathname,
      request.method,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      request.headers.get('user-agent')
    )

    return requestContext.run(ctx, async () => {
      const log = getLogger('api')

      log.info('Request started', {
        method: request.method,
        query: Object.fromEntries(request.nextUrl.searchParams),
      })

      try {
        const response = await handler(request, routeContext)

        log.info('Request completed', {
          status: response.status,
          duration: Date.now() - ctx.startTime,
        })

        // Add request ID to response headers for tracing
        const headers = new Headers(response.headers)
        headers.set('x-request-id', ctx.requestId)

        return new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      } catch (error) {
        log.error('Request failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          duration: Date.now() - ctx.startTime,
        })

        // Re-throw to let Next.js handle the error response
        throw error
      }
    })
  }
}

/**
 * Create a wrapped handler that also parses JSON body
 */
export function withLoggingAndBody<T>(
  handler: (request: NextRequest, body: T, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
): RouteHandler {
  return withLogging(async (request, routeContext) => {
    const body = await request.json() as T
    return handler(request, body, routeContext)
  })
}
