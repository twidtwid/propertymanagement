/**
 * Météo-France API client for French weather alerts.
 * Covers mainland France (Paris) and overseas territories (Martinique).
 *
 * API: https://portail-api.meteofrance.fr/web/fr/
 * Requires METEO_FRANCE_API_KEY environment variable.
 *
 * Note: If API key is not available, this client returns empty results
 * rather than failing. Configure the API key in production to enable
 * Paris and Martinique alerts.
 */

import type { WeatherSeverity } from '@/types/database'

export interface MeteoFranceAlert {
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
  url: string // Link to the Météo-France vigilance map
}

// Météo-France vigilance levels map to severity
// Level 4 (Rouge/Red) -> extreme
// Level 3 (Orange) -> severe
// Level 2 (Jaune/Yellow) -> moderate
// Level 1 (Vert/Green) -> no alert
function mapVigilanceLevel(level: number): WeatherSeverity {
  switch (level) {
    case 4:
      return 'extreme'
    case 3:
      return 'severe'
    case 2:
      return 'moderate'
    default:
      return 'minor'
  }
}

// Map phenomene codes to event types
function mapPhenomene(code: number): string {
  switch (code) {
    case 1:
      return 'Wind'
    case 2:
      return 'Rain/Flood'
    case 3:
      return 'Thunderstorm'
    case 4:
      return 'Flood'
    case 5:
      return 'Snow/Ice'
    case 6:
      return 'Heat Wave'
    case 7:
      return 'Extreme Cold'
    case 8:
      return 'Avalanche'
    case 9:
      return 'Waves/Submersion'
    default:
      return 'Weather Alert'
  }
}

interface VigilanceData {
  departement: string
  niveau: number
  phenomene: number
  dateDebut: string
  dateFin: string
}

interface MeteoFranceResponse {
  product?: {
    vigilances?: VigilanceData[]
  }
}

/**
 * Fetch active alerts for a French department.
 * Department codes: 75 (Paris), 972 (Martinique)
 */
export async function fetchMeteoFranceAlerts(departmentCode: string): Promise<MeteoFranceAlert[]> {
  const apiKey = process.env.METEO_FRANCE_API_KEY

  if (!apiKey) {
    console.warn('METEO_FRANCE_API_KEY not configured - skipping Météo-France alerts')
    return []
  }

  try {
    // Note: This is a simplified implementation
    // The actual Météo-France API may require different endpoints
    const url = `https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours`
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.error(`Météo-France API error: ${response.status}`)
      return []
    }

    const data: MeteoFranceResponse = await response.json()
    const vigilances = data.product?.vigilances || []

    // Filter to our department and level >= 2 (yellow or higher)
    const departmentAlerts = vigilances.filter(
      (v) => v.departement === departmentCode && v.niveau >= 2
    )

    return departmentAlerts.map((v, index) => {
      const eventType = mapPhenomene(v.phenomene)
      const severity = mapVigilanceLevel(v.niveau)
      const colorName = v.niveau === 4 ? 'Red' : v.niveau === 3 ? 'Orange' : 'Yellow'

      // Use different URLs for mainland France vs overseas territories
      const url = departmentCode === '972'
        ? 'https://meteofrance.com/previsions-meteo-france/martinique/972'
        : 'https://vigilance.meteofrance.fr/'

      return {
        id: `mf-${departmentCode}-${v.phenomene}-${Date.now()}-${index}`,
        externalId: `mf-${departmentCode}-${v.phenomene}`,
        eventType: `${eventType} - ${colorName} Alert`,
        severity,
        urgency: v.niveau >= 3 ? 'immediate' : 'expected',
        headline: `${colorName} ${eventType} Alert for department ${departmentCode}`,
        description: null,
        instruction: null,
        effectiveAt: new Date(v.dateDebut),
        expiresAt: new Date(v.dateFin),
        zoneCode: departmentCode,
        url,
      }
    })
  } catch (error) {
    console.error(`Failed to fetch Météo-France alerts for ${departmentCode}:`, error)
    return []
  }
}

/**
 * Fetch alerts for multiple French departments.
 */
export async function fetchMeteoFranceAlertsForDepartments(
  departmentCodes: string[]
): Promise<MeteoFranceAlert[]> {
  const results = await Promise.all(
    departmentCodes.map((code) => fetchMeteoFranceAlerts(code))
  )

  // Flatten and deduplicate
  const alertMap = new Map<string, MeteoFranceAlert>()
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
 * Get emoji for Météo-France alert types.
 */
export function getMeteoFranceAlertEmoji(eventType: string): string {
  const event = eventType.toLowerCase()

  if (event.includes('wind')) return '💨'
  if (event.includes('rain') || event.includes('flood')) return '🌊'
  if (event.includes('thunder')) return '⛈️'
  if (event.includes('snow') || event.includes('ice')) return '❄️'
  if (event.includes('heat')) return '🌡️'
  if (event.includes('cold')) return '🥶'
  if (event.includes('wave') || event.includes('submersion')) return '🌊'
  if (event.includes('avalanche')) return '⛷️'

  return '⚠️'
}

/**
 * Get short label for Météo-France alert types.
 */
export function getMeteoFranceAlertLabel(eventType: string): string {
  const event = eventType.toLowerCase()

  if (event.includes('red')) {
    if (event.includes('wind')) return 'EXTREME WIND'
    if (event.includes('rain') || event.includes('flood')) return 'EXTREME FLOOD'
    if (event.includes('thunder')) return 'EXTREME STORM'
    if (event.includes('snow') || event.includes('ice')) return 'EXTREME WINTER'
    if (event.includes('heat')) return 'EXTREME HEAT'
    return 'RED ALERT'
  }

  if (event.includes('orange')) {
    if (event.includes('wind')) return 'HIGH WIND'
    if (event.includes('rain') || event.includes('flood')) return 'FLOOD RISK'
    if (event.includes('thunder')) return 'SEVERE STORM'
    if (event.includes('snow') || event.includes('ice')) return 'WINTER WEATHER'
    if (event.includes('heat')) return 'HEAT WAVE'
    return 'ORANGE ALERT'
  }

  // Yellow level
  return 'WEATHER WATCH'
}
