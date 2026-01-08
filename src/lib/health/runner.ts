import { query, queryOne } from "@/lib/db"
import { notifyTodd } from "@/lib/pushover"
import { healthChecks, type HealthCheck, type HealthResult, type HealthSeverity } from "./checks"
import type { HealthCheckState, HealthCheckStatus } from "@/types/database"

interface CheckRunResult {
  name: string
  result: HealthResult
  previousStatus: HealthCheckStatus
  newStatus: HealthCheckStatus
  notified: boolean
  recovered: boolean
}

/**
 * Map health check severity to Pushover priority.
 * -2 = lowest, -1 = low, 0 = normal, 1 = high, 2 = emergency
 */
function severityToPriority(severity: HealthSeverity): -2 | -1 | 0 | 1 | 2 {
  switch (severity) {
    case "low":
      return -1
    case "warning":
      return 0
    case "high":
      return 1
    case "critical":
      return 2
    default:
      return 0
  }
}

/**
 * Map health check severity to Pushover sound.
 */
function severityToSound(severity: HealthSeverity): string {
  switch (severity) {
    case "low":
      return "none"
    case "warning":
      return "pushover"
    case "high":
      return "siren"
    case "critical":
      return "persistent"
    default:
      return "pushover"
  }
}

/**
 * Get the current state of a health check from the database.
 */
async function getCheckState(checkName: string): Promise<HealthCheckState | null> {
  return queryOne<HealthCheckState>(
    `SELECT * FROM health_check_state WHERE check_name = $1`,
    [checkName]
  )
}

/**
 * Update the health check state in the database.
 */
async function updateCheckState(
  checkName: string,
  status: HealthCheckStatus,
  result: HealthResult,
  options: {
    setFirstFailure?: boolean
    setAlerted?: boolean
    setRecovered?: boolean
    clearFailure?: boolean
  } = {}
): Promise<void> {
  const updates: string[] = [
    "status = $2",
    "last_checked_at = NOW()",
    "details = $3",
  ]
  const params: unknown[] = [checkName, status, result.details || null]

  if (options.setFirstFailure) {
    updates.push("first_failure_at = NOW()")
    updates.push("failure_count = failure_count + 1")
  }

  if (options.setAlerted) {
    updates.push("last_alerted_at = NOW()")
  }

  if (options.setRecovered) {
    updates.push("last_recovered_at = NOW()")
    updates.push("failure_count = 0")
    updates.push("first_failure_at = NULL")
  }

  if (options.clearFailure) {
    updates.push("failure_count = 0")
    updates.push("first_failure_at = NULL")
  }

  await query(
    `UPDATE health_check_state SET ${updates.join(", ")} WHERE check_name = $1`,
    params
  )
}

/**
 * Send a failure notification via Pushover.
 */
async function sendFailureNotification(
  check: HealthCheck,
  result: HealthResult
): Promise<boolean> {
  const title = `Health: ${check.name.replace(/_/g, " ")}`
  const message = `${result.message}\n\nCheck: ssh root@143.110.229.185 "docker logs app-${check.name.replace(/_/g, "-")}-1 --tail 50"`

  const response = await notifyTodd(message, {
    title,
    priority: severityToPriority(check.severity),
    sound: severityToSound(check.severity),
  })

  return response.success
}

/**
 * Send a recovery notification via Pushover.
 */
async function sendRecoveryNotification(
  check: HealthCheck,
  result: HealthResult,
  failureDurationMinutes: number
): Promise<boolean> {
  const title = `Recovered: ${check.name.replace(/_/g, " ")}`
  const hours = Math.floor(failureDurationMinutes / 60)
  const mins = failureDurationMinutes % 60
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  const message = `Was failing for: ${duration}\n\nCurrent status: ${result.message}`

  const response = await notifyTodd(message, {
    title,
    priority: -1, // Low priority for recovery
    sound: "pushover",
  })

  return response.success
}

/**
 * Run a single health check and handle state transitions.
 */
async function runCheck(check: HealthCheck): Promise<CheckRunResult> {
  const result = await check.check()
  const state = await getCheckState(check.name)

  if (!state) {
    // Initialize state if missing
    await query(
      `INSERT INTO health_check_state (check_name, status) VALUES ($1, 'ok')
       ON CONFLICT (check_name) DO NOTHING`,
      [check.name]
    )
    return {
      name: check.name,
      result,
      previousStatus: "ok",
      newStatus: result.ok ? "ok" : "warning",
      notified: false,
      recovered: false,
    }
  }

  const previousStatus = state.status
  let notified = false
  let recovered = false

  if (result.ok) {
    // Check passed
    if (previousStatus !== "ok") {
      // Recovery!
      const failureDurationMinutes = state.first_failure_at
        ? Math.floor((Date.now() - new Date(state.first_failure_at).getTime()) / 1000 / 60)
        : 0

      if (failureDurationMinutes >= check.graceMinutes && state.last_alerted_at) {
        // Only send recovery if we previously sent a failure alert
        await sendRecoveryNotification(check, result, failureDurationMinutes)
        recovered = true
      }

      await updateCheckState(check.name, "ok", result, { setRecovered: true })
    } else {
      await updateCheckState(check.name, "ok", result, { clearFailure: true })
    }

    return { name: check.name, result, previousStatus, newStatus: "ok", notified, recovered }
  }

  // Check failed
  const newStatus: HealthCheckStatus = check.severity === "critical" ? "critical" : "warning"

  if (previousStatus === "ok") {
    // First failure - start tracking
    await updateCheckState(check.name, newStatus, result, { setFirstFailure: true })
    return { name: check.name, result, previousStatus, newStatus, notified, recovered }
  }

  // Check if we've exceeded the grace period
  const failureDurationMinutes = state.first_failure_at
    ? Math.floor((Date.now() - new Date(state.first_failure_at).getTime()) / 1000 / 60)
    : 0

  if (failureDurationMinutes >= check.graceMinutes) {
    // Grace period exceeded
    const shouldAlert =
      !state.last_alerted_at ||
      // Re-alert every 4 hours for ongoing issues
      Date.now() - new Date(state.last_alerted_at).getTime() > 4 * 60 * 60 * 1000

    if (shouldAlert) {
      await sendFailureNotification(check, result)
      notified = true
      await updateCheckState(check.name, newStatus, result, { setAlerted: true })
    } else {
      await updateCheckState(check.name, newStatus, result)
    }
  } else {
    // Still in grace period
    await updateCheckState(check.name, newStatus, result)
  }

  return { name: check.name, result, previousStatus, newStatus, notified, recovered }
}

/**
 * Run all health checks and return results.
 */
export async function runHealthChecks(): Promise<{
  results: CheckRunResult[]
  summary: {
    total: number
    passed: number
    failed: number
    notified: number
    recovered: number
  }
}> {
  const results: CheckRunResult[] = []

  for (const check of healthChecks) {
    try {
      const result = await runCheck(check)
      results.push(result)
    } catch (error) {
      console.error(`[Health] Error running check ${check.name}:`, error)
      results.push({
        name: check.name,
        result: {
          ok: false,
          message: `Check error: ${error instanceof Error ? error.message : "Unknown"}`,
        },
        previousStatus: "ok",
        newStatus: "critical",
        notified: false,
        recovered: false,
      })
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.result.ok).length,
    failed: results.filter((r) => !r.result.ok).length,
    notified: results.filter((r) => r.notified).length,
    recovered: results.filter((r) => r.recovered).length,
  }

  return { results, summary }
}
