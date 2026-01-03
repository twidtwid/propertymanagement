import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { query } from "@/lib/db"

/**
 * POST /api/dropbox/pinned-metadata
 * Get metadata for pinned documents
 *
 * Body: { documentIds: string[] }
 * Response: { files: DropboxFileEntry[] }
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { documentIds } = body

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ files: [] })
    }

    // Fetch pinned items metadata from database
    const pinnedItems = await query<{
      entity_id: string
      metadata: {
        title: string
        path: string
        size?: number
      }
    }>(
      `SELECT entity_id, metadata
       FROM pinned_items
       WHERE entity_type = 'document'
         AND entity_id = ANY($1)
       ORDER BY pinned_at DESC`,
      [documentIds]
    )

    // Convert to DropboxFileEntry format
    const files = pinnedItems.map(item => ({
      id: item.entity_id,
      name: item.metadata.title,
      path_display: item.metadata.path,
      path_lower: item.metadata.path.toLowerCase(),
      is_folder: false,
      size: item.metadata.size,
      server_modified: null, // Not stored in metadata
    }))

    return NextResponse.json({ files })
  } catch (error) {
    console.error("[Dropbox Pinned Metadata] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pinned documents metadata" },
      { status: 500 }
    )
  }
}
