/**
 * Weather service health tracking.
 * Shared state for monitoring weather API status.
 */

export interface WeatherHealthStatus {
  lastSuccessfulFetch: Date | null
  lastError: string | null
  consecutiveFailures: number
  isHealthy: boolean
  firstFailureAt: Date | null
  failureAlertSent: boolean
}

// Global singleton for health tracking
const healthStatus: WeatherHealthStatus = {
  lastSuccessfulFetch: null,
  lastError: null,
  consecutiveFailures: 0,
  isHealthy: true,
  firstFailureAt: null,
  failureAlertSent: false,
}

export function getWeatherHealth(): WeatherHealthStatus {
  return { ...healthStatus }
}

export function recordWeatherSuccess(): void {
  healthStatus.lastSuccessfulFetch = new Date()
  healthStatus.lastError = null
  healthStatus.consecutiveFailures = 0
  healthStatus.isHealthy = true
  healthStatus.firstFailureAt = null
  healthStatus.failureAlertSent = false
}

export function recordWeatherFailure(error: string): void {
  healthStatus.lastError = error
  healthStatus.consecutiveFailures++
  healthStatus.isHealthy = false

  if (!healthStatus.firstFailureAt) {
    healthStatus.firstFailureAt = new Date()
  }
}

export function markFailureAlertSent(): void {
  healthStatus.failureAlertSent = true
}

export function shouldSendFailureAlert(thresholdMs: number): boolean {
  if (healthStatus.failureAlertSent) return false
  if (!healthStatus.firstFailureAt) return false

  const failureDuration = Date.now() - healthStatus.firstFailureAt.getTime()
  return failureDuration >= thresholdMs
}

export function getFailureDurationMinutes(): number {
  if (!healthStatus.firstFailureAt) return 0
  return Math.round((Date.now() - healthStatus.firstFailureAt.getTime()) / 60000)
}
