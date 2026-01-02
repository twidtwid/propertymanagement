/**
 * Quick script to list what folders exist in Dropbox root.
 */

import { getConnectedDropboxEmail, getDropboxClient } from "../src/lib/dropbox/auth"

async function main() {
  const email = await getConnectedDropboxEmail()
  if (!email) {
    console.log("No Dropbox connection found")
    process.exit(1)
  }

  console.log(`Connected as: ${email}`)

  const dbx = await getDropboxClient(email)

  // List root
  console.log("\n📁 Root folder contents:")
  const rootResponse = await dbx.filesListFolder({ path: "" })
  for (const entry of rootResponse.result.entries) {
    const icon = entry[".tag"] === "folder" ? "📁" : "📄"
    console.log(`  ${icon} ${entry.path_display}`)
  }

  // List /Property Management if it exists
  const pmFolder = rootResponse.result.entries.find(e => e.name.toLowerCase() === "property management")
  if (pmFolder) {
    console.log("\n📁 /Property Management contents:")
    const pmResponse = await dbx.filesListFolder({ path: pmFolder.path_lower || "/property management" })
    for (const entry of pmResponse.result.entries) {
      const icon = entry[".tag"] === "folder" ? "📁" : "📄"
      console.log(`  ${icon} ${entry.path_display}`)
    }

    // Check for Properties subfolder
    const propsFolder = pmResponse.result.entries.find(e => e.name.toLowerCase() === "properties")
    if (propsFolder) {
      console.log("\n📁 /Property Management/Properties contents:")
      const propsResponse = await dbx.filesListFolder({ path: propsFolder.path_lower || "/property management/properties" })
      for (const entry of propsResponse.result.entries) {
        const icon = entry[".tag"] === "folder" ? "📁" : "📄"
        console.log(`  ${icon} ${entry.path_display}`)
      }
    }
  }
}

main().catch(console.error)
