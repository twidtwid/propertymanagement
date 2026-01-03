import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { undoDismissPin } from "@/lib/actions"
import type { PinnedEntityType } from "@/types/database"

/**
 * POST /api/pinned/undo
 * Undo dismissal of a smart pin (restore it to active)
 *
 * Request body:
 * {
 *   entityType: PinnedEntityType,
 *   entityId: string
 * }
 *
 * Response:
 * { success: boolean }
 */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entityType, entityId } = body

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields: entityType, entityId" },
        { status: 400 }
      )
    }

    const success = await undoDismissPin({ entityType, entityId })

    if (!success) {
      return NextResponse.json(
        { error: "Pin not found or not a dismissed smart pin" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Pinned API] Undo error:", error)
    return NextResponse.json(
      { error: "Failed to undo dismissal" },
      { status: 500 }
    )
  }
}
