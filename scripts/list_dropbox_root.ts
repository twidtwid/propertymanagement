/**
 * Quick script to list root folders in Dropbox
 */

import { Dropbox } from "dropbox"
import { queryOne } from "../src/lib/db"
import { decryptToken } from "../src/lib/encryption"

async function main() {
  const row = await queryOne<{
    access_token_encrypted: string
    namespace_id: string | null
  }>("SELECT access_token_encrypted, namespace_id FROM dropbox_oauth_tokens LIMIT 1")

  if (!row) {
    console.log("No Dropbox token found")
    process.exit(1)
  }

  const token = decryptToken(row.access_token_encrypted)

  const dbx = row.namespace_id
    ? new Dropbox({
        accessToken: token,
        fetch: fetch,
        pathRoot: JSON.stringify({ ".tag": "namespace_id", "namespace_id": row.namespace_id })
      })
    : new Dropbox({ accessToken: token, fetch: fetch })

  console.log("Listing root folders in shared namespace:")
  const response = await dbx.filesListFolder({ path: "" })

  for (const entry of response.result.entries) {
    const tag = (entry as { ".tag": string })[".tag"]
    console.log(`  ${tag === "folder" ? "📁" : "📄"} ${entry.name}`)
  }

  // Check if Tickets folder exists
  console.log("\nChecking /Tickets folder:")
  try {
    const ticketsResponse = await dbx.filesListFolder({ path: "/Tickets" })
    console.log(`  Found ${ticketsResponse.result.entries.length} items in /Tickets`)
    for (const entry of ticketsResponse.result.entries.slice(0, 10)) {
      const tag = (entry as { ".tag": string })[".tag"]
      console.log(`    ${tag === "folder" ? "📁" : "📄"} ${entry.name}`)
    }
  } catch (error: unknown) {
    const err = error as { error?: { error_summary?: string }; message?: string }
    if (err.error?.error_summary?.includes("not_found")) {
      console.log("  /Tickets folder does not exist")
    } else {
      console.log("  Error:", err.error?.error_summary || err.message)
    }
  }

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
