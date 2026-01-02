import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getUser } from "@/lib/auth"
import { getVisibilityContext } from "@/lib/visibility"

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
  action_url: string | null
  action_label: string | null
}

/**
 * GET /api/alerts
 * Get alerts for the current user (unread, not dismissed, not resolved)
 * Respects property visibility - only shows alerts for visible properties
 */
export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50)
  const includeRead = searchParams.get("includeRead") === "true"

  // Get visibility context for filtering
  const ctx = await getVisibilityContext()
  const visiblePropertyIds = ctx?.visiblePropertyIds || []
  const hasVisibilityRestrictions = visiblePropertyIds.length > 0

  // Build the visibility filter
  // Alerts are visible if:
  // 1. They have no related property (general alerts)
  // 2. Their related property is in the user's visible list
  // 3. The user has no visibility restrictions (sees all)
  const visibilityFilter = hasVisibilityRestrictions
    ? `AND (
        a.related_table NOT IN ('properties', 'bills', 'property_taxes', 'insurance_policies', 'vehicles')
        OR a.related_id IS NULL
        OR (a.related_table = 'properties' AND a.related_id = ANY($3::uuid[]))
        OR (a.related_table = 'bills' AND EXISTS (
          SELECT 1 FROM bills b WHERE b.id = a.related_id AND (b.property_id IS NULL OR b.property_id = ANY($3::uuid[]))
        ))
        OR (a.related_table = 'property_taxes' AND EXISTS (
          SELECT 1 FROM property_taxes pt WHERE pt.id = a.related_id AND pt.property_id = ANY($3::uuid[])
        ))
        OR (a.related_table = 'insurance_policies' AND EXISTS (
          SELECT 1 FROM insurance_policies ip WHERE ip.id = a.related_id AND (ip.property_id IS NULL OR ip.property_id = ANY($3::uuid[]))
        ))
        OR (a.related_table = 'vehicles' AND EXISTS (
          SELECT 1 FROM vehicles v WHERE v.id = a.related_id AND (v.property_id IS NULL OR v.property_id = ANY($3::uuid[]))
        ))
      )`
    : ""

  const alerts = await query<Alert>(
    `SELECT
       a.id, a.alert_type, a.title, a.message, a.severity,
       a.related_table, a.related_id, a.is_read, a.created_at,
       a.action_url, a.action_label
     FROM alerts a
     WHERE (a.user_id = $1 OR a.user_id IS NULL)
       AND a.is_dismissed = FALSE
       AND a.resolved_at IS NULL
       ${includeRead ? "" : "AND a.is_read = FALSE"}
       ${visibilityFilter}
     ORDER BY
       CASE a.severity
         WHEN 'critical' THEN 1
         WHEN 'warning' THEN 2
         ELSE 3
       END,
       a.created_at DESC
     LIMIT $2`,
    hasVisibilityRestrictions ? [user.id, limit, visiblePropertyIds] : [user.id, limit]
  )

  // Get unread count (with same visibility filter)
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM alerts a
     WHERE (a.user_id = $1 OR a.user_id IS NULL)
       AND a.is_dismissed = FALSE
       AND a.resolved_at IS NULL
       AND a.is_read = FALSE
       ${visibilityFilter}`,
    hasVisibilityRestrictions ? [user.id, visiblePropertyIds] : [user.id]
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
