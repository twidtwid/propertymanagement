import { NextResponse } from "next/server"
import { analyzeAndLinkVendorProperties, getUnlinkedVendors } from "@/lib/vendor-property-matcher"

export async function GET() {
  try {
    const unlinkedVendors = await getUnlinkedVendors()
    return NextResponse.json({
      success: true,
      unlinkedCount: unlinkedVendors.length,
      vendors: unlinkedVendors.map((v) => ({
        id: v.id,
        name: v.name,
        company: v.company,
        specialty: v.specialty,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const autoLink = body.autoLink === true

    const results = await analyzeAndLinkVendorProperties(autoLink)

    return NextResponse.json({
      success: true,
      analyzed: results.analyzed,
      newLinks: results.newLinks,
      analyses: results.analyses,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
