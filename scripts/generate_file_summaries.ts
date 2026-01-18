/**
 * One-time script to generate AI summaries for Dropbox files.
 * Uses local Gemma API when LOCAL_AI_URL is set, otherwise Claude Haiku.
 */

import { Dropbox } from "dropbox"
import pdfParse from "pdf-parse"
import { decryptToken } from "../src/lib/encryption"
import { query, queryOne } from "../src/lib/db"
import { chatCompletion, type AIMessage } from "../src/lib/ai"

interface FileToProcess {
  path: string
  name: string
  size: number
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic"]
const PDF_EXTENSIONS = ["pdf"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit
const MAX_TEXT_LENGTH = 8000 // Limit text sent to Haiku

async function getDropboxClient(): Promise<Dropbox> {
  const row = await queryOne<{ access_token_encrypted: string; namespace_id: string }>(
    "SELECT access_token_encrypted, namespace_id FROM dropbox_oauth_tokens WHERE user_email = $1",
    ["anne@annespalter.com"]
  )

  if (!row) {
    throw new Error("No Dropbox token found")
  }

  const token = decryptToken(row.access_token_encrypted)
  return new Dropbox({
    accessToken: token,
    fetch: fetch,
    pathRoot: JSON.stringify({ ".tag": "namespace_id", "namespace_id": row.namespace_id })
  })
}

async function listAllFiles(dbx: Dropbox, path: string = ""): Promise<FileToProcess[]> {
  const files: FileToProcess[] = []

  async function listRecursive(folderPath: string) {
    try {
      let response = await dbx.filesListFolder({ path: folderPath })

      for (const entry of response.result.entries) {
        if (entry[".tag"] === "folder") {
          await listRecursive(entry.path_lower!)
        } else if (entry[".tag"] === "file") {
          const fileEntry = entry as { path_display: string; name: string; size: number }
          files.push({
            path: fileEntry.path_display,
            name: fileEntry.name,
            size: fileEntry.size
          })
        }
      }

      while (response.result.has_more) {
        response = await dbx.filesListFolderContinue({ cursor: response.result.cursor })
        for (const entry of response.result.entries) {
          if (entry[".tag"] === "folder") {
            await listRecursive(entry.path_lower!)
          } else if (entry[".tag"] === "file") {
            const fileEntry = entry as { path_display: string; name: string; size: number }
            files.push({
              path: fileEntry.path_display,
              name: fileEntry.name,
              size: fileEntry.size
            })
          }
        }
      }
    } catch (error: any) {
      console.error(`Error listing ${folderPath}:`, error.error?.error_summary || error.message)
    }
  }

  await listRecursive(path)
  return files
}

function getExtension(filename: string): string {
  const parts = filename.split(".")
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

async function downloadFile(dbx: Dropbox, path: string): Promise<Buffer | null> {
  try {
    // Get a temporary download link and fetch the file directly
    const linkResponse = await dbx.filesGetTemporaryLink({ path })
    const downloadUrl = linkResponse.result.link

    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    console.error(`Error downloading ${path}:`, error.error?.error_summary || error.message)
    return null
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text.slice(0, MAX_TEXT_LENGTH)
  } catch (error) {
    console.error("PDF parse error:", error)
    return ""
  }
}

async function generateSummary(
  filename: string,
  content: string | null,
  imageBase64: string | null,
  mimeType: string | null
): Promise<string> {
  try {
    const messages: AIMessage[] = []

    if (imageBase64 && mimeType) {
      // Image file - use vision
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
            text: `This image is from a file named "${filename}" in a property management document folder. Generate a single-line summary (max 100 chars) describing what this document/image contains. Be specific and practical. Just output the summary, nothing else.`
          }
        ]
      })
    } else if (content) {
      // Text content (from PDF or text file)
      messages.push({
        role: "user",
        content: `This is text extracted from a document named "${filename}" in a property management folder:\n\n${content}\n\nGenerate a single-line summary (max 100 chars) describing what this document contains. Be specific and practical (e.g., "2024 property tax bill for $3,456.78 due April 1"). Just output the summary, nothing else.`
      })
    } else {
      // Just filename
      messages.push({
        role: "user",
        content: `Based only on the filename "${filename}" from a property management document folder, generate a single-line summary (max 100 chars) guessing what this document might contain. Be specific if possible. Just output the summary, nothing else.`
      })
    }

    const response = await chatCompletion(messages, { maxTokens: 150 })
    return response.content.trim().slice(0, 150)
  } catch (error: any) {
    console.error(`Error generating summary for ${filename}:`, error.message)
    return ""
  }
}

async function saveSummary(path: string, name: string, summary: string): Promise<void> {
  await query(
    `INSERT INTO dropbox_file_summaries (dropbox_path, file_name, summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (dropbox_path) DO UPDATE SET summary = $3`,
    [path, name, summary]
  )
}

async function processFile(dbx: Dropbox, file: FileToProcess): Promise<void> {
  // Check if already processed
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM dropbox_file_summaries WHERE dropbox_path = $1",
    [file.path]
  )
  if (existing) {
    console.log(`⏭️  Skipping (already processed): ${file.name}`)
    return
  }

  const ext = getExtension(file.name)
  let summary = ""

  if (file.size > MAX_FILE_SIZE) {
    console.log(`⏭️  Skipping (too large): ${file.name}`)
    summary = await generateSummary(file.name, null, null, null)
  } else if (PDF_EXTENSIONS.includes(ext)) {
    console.log(`📄 Processing PDF: ${file.name}`)
    const buffer = await downloadFile(dbx, file.path)
    if (buffer) {
      const text = await extractPdfText(buffer)
      summary = await generateSummary(file.name, text || null, null, null)
    }
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    console.log(`🖼️  Processing image: ${file.name}`)
    const buffer = await downloadFile(dbx, file.path)
    if (buffer) {
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                       ext === "png" ? "image/png" :
                       ext === "gif" ? "image/gif" :
                       ext === "webp" ? "image/webp" : null

      if (mimeType) {
        const base64 = buffer.toString("base64")
        summary = await generateSummary(file.name, null, base64, mimeType)
      } else {
        summary = await generateSummary(file.name, null, null, null)
      }
    }
  } else {
    console.log(`📝 Processing by name: ${file.name}`)
    summary = await generateSummary(file.name, null, null, null)
  }

  if (summary) {
    await saveSummary(file.path, file.name, summary)
    console.log(`   ✓ ${summary}`)
  } else {
    console.log(`   ⚠️  No summary generated`)
  }

  // Small delay to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 200))
}

async function main() {
  console.log("🚀 Starting file summary generation...\n")

  const dbx = await getDropboxClient()

  // Get all mapped folders
  const mappings = await query<{ dropbox_folder_path: string }>(
    "SELECT DISTINCT dropbox_folder_path FROM dropbox_folder_mappings WHERE is_active = true"
  )

  console.log(`Found ${mappings.length} folders to process\n`)

  let totalFiles = 0
  let processedFiles = 0

  for (const mapping of mappings) {
    console.log(`\n📁 Scanning: ${mapping.dropbox_folder_path}`)
    const files = await listAllFiles(dbx, mapping.dropbox_folder_path)
    console.log(`   Found ${files.length} files\n`)
    totalFiles += files.length

    for (const file of files) {
      await processFile(dbx, file)
      processedFiles++
    }
  }

  console.log(`\n✅ Done! Processed ${processedFiles}/${totalFiles} files`)

  // Show summary count
  const count = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM dropbox_file_summaries"
  )
  console.log(`   Total summaries in database: ${count?.count}`)

  process.exit(0)
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
