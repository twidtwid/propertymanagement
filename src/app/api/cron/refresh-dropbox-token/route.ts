import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { getDropboxAuth } from "@/lib/dropbox/auth"
import { encryptToken, decryptToken } from "@/lib/encryption"

/**
 * GET /api/cron/refresh-dropbox-token
 *
 * Proactively refreshes Dropbox access token before it expires.
 * Should be called hourly via cron to keep the token fresh.
 *
 * This prevents the "Unauthorized" errors that occur when:
 * - Token expires during low-usage periods
 * - Refresh is only attempted after expiry (which can fail)
 */
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get the Dropbox token record
    const row = await queryOne<{
      user_email: string
      access_token_encrypted: string
      refresh_token_encrypted: string
      token_expiry: string
      namespace_id: string | null
    }>(
      `SELECT user_email, access_token_encrypted, refresh_token_encrypted,
              token_expiry, namespace_id
       FROM dropbox_oauth_tokens LIMIT 1`
    )

    if (!row) {
      return NextResponse.json({
        status: "skipped",
        reason: "No Dropbox connection configured"
      })
    }

    const expiryTime = new Date(row.token_expiry).getTime()
    const now = Date.now()
    const timeUntilExpiry = expiryTime - now
    const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60)

    // Refresh if token expires in less than 2 hours (plenty of buffer)
    if (timeUntilExpiry > 2 * 60 * 60 * 1000) {
      return NextResponse.json({
        status: "ok",
        action: "none",
        token_expires_in_hours: hoursUntilExpiry.toFixed(2),
        message: "Token still valid, no refresh needed"
      })
    }

    // Attempt refresh
    console.log(`[Dropbox Token Refresh] Token expires in ${hoursUntilExpiry.toFixed(2)} hours, refreshing...`)

    const dbxAuth = getDropboxAuth()
    const refreshToken = decryptToken(row.refresh_token_encrypted)
    dbxAuth.setRefreshToken(refreshToken)

    try {
      await dbxAuth.refreshAccessToken()
    } catch (refreshError) {
      // Refresh failed - token is likely revoked
      console.error("[Dropbox Token Refresh] FAILED:", refreshError)

      // Log to database for visibility
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, action, details, created_at)
         VALUES ('system', gen_random_uuid(), 'dropbox_refresh_failed', $1, NOW())`,
        [JSON.stringify({
          error: String(refreshError),
          user_email: row.user_email,
          token_expiry: row.token_expiry
        })]
      )

      return NextResponse.json({
        status: "error",
        action: "refresh_failed",
        error: "Dropbox token refresh failed - manual reconnection required",
        details: String(refreshError)
      }, { status: 500 })
    }

    const newAccessToken = dbxAuth.getAccessToken()
    if (!newAccessToken) {
      throw new Error("No access token returned from refresh")
    }

    // Update the token in database
    // Dropbox tokens expire in 4 hours
    const newExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    const accessTokenEncrypted = encryptToken(newAccessToken)

    await query(
      `UPDATE dropbox_oauth_tokens
       SET access_token_encrypted = $1, token_expiry = $2, updated_at = NOW()
       WHERE user_email = $3`,
      [accessTokenEncrypted, newExpiry, row.user_email]
    )

    console.log(`[Dropbox Token Refresh] SUCCESS - new expiry: ${newExpiry}`)

    return NextResponse.json({
      status: "ok",
      action: "refreshed",
      new_expiry: newExpiry,
      message: "Token successfully refreshed"
    })

  } catch (error) {
    console.error("[Dropbox Token Refresh] Error:", error)
    return NextResponse.json({
      status: "error",
      error: String(error)
    }, { status: 500 })
  }
}
