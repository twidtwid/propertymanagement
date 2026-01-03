/**
 * Dropbox Reorganization Script
 *
 * Reorganizes Dropbox folders to match database structure:
 * - /Properties/{PropertyName}/Insurance/
 * - /Properties/{PropertyName}/Taxes/
 * - /Properties/{PropertyName}/...
 * - /Vehicles/{VehicleName}/
 * - /Insurance Portfolio/
 *
 * Also copies Berkley One portfolio docs to each covered property's Insurance folder.
 */

import { getConnectedDropboxEmail, getDropboxClient } from "../src/lib/dropbox/auth"
import { createFolder, copyFile, listFolder } from "../src/lib/dropbox/files"
import { query } from "../src/lib/db"

/**
 * Recursively copy a folder and all its contents
 */
async function copyFolderRecursive(
  email: string,
  fromPath: string,
  toPath: string,
  dryRun: boolean,
  indent: string = "   "
): Promise<void> {
  // Create destination folder
  if (!dryRun) {
    await createFolder(email, toPath)
  }

  // Use Dropbox SDK directly for recursive listing
  const dbx = await getDropboxClient(email)
  let cursor: string | undefined
  let entries: Array<{ ".tag": string; path_display?: string; name: string }> = []

  // Get all entries recursively
  const response = await dbx.filesListFolder({ path: fromPath, recursive: true })
  entries = response.result.entries
  cursor = response.result.has_more ? response.result.cursor : undefined

  while (cursor) {
    const continueResponse = await dbx.filesListFolderContinue({ cursor })
    entries = entries.concat(continueResponse.result.entries)
    cursor = continueResponse.result.has_more ? continueResponse.result.cursor : undefined
  }

  // Sort to process folders before files
  entries.sort((a, b) => {
    if (a[".tag"] === "folder" && b[".tag"] !== "folder") return -1
    if (a[".tag"] !== "folder" && b[".tag"] === "folder") return 1
    return (a.path_display || "").localeCompare(b.path_display || "")
  })

  for (const entry of entries) {
    const relativePath = (entry.path_display || "").substring(fromPath.length)
    const newPath = `${toPath}${relativePath}`

    if (entry[".tag"] === "folder") {
      console.log(`${indent}📁 ${relativePath}/`)
      if (!dryRun) {
        await createFolder(email, newPath)
      }
    } else {
      console.log(`${indent}📄 ${relativePath}`)
      if (!dryRun) {
        try {
          await copyFile(email, entry.path_display || "", newPath)
        } catch (err: unknown) {
          const error = err as { error?: { error_summary?: string } }
          if (error.error?.error_summary?.includes("to/conflict")) {
            // Already exists, skip
          } else {
            console.log(`${indent}   ⚠️ Failed: ${error.error?.error_summary}`)
          }
        }
      }
    }
  }
}

interface FileMapping {
  oldPath: string
  newPath: string
}

interface FolderReorg {
  propertyName: string
  oldFolder: string
  newFolder: string
  subfolderMappings?: Record<string, string> // old subfolder -> new subfolder
}

// Define the reorganization plan
const PROPERTY_REORG: FolderReorg[] = [
  // Brooklyn - split into PH2E and PH2F
  {
    propertyName: "Brooklyn Condo PH2E",
    oldFolder: "/34 N 7th St - Brooklyn",
    newFolder: "/Properties/Brooklyn Condo PH2E",
  },
  {
    propertyName: "Brooklyn Condo PH2F",
    oldFolder: "/34 N 7th St - Brooklyn",
    newFolder: "/Properties/Brooklyn Condo PH2F",
  },
  // Rhode Island
  {
    propertyName: "Rhode Island House",
    oldFolder: "/88 Williams St - Providence RI",
    newFolder: "/Properties/Rhode Island House",
  },
  // Vermont - split by address subfolder
  {
    propertyName: "Vermont Main House",
    oldFolder: "/Vermont/2055 Sunset Lake Rd",
    newFolder: "/Properties/Vermont Main House",
  },
  {
    propertyName: "Vermont Guest House",
    oldFolder: "/Vermont/2001 Sunset Lake Rd",
    newFolder: "/Properties/Vermont Guest House",
  },
  {
    propertyName: "Booth House",
    oldFolder: "/Vermont/1910 Sunset Lake Rd",
    newFolder: "/Properties/Booth House",
  },
  {
    propertyName: "Vermont Land",
    oldFolder: "/Vermont/22 Kelly Road",
    newFolder: "/Properties/Vermont Land",
  },
  // Paris
  {
    propertyName: "Paris Condo",
    oldFolder: "/Paris - 8 Rue Guynemer",
    newFolder: "/Properties/Paris Condo",
  },
  // Martinique
  {
    propertyName: "Martinique Condo",
    oldFolder: "/Martinique",
    newFolder: "/Properties/Martinique Condo",
  },
]

// Vermont shared folders go to all VT properties
const VERMONT_SHARED_FOLDERS = ["/Vermont/Taxes", "/Vermont/Vendors", "/Vermont/Forest Management"]
const VERMONT_PROPERTIES = ["Vermont Main House", "Vermont Guest House", "Booth House", "Vermont Land"]

