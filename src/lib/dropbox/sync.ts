/**
 * Dropbox sync service - scans for new files, generates AI summaries, updates counts.
 */

import Anthropic from "@anthropic-ai/sdk"
import { Dropbox } from "dropbox"
import { query, queryOne } from "@/lib/db"
import { decryptToken } from "@/lib/encryption"
import { getFolderMappings } from "./files"

const anthropic = new Anthropic()

interface DropboxFile {
  id: string
  path: string
  name: string
  size: number
  content_hash: string
}

interface SyncResult {
  foldersScanned: number
  filesFound: number
  newSummaries: number
  deletedSummaries: number
  countsUpdated: number
  errors: string[]
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic"]
const PDF_EXTENSIONS = ["pdf"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB for downloads
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB for Claude vision API
const MAX_TEXT_LENGTH = 8000

/**
 * Get Dropbox client for sync operations.
 */
async function getDropboxClient(): Promise<Dropbox | null> {
  const row = await queryOne<{
    access_token_encrypted: string
    namespace_id: string | null
  }>(
    "SELECT access_token_encrypted, namespace_id FROM dropbox_oauth_tokens LIMIT 1"
  )

  if (!row) return null

  const token = decryptToken(row.access_token_encrypted)

  if (row.namespace_id) {
    return new Dropbox({
      accessToken: token,
      fetch: fetch,
      pathRoot: JSON.stringify({ ".tag": "namespace_id", "namespace_id": row.namespace_id })
    })
  }

  return new Dropbox({ accessToken: token, fetch: fetch })
}

/**
 * List all files recursively in a folder.
 */
async function listAllFilesRecursive(
  dbx: Dropbox,
  path: string
): Promise<DropboxFile[]> {
  const files: DropboxFile[] = []

  try {
    let response = await dbx.filesListFolder({ path: path || "", recursive: true })

    for (const entry of response.result.entries) {
      if (entry[".tag"] === "file") {
        const file = entry as any
        files.push({
          id: file.id,
          path: file.path_display,
          name: file.name,
          size: file.size,
          content_hash: file.content_hash || ""
        })
      }
    }

    while (response.result.has_more) {
      response = await dbx.filesListFolderContinue({ cursor: response.result.cursor })
      for (const entry of response.result.entries) {
        if (entry[".tag"] === "file") {
          const file = entry as any
          files.push({
            id: file.id,
            path: file.path_display,
            name: file.name,
            size: file.size,
            content_hash: file.content_hash || ""
          })
        }
      }
    }
  } catch (error: any) {
    console.error(`Error listing ${path}:`, error.error?.error_summary || error.message)
  }

  return files
}

/**
 * Download a file from Dropbox.
 */
async function downloadFile(dbx: Dropbox, path: string): Promise<Buffer | null> {
  try {
    const linkResponse = await dbx.filesGetTemporaryLink({ path })
    const response = await fetch(linkResponse.result.link)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  } catch (error: any) {
    console.error(`Error downloading ${path}:`, error.message)
    return null
  }
}

/**
 * Extract text from PDF using pdf-parse.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse has ESM/CJS issues, try multiple import methods
    let pdfParse: any
    try {
      const mod = await import("pdf-parse")
      pdfParse = mod.default || mod
    } catch {
      // Fallback: require (for Node.js)
      pdfParse = require("pdf-parse")
    }
    const data = await pdfParse(buffer)
    return data.text.slice(0, MAX_TEXT_LENGTH)
  } catch (error) {
    // PDF parsing failed - will fall back to filename-based summary
    return ""
  }
}

function getExtension(filename: string): string {
  const parts = filename.split(".")
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

/**
 * Generate AI summary using Claude Haiku with improved prompts.
 */
async function generateSummary(
  filename: string,
  folderPath: string,
  content: string | null,
  imageBase64: string | null,
  mimeType: string | null
): Promise<string> {
  try {
    // Extract folder context for better summaries
    const folderParts = folderPath.split("/").filter(Boolean)
    const folderContext = folderParts.slice(0, 2).join(" > ") || "documents"

    const systemPrompt = `You are a document classifier for a property management system. Your job is to create concise, actionable one-line summaries.

Guidelines:
- Be specific: include dates, amounts, names, policy numbers when visible
- Be practical: focus on what the user needs to know
- Be brief: aim for 60-80 characters, max 100
- Use sentence fragments, not full sentences
- Start with the document type or key info

Examples of good summaries:
- "2024 property tax bill - $4,567.89 due Apr 15"
- "Homeowners policy renewal - Berkley One #HP-123456"
- "HVAC service receipt - $350 for annual maintenance"
- "Kitchen renovation quote from Parker Construction"
- "Roof inspection photos showing damaged shingles"
- "Condo board meeting minutes - Feb 2024"
- "Vehicle registration renewal notice - expires Mar 2025"`

    const messages: Anthropic.MessageParam[] = []

    if (imageBase64 && mimeType) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64
            }
          },
          {
            type: "text",
            text: `File: "${filename}" in ${folderContext}

Analyze this image and provide a one-line summary. Output only the summary.`
          }
        ]
      })
    } else if (content) {
      messages.push({
        role: "user",
        content: `File: "${filename}" in ${folderContext}

Document text:
${content.slice(0, 4000)}

Provide a one-line summary. Output only the summary.`
      })
    } else {
      messages.push({
        role: "user",
        content: `File: "${filename}" in ${folderContext}

Based on the filename and folder, provide a one-line summary describing what this document likely contains. Output only the summary.`
      })
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 100,
      system: systemPrompt,
      messages
    })

    const text = response.content[0]
    if (text.type === "text") {
      // Clean up the response
      let summary = text.text.trim()
      // Remove quotes if wrapped
      if ((summary.startsWith('"') && summary.endsWith('"')) ||
          (summary.startsWith("'") && summary.endsWith("'"))) {
        summary = summary.slice(1, -1)
      }
      return summary.slice(0, 150)
    }
    return ""
  } catch (error: any) {
    console.error(`Error generating summary for ${filename}:`, error.message)
    return ""
  }
}

