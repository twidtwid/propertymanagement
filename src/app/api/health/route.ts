import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import packageJson from "../../../../package.json"

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers.
 * Returns database connectivity status.
 */
export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    // Test database connectivity
    const result = await query<{ now: Date }>("SELECT NOW() as now")
    const dbConnected = result.length > 0

    return NextResponse.json({
      status: "ok",
      timestamp,
      services: {
        database: dbConnected ? "connected" : "disconnected",
      },
      version: packageJson.version,
      environment: process.env.NODE_ENV || "development",
    })
  } catch (error) {
    // Return 503 Service Unavailable if database is down
    return NextResponse.json(
      {
        status: "error",
        timestamp,
        services: {
          database: "disconnected",
        },
        error: "Database connection failed",
      },
      { status: 503 }
    )
  }
}

// Disable caching for health checks
export const dynamic = "force-dynamic"
