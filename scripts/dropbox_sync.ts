/**
 * Dropbox sync script - run manually or via cron.
 *
 * Usage:
 *   npx tsx scripts/dropbox_sync.ts           # Incremental sync
 *   npx tsx scripts/dropbox_sync.ts --force   # Regenerate all summaries
 */

import { runDropboxSync } from "../src/lib/dropbox/sync"

async function main() {
  const forceRegenerate = process.argv.includes("--force")

  console.log("🔄 Dropbox Sync")
  console.log(`   Mode: ${forceRegenerate ? "Force regenerate all" : "Incremental"}`)
  console.log("")

  const result = await runDropboxSync({
    forceRegenerate,
    verbose: true
  })

  if (result.errors.length > 0) {
    console.log("\n⚠️  Errors:")
    for (const error of result.errors) {
      console.log(`   - ${error}`)
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
