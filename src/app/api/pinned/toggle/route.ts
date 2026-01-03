import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { togglePin } from "@/lib/actions"
import type { PinnedEntityType } from "@/types/database"

/**
 * POST /api/pinned/toggle
 * Toggle pin state for any entity (shared across all users)
 *
 * Request body:
 * {
 *   entityType: 'vendor' | 'bill' | 'insurance_policy' | 'ticket' | 'buildinglink_message',
 *   entityId: string (UUID),
 *   metadata?: Record<string, any>  // Optional cached display data
 * }
 *
 * Response:
 * { isPinned: boolean }  // true if now pinned, false if unpinned
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Parse request body
    const body = await request.json()
    const { entityType, entityId, metadata } = body

    // Validate required fields
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields: entityType, entityId" },
        { status: 400 }
      )
    }

    // Validate entity type
    const validTypes: PinnedEntityType[] = [
      'vendor',
      'bill',
      'insurance_policy',
      'ticket',
      'buildinglink_message',
    ]
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Toggle pin state (shared across all users)
    const isPinned = await togglePin({
      entityType,
      entityId,
      userId: user.id,
      userName: user.full_name || user.email.split('@')[0],
      metadata,
    })

    return NextResponse.json({ isPinned })
  } catch (error) {
    console.error("[Pinned API] Toggle error:", error)
    return NextResponse.json(
      { error: "Failed to toggle pin" },
      { status: 500 }
    )
  }
}
