/**
 * wttr.in client for fetching current weather conditions.
 * Used for the dashboard weather card (separate from alert system).
 *
 * Resilience features:
 * - Per-location caching with stale fallback
 * - Retry with exponential backoff
 * - Merge fresh data with stale cache for complete results
 */

export interface WttrLocation {
  name: string
  displayName: string
  query: string
  useFahrenheit: boolean
  timezone: string // IANA timezone identifier
}

export interface WeatherCondition {
  location: string
  displayName: string
  tempC: number
  tempF: number
  highC: number
  lowC: number
  highF: number
  lowF: number
  description: string
  emoji: string
  humidity: number
  windMph: number
  feelsLikeF: number
  feelsLikeC: number
  useFahrenheit: boolean
  timezone: string
  isStale?: boolean      // True if this data is from stale cache
  fetchedAt?: number     // Timestamp when this data was fetched
}

// Per-location cache for resilience
interface LocationCache {
  data: WeatherCondition
  fetchedAt: number
}

const locationCache = new Map<string, LocationCache>()
const LOCATION_CACHE_TTL_MS = 30 * 60 * 1000  // 30 minutes - stale but usable
const STALE_THRESHOLD_MS = 10 * 60 * 1000     // 10 minutes - after this, mark as stale

// Retry configuration
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000  // Base delay, doubles each retry

// Locations for the weather card (ordered: Brooklyn, RI, VT, MAR, PAR)
export const WEATHER_LOCATIONS: WttrLocation[] = [
  { name: 'nyc', displayName: 'Brooklyn', query: 'Williamsburg,Brooklyn,NY', useFahrenheit: true, timezone: 'America/New_York' },
  { name: 'ri', displayName: 'Rhode Island', query: 'Providence,RI', useFahrenheit: true, timezone: 'America/New_York' },
  { name: 'vt', displayName: 'Vermont', query: 'Brattleboro,VT', useFahrenheit: true, timezone: 'America/New_York' },
  { name: 'martinique', displayName: 'Martinique', query: 'Fort-de-France,Martinique', useFahrenheit: true, timezone: 'America/Martinique' },
  { name: 'paris', displayName: 'Paris', query: 'Paris,France', useFahrenheit: true, timezone: 'Europe/Paris' },
]

// Map wttr.in weather codes to emojis
// See: https://github.com/chubin/wttr.in/blob/master/lib/constants.py
function getWeatherEmoji(code: string, description: string): string {
  const codeNum = parseInt(code, 10)
  const desc = description.toLowerCase()

  // Snow conditions
  if (desc.includes('snow') || desc.includes('blizzard') || [227, 230, 179, 182, 185, 323, 326, 329, 332, 335, 338, 368, 371, 392, 395].includes(codeNum)) {
    return '❄️'
  }

  // Rain/thunder
  if (desc.includes('thunder') || [200, 386, 389].includes(codeNum)) {
    return '⛈️'
  }
  if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower') || [176, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 317, 320, 353, 356, 359, 362, 365].includes(codeNum)) {
    return '🌧️'
  }

  // Fog/mist
  if (desc.includes('fog') || desc.includes('mist') || [143, 248, 260].includes(codeNum)) {
    return '🌫️'
  }

  // Cloudy
  if (desc.includes('overcast') || codeNum === 122) {
    return '☁️'
  }
  if (desc.includes('cloudy') || desc.includes('cloud') || [116, 119].includes(codeNum)) {
    return '⛅'
  }

  // Sunny/clear
  if (desc.includes('sunny') || desc.includes('clear') || codeNum === 113) {
    return '☀️'
  }

  // Tropical default for Martinique
  if (desc.includes('tropical')) {
    return '🌴'
  }

  return '🌤️' // default partly sunny
}

interface WttrResponse {
  current_condition: Array<{
    temp_C: string
    temp_F: string
    FeelsLikeC: string
    FeelsLikeF: string
    humidity: string
    windspeedMiles: string
    weatherDesc: Array<{ value: string }>
    weatherCode: string
  }>
  weather: Array<{
    maxtempC: string
    mintempC: string
    maxtempF: string
    mintempF: string
  }>
  nearest_area: Array<{
    areaName: Array<{ value: string }>
    region: Array<{ value: string }>
  }>
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Attempt a single fetch for a location (no retry)
 */
async function attemptFetch(location: WttrLocation): Promise<WeatherCondition | null> {
  const startTime = Date.now()
  const url = `https://wttr.in/${encodeURIComponent(location.query)}?format=j1`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PropertyManagement/1.0',
    },
    signal: AbortSignal.timeout(8000),  // 8s timeout per attempt
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data: WttrResponse = await response.json()
  const current = data.current_condition[0]
  const today = data.weather[0]

  if (!current || !today) {
    throw new Error('Invalid response: missing current_condition or weather')
  }

  const description = current.weatherDesc[0]?.value || 'Unknown'
  const emoji = getWeatherEmoji(current.weatherCode, description)
  const now = Date.now()

  console.log(`[Weather] ✓ ${location.displayName}: ${current.temp_F}°F (${now - startTime}ms)`)

