/**
 * Request Context Module
 *
 * Uses AsyncLocalStorage to propagate request context through async operations
 * without explicit parameter passing. This enables:
 * - Correlation IDs for request tracing
 * - User attribution for audit logs
 * - Request metadata for debugging
 */

import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: 'owner' | 'bookkeeper'
}

export interface RequestContext {
  requestId: string
  user: AuthUser | null
  path: string
  method: string
  ipAddress: string | null
  userAgent: string | null
  startTime: number
}

// AsyncLocalStorage instance - persists context across async boundaries
export const requestContext = new AsyncLocalStorage<RequestContext>()

/**
 * Get the current request context, if available
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}

/**
 * Create a new request context
 */
export function createRequestContext(
  user: AuthUser | null,
  path: string,
  method: string,
  ipAddress: string | null = null,
  userAgent: string | null = null
): RequestContext {
  return {
    requestId: randomUUID(),
    user,
    path,
    method,
    ipAddress,
    userAgent,
    startTime: Date.now(),
  }
}

/**
 * Run a function within a request context
 */
export function runWithContext<T>(
  ctx: RequestContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return requestContext.run(ctx, fn)
}

/**
 * Get the current request ID, or generate a new one if not in a request context
 */
export function getRequestId(): string {
  return getRequestContext()?.requestId || randomUUID()
}

/**
 * Get the current user from context
 */
export function getCurrentUser(): AuthUser | null {
  return getRequestContext()?.user || null
}
