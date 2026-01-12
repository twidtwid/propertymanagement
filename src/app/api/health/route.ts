import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { getWeatherHealth } from "@/lib/weather"
import packageJson from "../../../../package.json"
import fs from "fs"
import os from "os"

/**
 * GET /api/health
 * Comprehensive health check endpoint for monitoring and load balancers.
 * Returns database, worker, disk space, token expiry, and weather service status.
 */
export async function GET() {
  const timestamp = new Date().toISOString()
  const healthChecks: Record<string, any> = {}
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok'

  try {
    // 1. Test database connectivity
    const dbResult = await query<{ now: Date }>("SELECT NOW() as now")
    const dbConnected = dbResult.length > 0
    healthChecks.database = {
      status: dbConnected ? 'connected' : 'disconnected',
      latency: dbResult[0] ? 'ok' : 'error'
    }

    if (!dbConnected) {
      overallStatus = 'error'
    }

    // 2. Check worker health from health_check_state table
    const workerHealth = await query<{
      check_name: string
      status: string
      last_checked_at: Date
      failure_count: number
    }>(`
      SELECT check_name, status, last_checked_at, failure_count
      FROM health_check_state
      WHERE check_name IN ('email_sync', 'daily_summary')
    `)

    healthChecks.workers = {}
    const now = new Date()
    for (const worker of workerHealth) {
      const minutesSinceCheck = (now.getTime() - new Date(worker.last_checked_at).getTime()) / 1000 / 60
      const isStale = minutesSinceCheck > 30 // Consider stale if no update in 30 minutes
      const workerStatus = isStale ? 'stale' : worker.status

      healthChecks.workers[worker.check_name] = {
        status: workerStatus,
        lastChecked: worker.last_checked_at,
        minutesSinceCheck: Math.round(minutesSinceCheck),
        failureCount: worker.failure_count
      }

      if (workerStatus === 'critical' || isStale) {
        overallStatus = overallStatus === 'error' ? 'error' : 'degraded'
      }
    }

    // 3. Check OAuth token expiry
    const dropboxToken = await queryOne<{ token_expiry: Date | null }>(`
      SELECT token_expiry FROM dropbox_oauth_tokens LIMIT 1
    `)

    const gmailToken = await queryOne<{ token_expiry: Date | null }>(`
      SELECT token_expiry FROM gmail_oauth_tokens LIMIT 1
    `)

    // Check Nest OAuth token from camera_credentials (encrypted storage)
    let nestTokenStatus: any = { status: 'not_configured' }
    try {
      const { getNestCredentials } = await import('@/lib/cameras/nest-auth')
      const nestCreds = await getNestCredentials()
      const expiresAt = new Date(nestCreds.expires_at)
      const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000 / 60

      nestTokenStatus = {
        expiresAt: expiresAt.toISOString(),
        isValid: expiresAt > now,
        minutesUntilExpiry: Math.round(minutesUntilExpiry),
        needsRefresh: minutesUntilExpiry < 5
      }

      // Mark as degraded if token expires in less than 5 minutes (shouldn't happen with auto-refresh)
      if (minutesUntilExpiry < 5 && overallStatus === 'ok') {
        overallStatus = 'degraded'
      }
    } catch (error) {
      nestTokenStatus = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      if (overallStatus === 'ok') {
        overallStatus = 'degraded'
      }
    }

    healthChecks.tokens = {
      dropbox: dropboxToken?.token_expiry
        ? {
            expiresAt: dropboxToken.token_expiry,
            isValid: new Date(dropboxToken.token_expiry) > now
          }
        : { status: 'not_configured' },
      gmail: gmailToken?.token_expiry
        ? {
            expiresAt: gmailToken.token_expiry,
            isValid: new Date(gmailToken.token_expiry) > now
          }
        : { status: 'not_configured' },
      nest: nestTokenStatus
    }

    // 4. Check disk space (only on Node.js runtime)
    if (process.env.NEXT_RUNTIME !== 'edge') {
      try {
        const stats = fs.statfsSync('/')
        const totalGB = (stats.blocks * stats.bsize) / (1024 ** 3)
        const availableGB = (stats.bavail * stats.bsize) / (1024 ** 3)
        const usedGB = totalGB - availableGB
        const usedPercent = (usedGB / totalGB) * 100

        healthChecks.diskSpace = {
          totalGB: Math.round(totalGB * 10) / 10,
          usedGB: Math.round(usedGB * 10) / 10,
          availableGB: Math.round(availableGB * 10) / 10,
          usedPercent: Math.round(usedPercent * 10) / 10,
          status: usedPercent > 90 ? 'critical' : usedPercent > 80 ? 'warning' : 'ok'
        }

        if (usedPercent > 90) {
          overallStatus = overallStatus === 'error' ? 'error' : 'degraded'
        }
      } catch (error) {
        healthChecks.diskSpace = { status: 'unavailable', error: 'Cannot check disk space in containerized environment' }
      }
    }

    // 5. Get weather service health
    const weatherHealth = getWeatherHealth()
    healthChecks.weather = {
      status: weatherHealth.isHealthy ? 'healthy' : 'degraded',
      lastSuccess: weatherHealth.lastSuccessfulFetch?.toISOString() || null,
      consecutiveFailures: weatherHealth.consecutiveFailures,
      lastError: weatherHealth.lastError,
    }

    // Weather being degraded doesn't affect overall status

    // 6. System info
    healthChecks.system = {
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    }

    return NextResponse.json({
      status: overallStatus,
      timestamp,
      version: packageJson.version,
      environment: process.env.NODE_ENV || "development",
      checks: healthChecks
    })
  } catch (error) {
    // Return 503 Service Unavailable if health checks fail
    return NextResponse.json(
      {
        status: "error",
        timestamp,
        version: packageJson.version,
        error: error instanceof Error ? error.message : "Health check failed",
        checks: healthChecks
      },
      { status: 503 }
    )
  }
}

// Disable caching for health checks
export const dynamic = "force-dynamic"
