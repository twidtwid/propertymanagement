/**
 * wttr.in client for fetching current weather conditions.
 * Used for the dashboard weather card (separate from alert system).
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
}

// Locations for the weather card (ordered: Brooklyn, RI, VT, MAR, PAR)
export const WEATHER_LOCATIONS: WttrLocation[] = [
  { name: 'nyc', displayName: 'Brooklyn', query: 'Williamsburg,Brooklyn,NY', useFahrenheit: true, timezone: 'America/New_York' },
  { name: 'ri', displayName: 'Rhode Island', query: 'Providence,RI', useFahrenheit: true, timezone: 'America/New_York' },
  { name: 'vt', displayName: 'Vermont', query: 'Brattleboro,VT', useFahrenheit: true, timezone: 'America/New_York' },
  { name: 'martinique', displayName: 'Martinique', query: 'Fort-de-France,Martinique', useFahrenheit: false, timezone: 'America/Martinique' },
  { name: 'paris', displayName: 'Paris', query: 'Paris,France', useFahrenheit: false, timezone: 'Europe/Paris' },
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
 * Fetch weather for a single location from wttr.in
 */
export async function fetchWeather(location: WttrLocation): Promise<WeatherCondition | null> {
  const startTime = Date.now()
  try {
    const url = `https://wttr.in/${encodeURIComponent(location.query)}?format=j1`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PropertyManagement/1.0',
      },
      // Allow some time for the free service
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.warn(`[Weather] wttr.in returned ${response.status} for ${location.displayName} (${location.query}) in ${Date.now() - startTime}ms`)
      return null
    }

    const data: WttrResponse = await response.json()
    const current = data.current_condition[0]
    const today = data.weather[0]

    if (!current || !today) {
      console.warn(`[Weather] Invalid response for ${location.displayName}: missing current_condition or weather`)
      return null
    }

    const description = current.weatherDesc[0]?.value || 'Unknown'
    const emoji = getWeatherEmoji(current.weatherCode, description)

    console.log(`[Weather] ✓ ${location.displayName}: ${current.temp_F}°F (${Date.now() - startTime}ms)`)

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
    }
  } catch (error) {
    const elapsed = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Weather] ✗ ${location.displayName} failed after ${elapsed}ms: ${errorMsg}`)
    return null
  }
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
  console.log(`[Weather] Completed: ${validResults.length}/${WEATHER_LOCATIONS.length} locations (${validResults.map(r => r.displayName).join(', ')})`)
  return validResults
}
