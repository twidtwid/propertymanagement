/**
 * Utility functions for Dropbox file handling.
 * These are client-safe and don't require database access.
 */

/**
 * Get the relative path - just return the path as-is since we're using namespace.
 */
export function getRelativePath(fullPath: string): string {
  // When using namespace_id, paths are already relative to Property Management
  return fullPath || "/"
}

/**
 * Get breadcrumb segments from a path.
 */
export function getPathBreadcrumbs(path: string): { name: string; path: string }[] {
  const relativePath = getRelativePath(path)
  const segments = relativePath.split("/").filter(Boolean)

  const breadcrumbs: { name: string; path: string }[] = [
    { name: "Documents", path: "" }
  ]

  let currentPath = ""
  for (const segment of segments) {
    currentPath += `/${segment}`
    breadcrumbs.push({ name: segment, path: currentPath })
  }

  return breadcrumbs
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Get file extension from filename.
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) return ""
  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * Get icon type based on file extension.
 */
export function getFileIconType(filename: string): "pdf" | "image" | "document" | "spreadsheet" | "archive" | "file" {
  const ext = getFileExtension(filename)

  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(ext)) return "image"
  if (["doc", "docx", "txt", "rtf", "odt"].includes(ext)) return "document"
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "spreadsheet"
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive"

  return "file"
}
