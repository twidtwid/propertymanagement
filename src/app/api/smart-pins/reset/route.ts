import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { query } from "@/lib/db"
import {
  syncSmartPinsBills,
  syncSmartPinsTickets,
  syncSmartPinsBuildingLink,
} from "@/lib/actions"

/**
 * POST /api/smart-pins/reset
 * Clear all dismissed smart pins and re-run sync
 *
 * This removes all user overrides (dismissals) and regenerates
 * smart pins based on current system state.
 */
export async function POST() {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    // Step 1: Clear all dismissals on smart pins
    await query(
      `UPDATE pinned_items
       SET dismissed_at = NULL,
           dismissed_by = NULL,
           dismissed_by_name = NULL
       WHERE is_system_pin = true
         AND dismissed_at IS NOT NULL`
    )

    // Step 2: Re-run all smart pin sync functions
    await Promise.all([
      syncSmartPinsBills(),
      syncSmartPinsTickets(),
      syncSmartPinsBuildingLink(),
    ])

    return NextResponse.json({
      success: true,
      message: "Smart pins reset and re-synced successfully"
    })
  } catch (error) {
    console.error("[Smart Pins] Reset error:", error)
    return NextResponse.json(
      { error: "Failed to reset smart pins" },
      { status: 500 }
    )
  }
}
