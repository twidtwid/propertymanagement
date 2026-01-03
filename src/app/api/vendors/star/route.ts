import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { toggleVendorStar, getStarredVendorIds } from "@/lib/actions"

/**
 * POST /api/vendors/star
 * Toggle star on a vendor for the current user
 */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { vendorId } = body as { vendorId: string }

  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 })
  }

  const isStarred = await toggleVendorStar(vendorId, user.id)

  return NextResponse.json({ isStarred })
}

/**
 * GET /api/vendors/star
 * Get all starred vendor IDs for current user
 */
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const starredIds = await getStarredVendorIds(user.id)

  return NextResponse.json({ starredIds: Array.from(starredIds) })
}