  return {
    location: location.name,
    displayName: location.displayName,
    tempC: parseInt(current.temp_C, 10),
    tempF: parseInt(current.temp_F, 10),
    highC: parseInt(today.maxtempC, 10),
    lowC: parseInt(today.mintempC, 10),
    highF: parseInt(today.maxtempF, 10),
    lowF: parseInt(today.mintempF, 10),
    description: simplifyDescription(description),
    emoji,
    humidity: parseInt(current.humidity, 10),
    windMph: parseInt(current.windspeedMiles, 10),
    feelsLikeF: parseInt(current.FeelsLikeF, 10),
    feelsLikeC: parseInt(current.FeelsLikeC, 10),
    useFahrenheit: location.useFahrenheit,
    timezone: location.timezone,
    fetchedAt: now,
  }
}

/**
 * Get cached data for a location if available and not expired
 */
function getCachedLocation(locationName: string): WeatherCondition | null {
  const cached = locationCache.get(locationName)
  if (!cached) return null

  const age = Date.now() - cached.fetchedAt
  if (age > LOCATION_CACHE_TTL_MS) {
    // Cache expired, remove it
    locationCache.delete(locationName)
    return null
  }

  // Return with stale flag if past threshold
  return {
    ...cached.data,
    isStale: age > STALE_THRESHOLD_MS,
    fetchedAt: cached.fetchedAt,
  }
}

/**
 * Update the per-location cache
 */
function updateLocationCache(data: WeatherCondition): void {
  locationCache.set(data.location, {
    data,
    fetchedAt: data.fetchedAt || Date.now(),
  })
}

/**
 * Fetch weather for a single location with retry and fallback to cache
 */
export async function fetchWeather(location: WttrLocation): Promise<WeatherCondition | null> {
  const startTime = Date.now()
  let lastError: string = ''

  // Try up to MAX_RETRIES + 1 times (initial + retries)
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
        console.log(`[Weather] Retry ${attempt}/${MAX_RETRIES} for ${location.displayName} after ${delay}ms`)
        await sleep(delay)
      }

      const result = await attemptFetch(location)
      if (result) {
        // Success - update cache and return
        updateLocationCache(result)
        return result
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      // Continue to next retry
    }
  }

  // All retries failed - try to use cached data
  const cached = getCachedLocation(location.name)
  if (cached) {
    const cacheAge = Math.round((Date.now() - (cached.fetchedAt || 0)) / 1000 / 60)
    console.warn(`[Weather] ✗ ${location.displayName} failed after ${Date.now() - startTime}ms (${lastError}), using ${cacheAge}m old cache`)
    return cached
  }

  console.error(`[Weather] ✗ ${location.displayName} failed after ${Date.now() - startTime}ms: ${lastError} (no cache available)`)
  return null
}

/**
 * Simplify weather descriptions for the compact card
 */
function simplifyDescription(desc: string): string {
  const lower = desc.toLowerCase()

  if (lower.includes('partly cloudy')) return 'Partly Cloudy'
  if (lower.includes('overcast')) return 'Overcast'
  if (lower.includes('cloudy')) return 'Cloudy'
  if (lower.includes('sunny')) return 'Sunny'
  if (lower.includes('clear')) return 'Clear'
  if (lower.includes('light rain')) return 'Light Rain'
  if (lower.includes('heavy rain')) return 'Heavy Rain'
  if (lower.includes('rain')) return 'Rain'
  if (lower.includes('light snow')) return 'Light Snow'
  if (lower.includes('heavy snow')) return 'Heavy Snow'
  if (lower.includes('snow')) return 'Snow'
  if (lower.includes('thunder')) return 'Thunderstorm'
  if (lower.includes('fog')) return 'Fog'
  if (lower.includes('mist')) return 'Mist'
  if (lower.includes('drizzle')) return 'Drizzle'

  // Title case the original if no match
  return desc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

/**
 * Fetch weather for all locations
 */
export async function fetchAllWeather(): Promise<WeatherCondition[]> {
  console.log(`[Weather] Fetching ${WEATHER_LOCATIONS.length} locations...`)
  const results = await Promise.all(
    WEATHER_LOCATIONS.map(loc => fetchWeather(loc))
  )
  const validResults = results.filter((r): r is WeatherCondition => r !== null)

  const fresh = validResults.filter(r => !r.isStale)
  const stale = validResults.filter(r => r.isStale)

  if (stale.length > 0) {
    console.log(`[Weather] Completed: ${fresh.length} fresh, ${stale.length} stale (${stale.map(r => r.displayName).join(', ')})`)
  } else {
    console.log(`[Weather] Completed: ${validResults.length}/${WEATHER_LOCATIONS.length} locations`)
  }

  return validResults
}

/**
 * Get cache statistics for monitoring
 */
export function getWeatherCacheStats(): {
  cachedLocations: string[]
  oldestCacheAge: number | null
} {
  const now = Date.now()
  let oldestAge: number | null = null

  const entries = Array.from(locationCache.entries())
  const cachedLocations = entries.map(([name]) => name)

  for (const [, cache] of entries) {
    const age = now - cache.fetchedAt
    if (oldestAge === null || age > oldestAge) {
      oldestAge = age
    }
  }

  return {
    cachedLocations,
    oldestCacheAge: oldestAge ? Math.round(oldestAge / 1000 / 60) : null,  // minutes
  }
}
