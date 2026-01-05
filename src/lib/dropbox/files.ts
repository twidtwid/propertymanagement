import { Dropbox } from "dropbox"
import { getDropboxClient } from "./auth"
import { query, queryOne } from "@/lib/db"
import type { DropboxFileEntry, DropboxListFolderResult, DropboxFolderMapping, DropboxOAuthTokens } from "./types"

const DEFAULT_ROOT_FOLDER = "/Property Management"

/**
 * Get the configured root folder for a user.
 * Returns empty string if namespace_id is set (since namespace points to the root folder).
 */
async function getRootFolder(email: string): Promise<string> {
  const row = await queryOne<DropboxOAuthTokens>(
    `SELECT root_folder_path, namespace_id FROM dropbox_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  // If using namespace_id, the namespace already points to the root folder
  // so we don't need an additional path prefix
  if (row?.namespace_id) {
    return ""
  }

  // Only use default if no row or root_folder_path is null/undefined (not empty string)
  if (row?.root_folder_path !== undefined && row?.root_folder_path !== null) {
    return row.root_folder_path
  }

  return DEFAULT_ROOT_FOLDER
}

/**
 * List contents of a Dropbox folder.
 */
export async function listFolder(
  email: string,
  path: string = ""
): Promise<DropboxListFolderResult> {
  const dbx = await getDropboxClient(email)
  const rootFolder = await getRootFolder(email)

  // Normalize path - empty string means root, otherwise ensure it starts with /
  let folderPath: string
  if (path === "" || path === "/") {
    folderPath = rootFolder || ""
  } else if (rootFolder && path.startsWith(rootFolder)) {
    folderPath = path
  } else if (rootFolder) {
    folderPath = `${rootFolder}${path.startsWith("/") ? path : `/${path}`}`
  } else {
    // No root folder (using namespace), use path directly
    folderPath = path.startsWith("/") ? path : `/${path}`
  }


  try {
    const response = await dbx.filesListFolder({ path: folderPath })

    const entries: DropboxFileEntry[] = response.result.entries.map((entry) => ({
      id: entry[".tag"] === "file" || entry[".tag"] === "folder"
        ? (entry as { id: string }).id
        : "",
      name: entry.name,
      path_lower: entry.path_lower || "",
      path_display: entry.path_display || "",
      is_folder: entry[".tag"] === "folder",
      size: entry[".tag"] === "file" ? (entry as { size: number }).size : undefined,
      client_modified: entry[".tag"] === "file"
        ? (entry as { client_modified: string }).client_modified
        : undefined,
      server_modified: entry[".tag"] === "file"
        ? (entry as { server_modified: string }).server_modified
        : undefined,
      content_hash: entry[".tag"] === "file"
        ? (entry as { content_hash: string }).content_hash
        : undefined,
    }))

    // Sort: folders first, then by name
    entries.sort((a, b) => {
      if (a.is_folder !== b.is_folder) {
        return a.is_folder ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return {
      entries,
      cursor: response.result.cursor,
      has_more: response.result.has_more,
    }
  } catch (error: unknown) {
    const err = error as { status?: number; error?: { error_summary?: string } }
    if (err.status === 409 && err.error?.error_summary?.includes("not_found")) {
      // Folder doesn't exist
      return { entries: [], cursor: "", has_more: false }
    }
    throw error
  }
}

/**
 * Continue listing a folder if there are more results.
 */
export async function listFolderContinue(
  email: string,
  cursor: string
): Promise<DropboxListFolderResult> {
  const dbx = await getDropboxClient(email)

  const response = await dbx.filesListFolderContinue({ cursor })

  const entries: DropboxFileEntry[] = response.result.entries.map((entry) => ({
    id: entry[".tag"] === "file" || entry[".tag"] === "folder"
      ? (entry as { id: string }).id
      : "",
    name: entry.name,
    path_lower: entry.path_lower || "",
    path_display: entry.path_display || "",
    is_folder: entry[".tag"] === "folder",
    size: entry[".tag"] === "file" ? (entry as { size: number }).size : undefined,
    client_modified: entry[".tag"] === "file"
      ? (entry as { client_modified: string }).client_modified
      : undefined,
    server_modified: entry[".tag"] === "file"
      ? (entry as { server_modified: string }).server_modified
      : undefined,
    content_hash: entry[".tag"] === "file"
      ? (entry as { content_hash: string }).content_hash
      : undefined,
  }))

  return {
    entries,
    cursor: response.result.cursor,
    has_more: response.result.has_more,
  }
}

/**
 * Get a temporary download link for a file (valid for 4 hours).
 */
export async function getDownloadLink(
  email: string,
  path: string
): Promise<string> {
  const dbx = await getDropboxClient(email)

  const response = await dbx.filesGetTemporaryLink({ path })
  return response.result.link
}

/**
 * Search for files by name.
 */
export async function searchFiles(
  email: string,
  searchQuery: string,
  maxResults: number = 50
): Promise<DropboxFileEntry[]> {
  const dbx = await getDropboxClient(email)
  const rootFolder = await getRootFolder(email)

  const response = await dbx.filesSearchV2({
    query: searchQuery,
    options: {
      path: rootFolder,
      max_results: maxResults,
      file_status: { ".tag": "active" },
    },
  })

  return response.result.matches
    .filter((match) => match.metadata[".tag"] === "metadata")
    .map((match) => {
      const metadata = (match.metadata as { metadata: { ".tag": string; name: string; path_lower?: string; path_display?: string; id?: string; size?: number; client_modified?: string; server_modified?: string; content_hash?: string } }).metadata
      return {
        id: metadata.id || "",
        name: metadata.name,
        path_lower: metadata.path_lower || "",
        path_display: metadata.path_display || "",
        is_folder: metadata[".tag"] === "folder",
        size: metadata[".tag"] === "file" ? metadata.size : undefined,
        client_modified: metadata[".tag"] === "file" ? metadata.client_modified : undefined,
        server_modified: metadata[".tag"] === "file" ? metadata.server_modified : undefined,
        content_hash: metadata[".tag"] === "file" ? metadata.content_hash : undefined,
      }
    })
}

/**
 * Get folder mappings for entities.
 */
export async function getFolderMappings(): Promise<DropboxFolderMapping[]> {
  const rows = await query<DropboxFolderMapping>(
    `SELECT * FROM dropbox_folder_mappings WHERE is_active = true ORDER BY entity_type, entity_name`
  )
  return rows
}

/**
 * Get the folder mapping for a specific entity.
 */
export async function getFolderMappingForEntity(
  entityType: "property" | "vehicle" | "insurance_portfolio",
  entityId: string
): Promise<DropboxFolderMapping | null> {
  return queryOne<DropboxFolderMapping>(
    `SELECT * FROM dropbox_folder_mappings WHERE entity_type = $1 AND entity_id = $2 AND is_active = true`,
    [entityType, entityId]
  )
}

/**
 * Create or update a folder mapping.
 */
export async function upsertFolderMapping(mapping: {
  dropbox_folder_path: string
  entity_type: "property" | "vehicle" | "insurance_portfolio"
  entity_id: string | null
  entity_name: string
}): Promise<void> {
  await query(
    `INSERT INTO dropbox_folder_mappings (dropbox_folder_path, entity_type, entity_id, entity_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (dropbox_folder_path)
     DO UPDATE SET entity_type = $2, entity_id = $3, entity_name = $4, is_active = true`,
    [mapping.dropbox_folder_path, mapping.entity_type, mapping.entity_id, mapping.entity_name]
  )
}

/**
 * Get the cached count of files in a folder for an entity.
 * Returns 0 if no mapping exists. Uses database cache for performance.
 */
export async function getDocumentCountForEntity(
  entityType: "property" | "vehicle" | "insurance_portfolio",
  entityId: string
): Promise<number> {
  try {
    const row = await queryOne<{ document_count: number }>(
      `SELECT document_count FROM dropbox_folder_mappings
       WHERE entity_type = $1 AND entity_id = $2 AND is_active = true`,
      [entityType, entityId]
    )
    return row?.document_count || 0
  } catch (error) {
    console.error("Error getting document count:", error)
    return 0
  }
}

/**
 * Get the cached count of files for a specific folder path.
 * Returns 0 if no mapping exists. Uses database cache for performance.
 */
export async function getDocumentCountForPath(path: string): Promise<number> {
  try {
    const row = await queryOne<{ document_count: number }>(
      `SELECT document_count FROM dropbox_folder_mappings
       WHERE dropbox_folder_path = $1 AND is_active = true`,
      [path]
    )
    return row?.document_count || 0
  } catch (error) {
    console.error("Error getting document count for path:", error)
    return 0
  }
}

/**
 * Count all files recursively in a folder (including subdirectories).
 */
export async function countFilesRecursive(
  email: string,
  path: string
): Promise<number> {
  const { getDropboxClient } = await import("./auth")
  const dbx = await getDropboxClient(email)

  let count = 0
  let cursor: string | undefined

  // Use recursive listing
  const response = await dbx.filesListFolder({
    path: path || "",
    recursive: true,
  })

  // Count files (not folders)
  count += response.result.entries.filter(e => e[".tag"] === "file").length
  cursor = response.result.has_more ? response.result.cursor : undefined

  // Continue if there are more results
  while (cursor) {
    const continueResponse = await dbx.filesListFolderContinue({ cursor })
    count += continueResponse.result.entries.filter(e => e[".tag"] === "file").length
    cursor = continueResponse.result.has_more ? continueResponse.result.cursor : undefined
  }

  return count
}

/**
 * Update document counts for all folder mappings.
 * Call this periodically or after significant changes.
 */
export async function refreshAllDocumentCounts(): Promise<void> {
  const { getConnectedDropboxEmail } = await import("./auth")
  const email = await getConnectedDropboxEmail()
  if (!email) return

  const mappings = await getFolderMappings()

  for (const mapping of mappings) {
    try {
      const count = await countFilesRecursive(email, mapping.dropbox_folder_path)

      await query(
        `UPDATE dropbox_folder_mappings
         SET document_count = $1, last_count_updated = NOW()
         WHERE id = $2`,
        [count, mapping.id]
      )

      console.log(`  ${mapping.entity_name}: ${count} files`)
    } catch (error) {
      console.error(`Error counting files in ${mapping.dropbox_folder_path}:`, error)
    }
  }
}

/**
 * Create a folder in Dropbox.
 */
export async function createFolder(
  email: string,
  path: string
): Promise<void> {
  const dbx = await getDropboxClient(email)
  const rootFolder = await getRootFolder(email)

  // Construct full path with root folder prefix
  let fullPath: string
  if (rootFolder && !path.startsWith(rootFolder)) {
    fullPath = `${rootFolder}${path.startsWith("/") ? path : `/${path}`}`
  } else {
    fullPath = path.startsWith("/") ? path : `/${path}`
  }

  try {
    await dbx.filesCreateFolderV2({ path: fullPath, autorename: false })
  } catch (error: unknown) {
    const err = error as { status?: number; error?: { error_summary?: string } }
    // Ignore "path/conflict/folder" - folder already exists
    if (err.error?.error_summary?.includes("path/conflict/folder")) {
      return
    }
    throw error
  }
}

/**
 * Upload a file to Dropbox.
 */
export async function uploadFile(
  email: string,
  path: string,
  contents: Buffer
): Promise<DropboxFileEntry> {
  const dbx = await getDropboxClient(email)
  const rootFolder = await getRootFolder(email)

  // Construct full path with root folder prefix
  let fullPath: string
  if (rootFolder && !path.startsWith(rootFolder)) {
    fullPath = `${rootFolder}${path.startsWith("/") ? path : `/${path}`}`
  } else {
    fullPath = path.startsWith("/") ? path : `/${path}`
  }

  const response = await dbx.filesUpload({
    path: fullPath,
    contents,
    mode: { ".tag": "add" },
    autorename: true,
  })

  return {
    id: response.result.id,
    name: response.result.name,
    path_lower: response.result.path_lower || "",
    path_display: response.result.path_display || "",
    is_folder: false,
    size: response.result.size,
    client_modified: response.result.client_modified,
    server_modified: response.result.server_modified,
    content_hash: response.result.content_hash,
  }
}

/**
 * Delete a file from Dropbox.
 */
export async function deleteFile(
  email: string,
  path: string
): Promise<void> {
  const dbx = await getDropboxClient(email)
  await dbx.filesDeleteV2({ path })
}

/**
 * Copy a file in Dropbox.
 */
export async function copyFile(
  email: string,
  fromPath: string,
  toPath: string
): Promise<void> {
  const dbx = await getDropboxClient(email)
  await dbx.filesCopyV2({ from_path: fromPath, to_path: toPath })
}

/**
 * Move a file in Dropbox.
 */
export async function moveFile(
  email: string,
  fromPath: string,
  toPath: string
): Promise<void> {
  const dbx = await getDropboxClient(email)
  await dbx.filesMoveV2({ from_path: fromPath, to_path: toPath })
}

/**
 * Get the Dropbox folder paths for an insurance policy.
 * Returns an array of paths to check for documents:
 * 1. Property/vehicle specific insurance folder
 * 2. Portfolio-wide insurance folder (for carriers like Berkley One)
 */
export async function getInsuranceFolderPaths(
  propertyId: string | null,
  vehicleId: string | null,
  carrierName: string | null
): Promise<{ entityPath: string | null; portfolioPath: string | null }> {
  let entityPath: string | null = null
  let portfolioPath: string | null = null

  // For property-linked policies, get the property's folder + /Insurance
  if (propertyId) {
    const mapping = await getFolderMappingForEntity("property", propertyId)
    if (mapping) {
      entityPath = `${mapping.dropbox_folder_path}/Insurance`
    }
  }

  // For vehicle-linked policies, get the vehicle's folder + /Insurance
  if (vehicleId && !entityPath) {
    const mapping = await getFolderMappingForEntity("vehicle", vehicleId)
    if (mapping) {
      entityPath = `${mapping.dropbox_folder_path}/Insurance`
    }
  }

  // For portfolio carriers (Berkley One, etc.), also include the portfolio folder
  // This ensures portfolio-wide policy docs appear on individual property/vehicle pages
  const portfolioCarriers = ["Berkley One", "Hudson Excess"]
  if (carrierName && portfolioCarriers.includes(carrierName)) {
    const portfolioMapping = await queryOne<DropboxFolderMapping>(
      `SELECT * FROM dropbox_folder_mappings
       WHERE entity_type = 'insurance_portfolio' AND is_active = true
       LIMIT 1`
    )
    if (portfolioMapping) {
      portfolioPath = portfolioMapping.dropbox_folder_path
    }
  }

  // For policies with no property/vehicle, use portfolio as primary
  if (!entityPath && !portfolioPath) {
    const portfolioMapping = await queryOne<DropboxFolderMapping>(
      `SELECT * FROM dropbox_folder_mappings
       WHERE entity_type = 'insurance_portfolio' AND is_active = true
       LIMIT 1`
    )
    if (portfolioMapping) {
      entityPath = portfolioMapping.dropbox_folder_path
    }
  }

  return { entityPath, portfolioPath }
}

/**
 * Get the Dropbox folder path for an insurance policy (legacy single-path version).
 * @deprecated Use getInsuranceFolderPaths instead
 */
export async function getInsuranceFolderPath(
  propertyId: string | null,
  vehicleId: string | null
): Promise<string | null> {
  const { entityPath, portfolioPath } = await getInsuranceFolderPaths(propertyId, vehicleId, null)
  return entityPath || portfolioPath
}

// Utility functions are in utils.ts for client-side use
export { getRelativePath, getPathBreadcrumbs, formatFileSize, getFileExtension, getFileIconType } from "./utils"
