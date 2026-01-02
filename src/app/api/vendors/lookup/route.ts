import { NextRequest, NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import type { Vendor, VendorContact } from "@/types/database"
import { z } from "zod"

const lookupSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
  specialty: z.string().min(1, "Specialty is required"),
})

// Fields to exclude from API response (sensitive data)
const SENSITIVE_FIELDS = ["login_info", "account_number", "payment_method"]

function sanitizeVendor(vendor: Vendor): Partial<Vendor> {
  const sanitized = { ...vendor }
  SENSITIVE_FIELDS.forEach((field) => {
    delete (sanitized as Record<string, unknown>)[field]
  })
  return sanitized
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const propertyId = searchParams.get("propertyId")
  const specialty = searchParams.get("specialty")

  // Validate input
  const result = lookupSchema.safeParse({ propertyId, specialty })
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    )
  }

  try {
    const vendor = await queryOne<Vendor>(
      `SELECT v.id, v.name, v.company, v.specialty, v.phone, v.email,
              v.address, v.website, v.emergency_phone, v.notes, v.rating, v.is_active
       FROM property_vendors pv
       JOIN vendors v ON pv.vendor_id = v.id
       WHERE pv.property_id = $1
         AND (pv.specialty_override = $2 OR v.specialty = $2)
         AND v.is_active = TRUE
       ORDER BY pv.is_primary DESC
       LIMIT 1`,
      [result.data.propertyId, result.data.specialty]
    )

    if (vendor) {
      // Get primary contact
      const primaryContact = await queryOne<VendorContact>(
        `SELECT id, name, title, email, phone FROM vendor_contacts
         WHERE vendor_id = $1 AND is_primary = TRUE`,
        [vendor.id]
      )

      const response = {
        ...sanitizeVendor(vendor),
        primary_contact: primaryContact || null,
      }
      return NextResponse.json(response)
    } else {
      return NextResponse.json(null, { status: 404 })
    }
  } catch (error) {
    console.error("Error finding vendor:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
