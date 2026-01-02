import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { toggleBuildingLinkFlag, getBuildingLinkFlaggedIds } from "@/lib/actions"

/**
 * POST /api/buildinglink/flag
 * Toggle flag on a BuildingLink message
 */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { messageId } = body as { messageId: string }

  if (!messageId) {
    return NextResponse.json({ error: "Missing messageId" }, { status: 400 })
  }

  const isFlagged = await toggleBuildingLinkFlag(messageId, user.id)

  return NextResponse.json({ isFlagged })
}

/**
 * GET /api/buildinglink/flag
 * Get all flagged message IDs for current user
 */
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const flaggedIds = await getBuildingLinkFlaggedIds(user.id)

  return NextResponse.json({ flaggedIds: Array.from(flaggedIds) })
}
