import { query, queryOne } from "@/lib/db"

export type HealthSeverity = "low" | "warning" | "high" | "critical"

export interface HealthResult {
  ok: boolean
  message: string
  details?: Record<string, unknown>
}

export interface HealthCheck {
  name: string
  severity: HealthSeverity
  graceMinutes: number
  check: () => Promise<HealthResult>
}

/**
 * Check if email sync has run recently.
 * Alerts if last_sync_at is more than 2 hours old.
 */
async function checkEmailSyncHealth(): Promise<HealthResult> {
  const result = await queryOne<{ last_sync_at: string; sync_count: number }>(
    `SELECT last_sync_at, sync_count FROM email_sync_state LIMIT 1`
  )

  if (!result) {
    return {
      ok: false,
      message: "No email sync state found",
      details: { error: "no_state" },
    }
  }

  const lastSync = new Date(result.last_sync_at)
  const now = new Date()
  const minutesAgo = Math.floor((now.getTime() - lastSync.getTime()) / 1000 / 60)

  if (minutesAgo > 120) {
    const hoursAgo = Math.floor(minutesAgo / 60)
    const mins = minutesAgo % 60
    return {
      ok: false,
      message: `Last sync: ${hoursAgo}h ${mins}m ago`,
      details: { last_sync_at: result.last_sync_at, minutes_ago: minutesAgo },
    }
  }

  return {
    ok: true,
    message: `Synced ${minutesAgo}m ago (${result.sync_count} total syncs)`,
    details: { last_sync_at: result.last_sync_at, minutes_ago: minutesAgo },
  }
}

/**
 * Check if Dropbox token is expiring soon.
 * Alerts if token expires within 24 hours.
 */
async function checkDropboxTokenHealth(): Promise<HealthResult> {
  const result = await queryOne<{ token_expiry: string; user_email: string }>(
    `SELECT token_expiry, user_email FROM dropbox_oauth_tokens LIMIT 1`
  )

  if (!result) {
    return {
      ok: false,
      message: "No Dropbox token found",
      details: { error: "no_token" },
    }
  }

  const expiry = new Date(result.token_expiry)
  const now = new Date()
  const hoursUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / 1000 / 60 / 60)

  if (hoursUntilExpiry < 0) {
    return {
      ok: false,
      message: `Token expired ${Math.abs(hoursUntilExpiry)}h ago`,
      details: { token_expiry: result.token_expiry, hours_until_expiry: hoursUntilExpiry },
    }
  }

  if (hoursUntilExpiry < 24) {
    return {
      ok: false,
      message: `Token expires in ${hoursUntilExpiry}h`,
      details: { token_expiry: result.token_expiry, hours_until_expiry: hoursUntilExpiry },
    }
  }

  return {
    ok: true,
    message: `Token valid for ${hoursUntilExpiry}h`,
    details: { token_expiry: result.token_expiry, hours_until_expiry: hoursUntilExpiry },
  }
}

/**
 * Check database connectivity.
 * This is a critical check - if this fails, the app is down.
 */
async function checkDatabaseHealth(): Promise<HealthResult> {
  try {
    const result = await queryOne<{ now: string }>(`SELECT NOW() as now`)
    if (!result) {
      return { ok: false, message: "Database returned no result" }
    }
    return { ok: true, message: "Database connected" }
  } catch (error) {
    return {
      ok: false,
      message: `Database error: ${error instanceof Error ? error.message : "Unknown"}`,
      details: { error: String(error) },
    }
  }
}

/**
 * Check if daily summary emails are being sent.
 * Alerts if no summary email in 48 hours.
 */
async function checkDailySummaryHealth(): Promise<HealthResult> {
  const result = await queryOne<{ sent_at: string }>(
    `SELECT sent_at FROM notification_log
     WHERE notification_type = 'daily_summary'
     ORDER BY sent_at DESC
     LIMIT 1`
  )

  if (!result) {
    return {
      ok: false,
      message: "No daily summary ever sent",
      details: { error: "no_summaries" },
    }
  }

  const lastSent = new Date(result.sent_at)
  const now = new Date()
  const hoursAgo = Math.floor((now.getTime() - lastSent.getTime()) / 1000 / 60 / 60)

  if (hoursAgo > 48) {
    return {
      ok: false,
      message: `Last summary: ${hoursAgo}h ago`,
      details: { last_sent: result.sent_at, hours_ago: hoursAgo },
    }
  }

  return {
    ok: true,
    message: `Last summary: ${hoursAgo}h ago`,
    details: { last_sent: result.sent_at, hours_ago: hoursAgo },
  }
}

/**
 * All health checks to run.
 * graceMinutes: how long a check must fail before alerting (prevents transient alerts)
 */
export const healthChecks: HealthCheck[] = [
  {
    name: "email_sync",
    severity: "high",
    graceMinutes: 120, // 2 hours as requested
    check: checkEmailSyncHealth,
  },
  {
    name: "dropbox_token",
    severity: "warning",
    graceMinutes: 60,
    check: checkDropboxTokenHealth,
  },
  {
    name: "database",
    severity: "critical",
    graceMinutes: 5,
    check: checkDatabaseHealth,
  },
  {
    name: "daily_summary",
    severity: "low",
    graceMinutes: 2880, // 48 hours
    check: checkDailySummaryHealth,
  },
]
