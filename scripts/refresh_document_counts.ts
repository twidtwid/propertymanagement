/**
 * One-time script to refresh document counts for all folder mappings.
 * Run with: npx tsx scripts/refresh_document_counts.ts
 */

import { refreshAllDocumentCounts, getFolderMappings } from "../src/lib/dropbox/files"
import { query } from "../src/lib/db"

async function main() {
  console.log("Refreshing document counts for all folder mappings...")

  await refreshAllDocumentCounts()

  // Show results
  const mappings = await query<{
    entity_name: string
    dropbox_folder_path: string
    document_count: number
  }>(
    `SELECT entity_name, dropbox_folder_path, document_count
     FROM dropbox_folder_mappings
     WHERE is_active = true
     ORDER BY entity_type, entity_name`
  )

  console.log("\nDocument counts:")
  for (const m of mappings) {
    console.log(`  ${m.entity_name}: ${m.document_count} files (${m.dropbox_folder_path})`)
  }

  console.log("\nDone!")
  process.exit(0)
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