// Berkley One portfolio doc to copy to each covered property
const BERKLEY_ONE_PORTFOLIO_DOC = "/non-House-specific Insurance/ALL Spalter Private Client Insurance Portfolio.pdf"
const BERKLEY_ONE_PROPERTIES = [
  "Brooklyn Condo PH2E",
  "Brooklyn Condo PH2F",
  "Rhode Island House",
  "Vermont Main House",
  "Vermont Guest House",
  "Booth House",
]

async function main() {
  const dryRun = !process.argv.includes("--execute")

  console.log("🗂️  Dropbox Reorganization Script")
  console.log(`   Mode: ${dryRun ? "DRY RUN (use --execute to apply)" : "EXECUTING CHANGES"}`)
  console.log("")

  const email = await getConnectedDropboxEmail()
  if (!email) {
    console.error("❌ No Dropbox connection found")
    process.exit(1)
  }
  console.log(`   Connected as: ${email}`)
  console.log("")

  // Step 1: Create new folder structure
  console.log("📁 Step 1: Creating new folder structure...")
  const newFolders = new Set<string>()

  for (const reorg of PROPERTY_REORG) {
    newFolders.add(reorg.newFolder)
    newFolders.add(`${reorg.newFolder}/Insurance`)
  }
  newFolders.add("/Properties")
  newFolders.add("/Insurance Portfolio")

  for (const folder of Array.from(newFolders).sort()) {
    console.log(`   Creating: ${folder}`)
    if (!dryRun) {
      await createFolder(email, folder)
    }
  }
  console.log("")

  // Step 2: Copy files from old locations to new
  console.log("📄 Step 2: Copying files to new locations...")

  for (const reorg of PROPERTY_REORG) {
    console.log(`\n   ${reorg.propertyName}:`)
    console.log(`   From: ${reorg.oldFolder}`)
    console.log(`   To:   ${reorg.newFolder}`)

    try {
      await copyFolderRecursive(email, reorg.oldFolder, reorg.newFolder, dryRun)
    } catch (err) {
      console.log(`   ⚠️  Could not copy folder: ${err}`)
    }
  }

  // Step 3: Copy Vermont shared folders to all VT properties
  console.log("\n📄 Step 3: Copying Vermont shared folders...")

  for (const sharedFolder of VERMONT_SHARED_FOLDERS) {
    const folderName = sharedFolder.split("/").pop()
    console.log(`\n   Shared folder: ${folderName}`)

    for (const vtProperty of VERMONT_PROPERTIES) {
      const targetFolder = `/Properties/${vtProperty}/${folderName}`
      console.log(`   → ${vtProperty}/${folderName}/`)

      try {
        await copyFolderRecursive(email, sharedFolder, targetFolder, dryRun, "      ")
      } catch (err) {
        console.log(`      ⚠️ Could not copy: ${err}`)
      }
    }
  }

  // Step 4: Copy Berkley One portfolio doc to each covered property
  console.log("\n📄 Step 4: Copying Berkley One portfolio doc to properties...")

  for (const property of BERKLEY_ONE_PROPERTIES) {
    const targetPath = `/Properties/${property}/Insurance/Berkley One Portfolio.pdf`
    console.log(`   → ${property}/Insurance/Berkley One Portfolio.pdf`)

    if (!dryRun) {
      try {
        await copyFile(email, BERKLEY_ONE_PORTFOLIO_DOC, targetPath)
      } catch (err: unknown) {
        const error = err as { error?: { error_summary?: string } }
        if (error.error?.error_summary?.includes("to/conflict")) {
          console.log(`      (already exists)`)
        } else if (error.error?.error_summary?.includes("from/not_found")) {
          console.log(`      ⚠️ Source file not found`)
        } else {
          console.log(`      ⚠️ Failed: ${error.error?.error_summary}`)
        }
      }
    }
  }

  // Step 5: Copy Insurance Portfolio folder
  console.log("\n📄 Step 5: Copy Insurance Portfolio folder...")
  try {
    await copyFolderRecursive(email, "/non-House-specific Insurance", "/Insurance Portfolio", dryRun)
  } catch (err) {
    console.log(`   ⚠️  Could not copy: ${err}`)
  }

  // Step 6: Update database folder mappings
  console.log("\n📊 Step 6: Updating database folder mappings...")

  for (const reorg of PROPERTY_REORG) {
    console.log(`   ${reorg.propertyName} → ${reorg.newFolder}`)

    if (!dryRun) {
      await query(
        `UPDATE dropbox_folder_mappings
         SET dropbox_folder_path = $1
         WHERE entity_name = $2 AND entity_type = 'property'`,
        [reorg.newFolder, reorg.propertyName]
      )
    }
  }

  // Update insurance portfolio mapping
  console.log(`   Insurance Portfolio → /Insurance Portfolio`)
  if (!dryRun) {
    await query(
      `UPDATE dropbox_folder_mappings
       SET dropbox_folder_path = '/Insurance Portfolio'
       WHERE entity_type = 'insurance_portfolio'`
    )
  }

  console.log("\n✅ Done!")

  if (dryRun) {
    console.log("\n⚠️  This was a DRY RUN. No changes were made.")
    console.log("   Run with --execute to apply changes.")
  } else {
    console.log("\n📝 Next steps:")
    console.log("   1. Run 'npm run dropbox:sync' to update file summaries")
    console.log("   2. Verify the new structure in Dropbox")
    console.log("   3. Manually delete old folders when ready")
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
