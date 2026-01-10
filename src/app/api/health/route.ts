import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getWeatherHealth } from "@/lib/weather"
import packageJson from "../../../../package.json"

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers.
 * Returns database and weather service status.
 */
export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    // Test database connectivity
    const result = await query<{ now: Date }>("SELECT NOW() as now")
    const dbConnected = result.length > 0

    // Get weather service health
    const weatherHealth = getWeatherHealth()

    // Overall status is degraded if weather has been failing but OK if just degraded
    const overallStatus = dbConnected ? "ok" : "error"

    return NextResponse.json({
      status: overallStatus,
      timestamp,
      services: {
        database: dbConnected ? "connected" : "disconnected",
        weather: {
          status: weatherHealth.isHealthy ? "healthy" : "degraded",
          lastSuccess: weatherHealth.lastSuccessfulFetch?.toISOString() || null,
          consecutiveFailures: weatherHealth.consecutiveFailures,
          lastError: weatherHealth.lastError,
        },
      },
      version: packageJson.version,
      environment: process.env.NODE_ENV || "development",
    })
  } catch (error) {
    // Return 503 Service Unavailable if database is down
    const weatherHealth = getWeatherHealth()

    return NextResponse.json(
      {
        status: "error",
        timestamp,
        services: {
          database: "disconnected",
          weather: {
            status: weatherHealth.isHealthy ? "healthy" : "degraded",
            lastSuccess: weatherHealth.lastSuccessfulFetch?.toISOString() || null,
            consecutiveFailures: weatherHealth.consecutiveFailures,
          },
        },
        error: "Database connection failed",
      },
      { status: 503 }
    )
  }
}

// Disable caching for health checks
export const dynamic = "force-dynamic"
