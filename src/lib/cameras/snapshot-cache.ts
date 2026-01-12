/**
 * In-memory cache for camera snapshots
 * Caches snapshots for 10 minutes to reduce load on camera APIs
 */

interface CachedSnapshot {
  buffer: Buffer
  timestamp: Date
  cameraId: string
}

// In-memory cache map
const snapshotCache = new Map<string, CachedSnapshot>()

// Cache TTL: 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000

/**
 * Get a cached snapshot if it exists and is not expired
 * @param cameraId - Camera UUID
 * @returns Cached snapshot or null if not found/expired
 */
export function getCachedSnapshot(cameraId: string): CachedSnapshot | null {
  const cached = snapshotCache.get(cameraId)
  if (!cached) {
    return null
  }

  const age = Date.now() - cached.timestamp.getTime()
  if (age > CACHE_TTL_MS) {
    // Cache expired
    return null
  }

  return cached
}

/**
 * Cache a snapshot for the specified camera
 * @param cameraId - Camera UUID
 * @param buffer - JPEG image buffer
 */
export function setCachedSnapshot(cameraId: string, buffer: Buffer): void {
  snapshotCache.set(cameraId, {
    buffer,
    timestamp: new Date(),
    cameraId,
  })
}

/**
 * Get the last cached snapshot regardless of expiration
 * Used as fallback when live fetch fails
 * @param cameraId - Camera UUID
 * @returns Last cached snapshot buffer or null if never cached
 */
export function getLastSnapshot(cameraId: string): Buffer | null {
  const cached = snapshotCache.get(cameraId)
  return cached?.buffer || null
}

/**
 * Clear cache for a specific camera
 * @param cameraId - Camera UUID
 */
export function clearCache(cameraId: string): void {
  snapshotCache.delete(cameraId)
}

/**
 * Clear all cached snapshots
 */
export function clearAllCache(): void {
  snapshotCache.clear()
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    size: snapshotCache.size,
    cameras: Array.from(snapshotCache.keys()),
  }
}
