import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getUser } from "@/lib/auth"

interface Alert {
  id: string
  alert_type: string
  title: string
  message: string | null
  severity: "info" | "warning" | "critical"
  related_table: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
}

/**
 * GET /api/alerts
 * Get alerts for the current user (unread, not dismissed)
 */
export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50)
  const includeRead = searchParams.get("includeRead") === "true"

  const alerts = await query<Alert>(
    `SELECT id, alert_type, title, message, severity, related_table, related_id, is_read, created_at
     FROM alerts
     WHERE (user_id = $1 OR user_id IS NULL)
       AND is_dismissed = FALSE
       ${includeRead ? "" : "AND is_read = FALSE"}
     ORDER BY
       CASE severity
         WHEN 'critical' THEN 1
         WHEN 'warning' THEN 2
         ELSE 3
       END,
       created_at DESC
     LIMIT $2`,
    [user.id, limit]
  )

  // Get unread count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM alerts
     WHERE (user_id = $1 OR user_id IS NULL)
       AND is_dismissed = FALSE
       AND is_read = FALSE`,
    [user.id]
  )

  const unreadCount = parseInt(countResult[0]?.count || "0")

  return NextResponse.json({
    alerts,
    unreadCount,
  })
}

/**
 * PATCH /api/alerts
 * Mark alerts as read or dismissed
 */
export async function PATCH(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { alertIds, action } = body as { alertIds: string[]; action: "read" | "dismiss" }

  if (!alertIds?.length || !["read", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const column = action === "read" ? "is_read" : "is_dismissed"

  await query(
    `UPDATE alerts
     SET ${column} = TRUE
     WHERE id = ANY($1)
       AND (user_id = $2 OR user_id IS NULL)`,
    [alertIds, user.id]
  )

  return NextResponse.json({ success: true })
}
