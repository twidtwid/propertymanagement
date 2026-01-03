/**
 * Generate deterministic UUIDs for Dropbox file paths
 * Uses UUID v5 (SHA-1 hash) to create consistent UUIDs from file paths
 */

import { createHash } from 'crypto'

// Namespace UUID for Dropbox files (generated once, fixed forever)
// This ensures all UUIDs are in the same namespace
const DROPBOX_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' // Standard DNS namespace

/**
 * Generate a deterministic UUID v5 from a Dropbox file path
 * Same path will always produce the same UUID
 *
 * @param path - Dropbox file path (e.g., "/Property Management/Documents/file.pdf")
 * @returns UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function pathToUUID(path: string): string {
  // Normalize the path (lowercase, trim)
  const normalizedPath = path.toLowerCase().trim()

  // Create SHA-1 hash of namespace + path
  const hash = createHash('sha1')
  hash.update(DROPBOX_NAMESPACE + normalizedPath)
  const hashBytes = hash.digest()

  // Convert to UUID v5 format
  // UUID v5 format: xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx
  // where 5 is the version and y is 8, 9, a, or b

  const uuid = [
    hashBytes.slice(0, 4).toString('hex'),
    hashBytes.slice(4, 6).toString('hex'),
    // Version 5 (0101 in binary = 5 in hex)
    ((hashBytes[6] & 0x0f) | 0x50).toString(16).padStart(2, '0') + hashBytes.slice(7, 8).toString('hex'),
    // Variant bits (10xx in binary)
    ((hashBytes[8] & 0x3f) | 0x80).toString(16).padStart(2, '0') + hashBytes.slice(9, 10).toString('hex'),
    hashBytes.slice(10, 16).toString('hex'),
  ].join('-')

  return uuid
}

/**
 * Generate metadata for a pinned document
 */
export function createDocumentMetadata(entry: { name: string; path_display: string; size?: number }) {
  return {
    title: entry.name,
    path: entry.path_display,
    size: entry.size,
  }
}
