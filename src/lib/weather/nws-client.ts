/**
 * National Weather Service (NWS) API client for US weather alerts.
 * API docs: https://www.weather.gov/documentation/services-web-api
 * No authentication required.
 */

import type { WeatherSeverity } from '@/types/database'

export interface NWSAlert {
  id: string
  externalId: string
  eventType: string
  severity: WeatherSeverity
  urgency: string | null
  headline: string
  description: string | null
  instruction: string | null
  effectiveAt: Date
  expiresAt: Date
  zoneCode: string
  url: string // Link to the actual alert on weather.gov
}

interface NWSAlertFeature {
  properties: {
    id: string
    event: string
    severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'
    urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown'
    headline: string
    description: string
    instruction: string | null
    effective: string
    expires: string
    affectedZones: string[]
  }
}

interface NWSResponse {
  features: NWSAlertFeature[]
}

// Map NWS severity to our severity
function mapSeverity(nwsSeverity: string): WeatherSeverity {
  switch (nwsSeverity) {
    case 'Extreme':
      return 'extreme'
    case 'Severe':
      return 'severe'
    case 'Moderate':
      return 'moderate'
    case 'Minor':
    default:
      return 'minor'
  }
}

// Map NWS urgency
function mapUrgency(nwsUrgency: string): string | null {
  switch (nwsUrgency) {
    case 'Immediate':
      return 'immediate'
    case 'Expected':
      return 'expected'
    case 'Future':
      return 'future'
    default:
      return null
  }
}

// Map zone codes to NWS forecast office codes
// These are reliable URLs that always work
function getForecastOffice(zoneCode: string): string {
  const state = zoneCode.substring(0, 2).toUpperCase()
  switch (state) {
    case 'VT':
      return 'btv' // Burlington, VT
    case 'NY':
      return 'okx' // New York City
    case 'RI':
      return 'box' // Boston (covers RI)
    default:
      return 'btv' // fallback
  }
}

/**
 * Fetch active alerts for a specific NWS zone.
 * Zone format: State abbreviation + Z + 3-digit number (e.g., VTZ007)
 */
export async function fetchNWSAlerts(zoneCode: string): Promise<NWSAlert[]> {
  try {
    const url = `https://api.weather.gov/alerts/active/zone/${zoneCode}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PropertyManagement/1.0 (contact@spmsystem.com)',
        'Accept': 'application/geo+json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.error(`NWS API error for zone ${zoneCode}: ${response.status}`)
      return []
    }

    const data: NWSResponse = await response.json()

    return data.features.map((feature) => {
      const props = feature.properties
      // Link to the NWS forecast office page for this zone
      const forecastOffice = getForecastOffice(zoneCode)
      const webUrl = `https://www.weather.gov/${forecastOffice}/`
      return {
        id: props.id,
        externalId: props.id,
        eventType: props.event,
        severity: mapSeverity(props.severity),
        urgency: mapUrgency(props.urgency),
        headline: props.headline,
        description: props.description || null,
        instruction: props.instruction || null,
        effectiveAt: new Date(props.effective),
        expiresAt: new Date(props.expires),
        zoneCode,
        url: webUrl,
      }
    })
  } catch (error) {
    console.error(`Failed to fetch NWS alerts for zone ${zoneCode}:`, error)
    return []
  }
}

/**
 * Fetch alerts for multiple NWS zones in parallel.
 * Deduplicates alerts that appear in multiple zones.
 */
export async function fetchNWSAlertsForZones(zoneCodes: string[]): Promise<NWSAlert[]> {
  // Fetch all zones in parallel
  const results = await Promise.all(
    zoneCodes.map((zone) => fetchNWSAlerts(zone))
  )

  // Flatten and deduplicate by external ID
  const alertMap = new Map<string, NWSAlert>()
  for (const alerts of results) {
    for (const alert of alerts) {
      if (!alertMap.has(alert.externalId)) {
        alertMap.set(alert.externalId, alert)
      }
    }
  }

  return Array.from(alertMap.values())
}

/**
 * Check if an alert is significant enough to notify about.
 * We only notify for moderate severity or higher.
 */
export function isSignificantAlert(alert: NWSAlert): boolean {
  return ['moderate', 'severe', 'extreme'].includes(alert.severity)
}

/**
 * Get an emoji for the alert type.
 */
export function getAlertEmoji(eventType: string): string {
  const event = eventType.toLowerCase()

  // Winter
  if (event.includes('winter storm') || event.includes('blizzard')) return '❄️'
  if (event.includes('ice storm')) return '🧊'
  if (event.includes('freeze') || event.includes('frost')) return '🥶'
  if (event.includes('snow')) return '🌨️'

  // Water
  if (event.includes('flood')) return '🌊'
  if (event.includes('flash flood')) return '🌊'
  if (event.includes('coastal')) return '🌊'

  // Wind
  if (event.includes('tornado')) return '🌪️'
  if (event.includes('hurricane')) return '🌀'
  if (event.includes('tropical')) return '🌀'
  if (event.includes('wind')) return '💨'

  // Heat/Fire
  if (event.includes('heat')) return '🌡️'
  if (event.includes('fire') || event.includes('red flag')) return '🔥'

  // Storm
  if (event.includes('thunderstorm') || event.includes('severe storm')) return '⛈️'

  return '⚠️' // default
}

/**
 * Get a short label for the alert type.
 */
export function getAlertLabel(eventType: string): string {
  const event = eventType.toLowerCase()

  if (event.includes('winter storm warning')) return 'WINTER STORM'
  if (event.includes('winter storm watch')) return 'WINTER STORM WATCH'
  if (event.includes('blizzard')) return 'BLIZZARD'
  if (event.includes('ice storm')) return 'ICE STORM'
  if (event.includes('freeze')) return 'FREEZE'
  if (event.includes('frost')) return 'FROST'

  if (event.includes('flash flood')) return 'FLASH FLOOD'
  if (event.includes('flood warning')) return 'FLOOD WARNING'
  if (event.includes('flood watch')) return 'FLOOD WATCH'
  if (event.includes('coastal flood')) return 'COASTAL FLOOD'

  if (event.includes('tornado warning')) return 'TORNADO'
  if (event.includes('tornado watch')) return 'TORNADO WATCH'
  if (event.includes('hurricane')) return 'HURRICANE'
  if (event.includes('tropical storm')) return 'TROPICAL STORM'
  if (event.includes('high wind')) return 'HIGH WIND'
  if (event.includes('wind advisory')) return 'WIND ADVISORY'

  if (event.includes('excessive heat')) return 'EXTREME HEAT'
  if (event.includes('heat advisory')) return 'HEAT ADVISORY'
  if (event.includes('red flag')) return 'FIRE DANGER'

  if (event.includes('severe thunderstorm')) return 'SEVERE STORM'

  // Generic fallback - capitalize first letters
  return eventType.toUpperCase().replace(/ (WARNING|WATCH|ADVISORY)$/i, '')
}
