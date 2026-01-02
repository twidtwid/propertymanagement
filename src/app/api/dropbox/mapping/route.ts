import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getFolderMappingForEntity } from "@/lib/dropbox/files"

/**
 * GET /api/dropbox/mapping
 * Get the Dropbox folder mapping for an entity.
 * Query params:
 *   - entityType: "property" | "vehicle" | "insurance_portfolio"
 *   - entityId: the entity's UUID
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const entityType = searchParams.get("entityType") as "property" | "vehicle" | "insurance_portfolio"
    const entityId = searchParams.get("entityId")

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 })
    }

    const mapping = await getFolderMappingForEntity(entityType, entityId)

    if (!mapping) {
      return NextResponse.json({ folderPath: null })
    }

    return NextResponse.json({ folderPath: mapping.dropbox_folder_path })
  } catch (error) {
    console.error("Error getting folder mapping:", error)
    return NextResponse.json(
      { error: "Failed to get folder mapping" },
      { status: 500 }
    )
  }
}
