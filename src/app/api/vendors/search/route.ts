import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getVisibleVendorIds } from "@/lib/visibility"
import type { Vendor } from "@/types/database"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const q = searchParams.get("q")

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const visibleVendorIds = await getVisibleVendorIds()
  if (visibleVendorIds.length === 0) {
    return NextResponse.json([])
  }

  try {
    const searchTerm = `%${q}%`
    const vendors = await query<Vendor>(
      `SELECT id, name, company, specialties, phone, email, emergency_phone
       FROM vendors
       WHERE id = ANY($1::uuid[])
         AND is_active = TRUE
         AND (
           name ILIKE $2
           OR company ILIKE $2
           OR specialties::text ILIKE $2
         )
       ORDER BY
         CASE
           WHEN company ILIKE $2 THEN 1
           WHEN name ILIKE $2 THEN 2
           ELSE 3
         END,
         COALESCE(company, name)
       LIMIT 10`,
      [visibleVendorIds, searchTerm]
    )

    return NextResponse.json(vendors)
  } catch (error) {
    console.error("Vendor search error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
