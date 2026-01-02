/**
 * Standardized API error handling utilities.
 *
 * Provides consistent error responses across all API routes.
 */

import { NextResponse } from "next/server"

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

export interface ApiSuccess<T = unknown> {
  success: true
  data?: T
  message?: string
}

/**
 * Standard error responses
 */
export const ApiErrors = {
  unauthorized: () =>
    NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    ),

  forbidden: () =>
    NextResponse.json<ApiError>(
      { error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 }
    ),

  notFound: (resource = "Resource") =>
    NextResponse.json<ApiError>(
      { error: `${resource} not found`, code: "NOT_FOUND" },
      { status: 404 }
    ),

  badRequest: (message = "Invalid request") =>
    NextResponse.json<ApiError>(
      { error: message, code: "BAD_REQUEST" },
      { status: 400 }
    ),

  validationError: (details: unknown) =>
    NextResponse.json<ApiError>(
      { error: "Validation failed", code: "VALIDATION_ERROR", details },
      { status: 400 }
    ),

  serverError: (message = "An error occurred") =>
    NextResponse.json<ApiError>(
      { error: message, code: "SERVER_ERROR" },
      { status: 500 }
    ),

  configError: (message = "Server configuration error") =>
    NextResponse.json<ApiError>(
      { error: message, code: "CONFIG_ERROR" },
      { status: 500 }
    ),
}

/**
 * Success response helper
 */
export function apiSuccess<T>(data?: T, message?: string): NextResponse {
  const response: ApiSuccess<T> = { success: true }
  if (data !== undefined) response.data = data
  if (message) response.message = message
  return NextResponse.json(response)
}

/**
 * Wrap an async handler with error catching.
 * Logs errors and returns a generic 500 response.
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error("API error:", error)
      return ApiErrors.serverError()
    }
  }
}
