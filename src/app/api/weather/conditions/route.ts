import { NextResponse } from 'next/server'
import { fetchAllWeather, getWeatherCacheStats, WEATHER_LOCATIONS, type WeatherCondition } from '@/lib/weather'
import { notifyAll } from '@/lib/pushover'
import {
  getWeatherHealth,
  recordWeatherSuccess,
  recordWeatherFailure,
  markFailureAlertSent,
  shouldSendFailureAlert,
  getFailureDurationMinutes,
} from '@/lib/weather/health'

// In-memory cache for aggregated weather data (API-level cache)
let cachedData: WeatherCondition[] | null = null
let cacheTimestamp: number | null = null

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const FAILURE_ALERT_THRESHOLD_MS = 4 * 60 * 60 * 1000 // 4 hours

export async function GET() {
  try {
    const now = Date.now()
    const health = getWeatherHealth()

    // Return cached data if still fresh
    if (cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      const staleCount = cachedData.filter(d => d.isStale).length
      return NextResponse.json({
        data: cachedData,
        cached: true,
        cachedAt: new Date(cacheTimestamp).toISOString(),
        expiresIn: Math.round((CACHE_TTL_MS - (now - cacheTimestamp)) / 1000 / 60), // minutes
        staleLocations: staleCount,
        health: {
          isHealthy: health.isHealthy,
          consecutiveFailures: health.consecutiveFailures,
        },
      })
    }

    // Fetch fresh data (with per-location retry and cache fallback)
    const weather = await fetchAllWeather()

    // Update API-level cache
    cachedData = weather
    cacheTimestamp = now

    // Count fresh vs stale
    const staleCount = weather.filter(d => d.isStale).length
    const freshCount = weather.length - staleCount
    const missingCount = WEATHER_LOCATIONS.length - weather.length

    // Only record success if we got all locations fresh
    if (freshCount === WEATHER_LOCATIONS.length) {
      recordWeatherSuccess()
    }

    return NextResponse.json({
      data: weather,
      cached: false,
      cachedAt: new Date(now).toISOString(),
      expiresIn: 10, // minutes
      staleLocations: staleCount,
      missingLocations: missingCount,
      health: {
        isHealthy: missingCount === 0,
        consecutiveFailures: health.consecutiveFailures,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Weather conditions API error:', errorMessage)

    // Track failures
    recordWeatherFailure(errorMessage)
    const health = getWeatherHealth()

    // Check if failures have exceeded 4 hour threshold
    if (shouldSendFailureAlert(FAILURE_ALERT_THRESHOLD_MS)) {
      markFailureAlertSent()
      const hours = Math.round(getFailureDurationMinutes() / 60)
      console.error(`[Weather] Failures exceeding ${hours} hours, sending alert`)

      // Send Pushover alert
      notifyAll(
        `Weather API has been failing for ${hours}+ hours.\n\nLast error: ${errorMessage}\n\nStale data from ${cacheTimestamp ? new Date(cacheTimestamp).toLocaleString() : 'unknown'} is being served.`,
        {
          title: '⚠️ Weather API Degraded',
          priority: 0,
          url: 'https://spmsystem.com/',
        }
      ).catch(e => console.error('[Weather] Failed to send Pushover alert:', e))
    }

    // Return stale cache on error if available
    if (cachedData) {
      return NextResponse.json({
        data: cachedData,
        cached: true,
        stale: true,
        cachedAt: cacheTimestamp ? new Date(cacheTimestamp).toISOString() : null,
        error: 'Failed to fetch fresh data, returning cached',
        health: {
          isHealthy: false,
          consecutiveFailures: health.consecutiveFailures,
          failingFor: getFailureDurationMinutes(),
        },
      })
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch weather data',
        health: {
          isHealthy: false,
          consecutiveFailures: health.consecutiveFailures,
        },
      },
      { status: 500 }
    )
  }
}
