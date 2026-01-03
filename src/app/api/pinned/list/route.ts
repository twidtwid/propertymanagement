import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getPinnedIds } from "@/lib/actions"
import type { PinnedEntityType } from "@/types/database"

/**
 * GET /api/pinned/list?entityType=document
 * Get all pinned IDs for a specific entity type
 *
 * Query params:
 * - entityType: 'vendor' | 'bill' | 'insurance_policy' | 'ticket' | 'buildinglink_message' | 'property_tax' | 'insurance_premium' | 'document'
 *
 * Response:
 * { pinnedIds: string[] }  // Array of entity IDs that are pinned
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get entity type from query params
    const searchParams = request.nextUrl.searchParams
    const entityType = searchParams.get('entityType') as PinnedEntityType | null

    if (!entityType) {
      return NextResponse.json(
        { error: "Missing required query parameter: entityType" },
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
      'property_tax',
      'insurance_premium',
      'document',
    ]
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch pinned IDs (both smart and user pins combined)
    const pinnedIdsSet = await getPinnedIds(entityType)
    const pinnedIds = Array.from(pinnedIdsSet)

    return NextResponse.json({ pinnedIds })
  } catch (error) {
    console.error("[Pinned API] List error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pinned items" },
      { status: 500 }
    )
  }
}