/**
 * Process a single file - generate summary if needed.
 */
async function processFile(
  dbx: Dropbox,
  file: DropboxFile,
  folderPath: string,
  forceRegenerate: boolean = false
): Promise<boolean> {
  // Check if already processed (unless forcing regeneration)
  if (!forceRegenerate) {
    const existing = await queryOne<{ id: string; content_hash: string }>(
      "SELECT id, content_hash FROM dropbox_file_summaries WHERE dropbox_path = $1",
      [file.path]
    )

    // Skip if exists and hash matches (file unchanged)
    if (existing && existing.content_hash === file.content_hash) {
      return false
    }
  }

  const ext = getExtension(file.name)
  let summary = ""

  if (file.size > MAX_FILE_SIZE) {
    summary = await generateSummary(file.name, folderPath, null, null, null)
  } else if (PDF_EXTENSIONS.includes(ext)) {
    const buffer = await downloadFile(dbx, file.path)
    if (buffer) {
      const text = await extractPdfText(buffer)
      summary = await generateSummary(file.name, folderPath, text || null, null, null)
    } else {
      summary = await generateSummary(file.name, folderPath, null, null, null)
    }
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    // Check if image is too large for vision API
    if (file.size > MAX_IMAGE_SIZE) {
      summary = await generateSummary(file.name, folderPath, null, null, null)
    } else {
      const buffer = await downloadFile(dbx, file.path)
      if (buffer) {
        const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                         ext === "png" ? "image/png" :
                         ext === "gif" ? "image/gif" :
                         ext === "webp" ? "image/webp" : null

        if (mimeType) {
          const base64 = buffer.toString("base64")
          summary = await generateSummary(file.name, folderPath, null, base64, mimeType)
        } else {
          summary = await generateSummary(file.name, folderPath, null, null, null)
        }
      } else {
        summary = await generateSummary(file.name, folderPath, null, null, null)
      }
    }
  } else {
    summary = await generateSummary(file.name, folderPath, null, null, null)
  }

  if (summary) {
    await query(
      `INSERT INTO dropbox_file_summaries (dropbox_path, file_name, summary, content_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dropbox_path) DO UPDATE SET
         summary = $3,
         content_hash = $4,
         updated_at = NOW()`,
      [file.path, file.name, summary, file.content_hash]
    )
    return true
  }

  return false
}

/**
 * Run full Dropbox sync - scan files, generate summaries, update counts.
 */
export async function runDropboxSync(options: {
  forceRegenerate?: boolean
  verbose?: boolean
} = {}): Promise<SyncResult> {
  const { forceRegenerate = false, verbose = false } = options
  const result: SyncResult = {
    foldersScanned: 0,
    filesFound: 0,
    newSummaries: 0,
    deletedSummaries: 0,
    countsUpdated: 0,
    errors: []
  }

  const dbx = await getDropboxClient()
  if (!dbx) {
    result.errors.push("Dropbox not connected")
    return result
  }

  const mappings = await getFolderMappings()
  if (verbose) console.log(`Syncing ${mappings.length} folders...`)

  // Track all current file paths
  const allCurrentPaths = new Set<string>()

  for (const mapping of mappings) {
    result.foldersScanned++

    try {
      if (verbose) console.log(`\n📁 ${mapping.dropbox_folder_path}`)

      const files = await listAllFilesRecursive(dbx, mapping.dropbox_folder_path)
      result.filesFound += files.length

      // Track paths for this folder
      for (const file of files) {
        allCurrentPaths.add(file.path)
      }

      // Update document count
      await query(
        `UPDATE dropbox_folder_mappings
         SET document_count = $1, last_count_updated = NOW()
         WHERE id = $2`,
        [files.length, mapping.id]
      )
      result.countsUpdated++

      // Process each file
      for (const file of files) {
        try {
          const isNew = await processFile(dbx, file, mapping.dropbox_folder_path, forceRegenerate)
          if (isNew) {
            result.newSummaries++
            if (verbose) console.log(`  ✓ ${file.name}`)
          }
          // Small delay to avoid rate limits
          if (isNew) await new Promise(r => setTimeout(r, 150))
        } catch (error: any) {
          result.errors.push(`${file.name}: ${error.message}`)
        }
      }
    } catch (error: any) {
      result.errors.push(`${mapping.dropbox_folder_path}: ${error.message}`)
    }
  }

  // Clean up summaries for deleted files
  const allSummaries = await query<{ dropbox_path: string }>(
    "SELECT dropbox_path FROM dropbox_file_summaries"
  )

  for (const summary of allSummaries) {
    if (!allCurrentPaths.has(summary.dropbox_path)) {
      await query(
        "DELETE FROM dropbox_file_summaries WHERE dropbox_path = $1",
        [summary.dropbox_path]
      )
      result.deletedSummaries++
      if (verbose) console.log(`  🗑️  Removed: ${summary.dropbox_path}`)
    }
  }

  if (verbose) {
    console.log(`\n✅ Sync complete:`)
    console.log(`   Folders: ${result.foldersScanned}`)
    console.log(`   Files: ${result.filesFound}`)
    console.log(`   New summaries: ${result.newSummaries}`)
    console.log(`   Deleted: ${result.deletedSummaries}`)
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`)
    }
  }

  return result
}
