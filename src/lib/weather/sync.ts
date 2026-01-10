/**
 * Weather alert sync logic.
 * Fetches alerts from NWS and Météo-France, detects changes, and sends notifications.
 */

import { query, queryOne } from '@/lib/db'
import { notifyAll } from '@/lib/pushover'
import { fetchNWSAlertsForZones, getAlertEmoji, getAlertLabel, type NWSAlert } from './nws-client'
import { fetchMeteoFranceAlertsForDepartments, getMeteoFranceAlertEmoji, getMeteoFranceAlertLabel, type MeteoFranceAlert } from './meteo-france-client'
import type { WeatherZone, WeatherAlert, WeatherProvider, WeatherSeverity } from '@/types/database'

interface AlertChange {
  type: 'new' | 'upgraded' | 'downgraded' | 'expired' | 'unchanged'
  oldSeverity?: WeatherSeverity
  newSeverity?: WeatherSeverity
}

// Severity ranking for comparison
const SEVERITY_RANK: Record<WeatherSeverity, number> = {
  minor: 1,
  moderate: 2,
  severe: 3,
  extreme: 4,
}

/**
 * Detect what kind of change occurred between existing and incoming alert.
 */
function detectAlertChange(
  existing: WeatherAlert | null,
  incoming: NWSAlert | MeteoFranceAlert | null
): AlertChange {
  if (!existing && incoming) {
    return { type: 'new' }
  }

  if (existing && !incoming) {
    return { type: 'expired' }
  }

  if (!existing || !incoming) {
    return { type: 'unchanged' }
  }

  const oldRank = SEVERITY_RANK[existing.severity]
  const newRank = SEVERITY_RANK[incoming.severity]

  if (newRank > oldRank) {
    return {
      type: 'upgraded',
      oldSeverity: existing.severity,
      newSeverity: incoming.severity,
    }
  }

  if (newRank < oldRank) {
    return {
      type: 'downgraded',
      oldSeverity: existing.severity,
      newSeverity: incoming.severity,
    }
  }

  return { type: 'unchanged' }
}

// Fun weather alert phrases
const ALERT_INTROS: Record<string, string[]> = {
  winter: ['Bundle up! 🧣', 'Snow day incoming! ⛄', 'Time for hot cocoa! ☕'],
  wind: ['Hold onto your hat! 🎩', 'Windy times ahead! 🌬️', 'Batten down the hatches!'],
  flood: ['Break out the kayak! 🚣', 'Water water everywhere! 💧', 'Grab your galoshes! 👢'],
  heat: ['Stay cool! 🧊', 'It\'s getting toasty! 🥵', 'Pool day! 🏊'],
  thunderstorm: ['Thunder rolls! ⚡', 'Storm\'s brewing! 🌩️', 'Nature\'s light show! 🎆'],
  hurricane: ['Hunker down! 🏠', 'Big one coming! 🌊', 'Stay safe! ❤️'],
  default: ['Heads up! 👀', 'Weather alert! 📢', 'Take note! 📝'],
}

// Get sound based on severity and type
function getAlertSound(severity: string, eventType: string): string {
  if (severity === 'extreme') return 'siren'
  if (severity === 'severe') return 'alien'
  if (eventType.toLowerCase().includes('winter') || eventType.toLowerCase().includes('snow')) return 'cosmic'
  if (eventType.toLowerCase().includes('thunder') || eventType.toLowerCase().includes('storm')) return 'mechanical'
  if (eventType.toLowerCase().includes('flood')) return 'bugle'
  return 'spacealarm'
}

// Pick a fun intro based on alert type
function getAlertIntro(eventType: string): string {
  const type = eventType.toLowerCase()
  let category = 'default'
  if (type.includes('winter') || type.includes('snow') || type.includes('ice') || type.includes('blizzard')) category = 'winter'
  else if (type.includes('wind') || type.includes('tornado')) category = 'wind'
  else if (type.includes('flood')) category = 'flood'
  else if (type.includes('heat') || type.includes('excessive')) category = 'heat'
  else if (type.includes('thunder') || type.includes('storm')) category = 'thunderstorm'
  else if (type.includes('hurricane') || type.includes('tropical')) category = 'hurricane'

  const options = ALERT_INTROS[category]
  return options[Math.floor(Math.random() * options.length)]
}

// Format relative time
function formatTimeUntil(date: Date): string {
  const hours = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60))
  if (hours < 1) return 'very soon'
  if (hours === 1) return 'in ~1 hour'
  if (hours < 24) return `in ~${hours} hours`
  const days = Math.round(hours / 24)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

/**
 * Format a notification message for a weather alert.
 */
function formatNotification(
  alert: NWSAlert | MeteoFranceAlert,
  propertyNames: string[],
  provider: WeatherProvider
): { title: string; message: string; url: string; urlTitle: string; sound: string } {
  const emoji = provider === 'nws'
    ? getAlertEmoji(alert.eventType)
    : getMeteoFranceAlertEmoji(alert.eventType)

  const label = provider === 'nws'
    ? getAlertLabel(alert.eventType)
    : getMeteoFranceAlertLabel(alert.eventType)

  const locationStr = propertyNames.length === 1
    ? propertyNames[0]
    : `${propertyNames.length} properties`

  const intro = getAlertIntro(alert.eventType)
  const timeUntil = formatTimeUntil(alert.expiresAt)
  const sound = getAlertSound(alert.severity, alert.eventType)

  // Short title with location for phone notifications
  // e.g., "❄️ VT: Winter Advisory" or "🌊 RI: Flood Watch"
  const shortLocation = propertyNames.length === 1
    ? propertyNames[0].replace(/\s*(House|Condo|Property|Apartment)s?/gi, '').trim()
    : `${propertyNames.length} props`

  return {
    title: `${emoji} ${shortLocation}: ${label}`,
    message: `${intro}\n\n${alert.headline}\n\n⏰ Expires ${timeUntil}`,
    url: alert.url,
    urlTitle: 'View alert — via spmsystem.com',
    sound,
  }
}

/**
 * Get all active weather zones grouped by provider.
 */
export async function getActiveWeatherZones(): Promise<{
  nws: WeatherZone[]
  meteoFrance: WeatherZone[]
}> {
  const zones = await query<WeatherZone & { property_name: string }>(`
    SELECT wz.*, p.name as property_name
    FROM weather_zones wz
    JOIN properties p ON wz.property_id = p.id
    WHERE wz.is_active = TRUE
      AND p.status = 'active'
  `)

  return {
    nws: zones.filter((z) => z.provider === 'nws'),
    meteoFrance: zones.filter((z) => z.provider === 'meteo_france'),
  }
}

/**
 * Get existing alert by external ID.
 */
async function getExistingAlert(externalId: string): Promise<WeatherAlert | null> {
  return queryOne<WeatherAlert>(
    `SELECT * FROM weather_alerts WHERE external_id = $1`,
    [externalId]
  )
}

/**
 * Insert or update a weather alert.
 */
async function upsertAlert(
  alert: NWSAlert | MeteoFranceAlert,
  provider: WeatherProvider
): Promise<string> {
  const result = await queryOne<{ id: string }>(`
    INSERT INTO weather_alerts (
      external_id, provider, zone_code, event_type, severity, urgency,
      headline, description, instruction, effective_at, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (external_id) DO UPDATE SET
      severity = EXCLUDED.severity,
      urgency = EXCLUDED.urgency,
      headline = EXCLUDED.headline,
      description = EXCLUDED.description,
      instruction = EXCLUDED.instruction,
      expires_at = EXCLUDED.expires_at
    RETURNING id
  `, [
    alert.externalId,
    provider,
    alert.zoneCode,
    alert.eventType,
    alert.severity,
    alert.urgency,
    alert.headline,
    alert.description,
    alert.instruction,
    alert.effectiveAt.toISOString(),
    alert.expiresAt.toISOString(),
  ])

  return result?.id || ''
}

/**
 * Link an alert to properties via their zones.
 */
async function linkAlertToProperties(
  alertId: string,
  zoneCode: string,
  provider: WeatherProvider
): Promise<string[]> {
  // Get property IDs that have this zone
  const properties = await query<{ id: string; name: string }>(`
    SELECT p.id, p.name
    FROM properties p
    JOIN weather_zones wz ON p.id = wz.property_id
    WHERE wz.zone_code = $1 AND wz.provider = $2
  `, [zoneCode, provider])

  // Create links
  for (const prop of properties) {
    await query(`
      INSERT INTO property_weather_alerts (property_id, weather_alert_id)
      VALUES ($1, $2)
      ON CONFLICT (property_id, weather_alert_id) DO NOTHING
    `, [prop.id, alertId])
  }

  return properties.map((p) => p.name)
}

/**
 * Mark alert as notified.
 */
async function markAlertNotified(alertId: string): Promise<void> {
  await query(`
    UPDATE weather_alerts
    SET notified_at = NOW()
    WHERE id = $1
  `, [alertId])
}

/**
 * Mark alert as having a status change notified.
 */
async function markAlertStatusChangeNotified(alertId: string): Promise<void> {
  await query(`
    UPDATE weather_alerts
    SET status_change_notified_at = NOW()
    WHERE id = $1
  `, [alertId])
}

/**
 * Clean up expired alerts.
 */
async function cleanupExpiredAlerts(): Promise<number> {
  const result = await query<{ count: string }>(`
    WITH deleted AS (
      DELETE FROM weather_alerts
      WHERE expires_at < NOW() - INTERVAL '1 day'
      RETURNING *
    )
    SELECT COUNT(*) as count FROM deleted
  `)

  return parseInt(result[0]?.count || '0', 10)
}

/**
 * Main sync function - fetch alerts and process changes.
 */
export async function syncWeatherAlerts(): Promise<{
  newAlerts: number
  upgrades: number
  expired: number
  notificationsSent: number
}> {
  const stats = {
    newAlerts: 0,
    upgrades: 0,
    expired: 0,
    notificationsSent: 0,
  }

  try {
    // Get active zones
    const zones = await getActiveWeatherZones()

    // Fetch NWS alerts for US zones
    const nwsZoneCodes = Array.from(new Set(zones.nws.map((z) => z.zone_code)))
    const nwsAlerts = nwsZoneCodes.length > 0
      ? await fetchNWSAlertsForZones(nwsZoneCodes)
      : []

    // Fetch Météo-France alerts for French zones
    const mfDepartments = Array.from(new Set(zones.meteoFrance.map((z) => z.zone_code)))
    const mfAlerts = mfDepartments.length > 0
      ? await fetchMeteoFranceAlertsForDepartments(mfDepartments)
      : []

    // Process NWS alerts
    for (const alert of nwsAlerts) {
      // Only process moderate severity or higher
      if (!['moderate', 'severe', 'extreme'].includes(alert.severity)) {
        continue
      }

      const existing = await getExistingAlert(alert.externalId)
      const change = detectAlertChange(existing, alert)

      // Upsert the alert
      const alertId = await upsertAlert(alert, 'nws')

      // Link to properties
      const propertyNames = await linkAlertToProperties(alertId, alert.zoneCode, 'nws')

      if (propertyNames.length === 0) continue

      // Send notifications for new or upgraded alerts
      if (change.type === 'new') {
        stats.newAlerts++

        // Only notify if not already notified (shouldn't happen for new, but safety check)
        if (!existing?.notified_at) {
          const notif = formatNotification(alert, propertyNames, 'nws')
          const priority = alert.severity === 'extreme' ? 1 : 0
          await notifyAll(notif.message, {
            title: notif.title,
            priority,
            url: notif.url,
            urlTitle: notif.urlTitle,
            sound: notif.sound,
          })
          await markAlertNotified(alertId)
          stats.notificationsSent++
        }
      } else if (change.type === 'upgraded') {
        stats.upgrades++

        // Notify about upgrade with dramatic intro
        const notif = formatNotification(alert, propertyNames, 'nws')
        await notifyAll(
          `🔺 UPGRADED: ${change.oldSeverity} → ${change.newSeverity}\n\n${notif.message}`,
          {
            title: `⬆️ ${notif.title}`,
            priority: 1,
            url: notif.url,
            urlTitle: notif.urlTitle,
            sound: 'siren',
          }
        )
        await markAlertStatusChangeNotified(alertId)
        stats.notificationsSent++
      }
    }

    // Process Météo-France alerts (same logic)
    for (const alert of mfAlerts) {
      if (!['moderate', 'severe', 'extreme'].includes(alert.severity)) {
        continue
      }

      const existing = await getExistingAlert(alert.externalId)
      const change = detectAlertChange(existing, alert)

      const alertId = await upsertAlert(alert, 'meteo_france')
      const propertyNames = await linkAlertToProperties(alertId, alert.zoneCode, 'meteo_france')

      if (propertyNames.length === 0) continue

      if (change.type === 'new') {
        stats.newAlerts++

        if (!existing?.notified_at) {
          const notif = formatNotification(alert, propertyNames, 'meteo_france')
          const priority = alert.severity === 'extreme' ? 1 : 0
          await notifyAll(notif.message, {
            title: notif.title,
            priority,
            url: notif.url,
            urlTitle: notif.urlTitle,
            sound: notif.sound,
          })
          await markAlertNotified(alertId)
          stats.notificationsSent++
        }
      } else if (change.type === 'upgraded') {
        stats.upgrades++

        const notif = formatNotification(alert, propertyNames, 'meteo_france')
        await notifyAll(
          `🔺 UPGRADED: ${change.oldSeverity} → ${change.newSeverity}\n\n${notif.message}`,
          {
            title: `⬆️ ${notif.title}`,
            priority: 1,
            url: notif.url,
            urlTitle: notif.urlTitle,
            sound: 'siren',
          }
        )
        await markAlertStatusChangeNotified(alertId)
        stats.notificationsSent++
      }
    }

    // Clean up old expired alerts
    stats.expired = await cleanupExpiredAlerts()

    console.log(`[Weather Sync] New: ${stats.newAlerts}, Upgrades: ${stats.upgrades}, Expired: ${stats.expired}, Notifications: ${stats.notificationsSent}`)
    return stats
  } catch (error) {
    console.error('[Weather Sync] Error:', error)
    throw error
  }
}

/**
 * Get active weather alerts for dashboard display.
 */
export async function getActiveWeatherAlerts(): Promise<Array<WeatherAlert & {
  property_names: string[]
  emoji: string
  label: string
}>> {
  const alerts = await query<WeatherAlert & { property_ids: string[]; property_names: string[] }>(`
    SELECT
      wa.*,
      ARRAY_AGG(DISTINCT p.id) as property_ids,
      ARRAY_AGG(DISTINCT p.name) as property_names
    FROM weather_alerts wa
    JOIN property_weather_alerts pwa ON wa.id = pwa.weather_alert_id
    JOIN properties p ON pwa.property_id = p.id
    WHERE wa.expires_at > NOW()
      AND wa.severity IN ('moderate', 'severe', 'extreme')
    GROUP BY wa.id
    ORDER BY
      CASE wa.severity
        WHEN 'extreme' THEN 1
        WHEN 'severe' THEN 2
        WHEN 'moderate' THEN 3
        ELSE 4
      END,
      wa.expires_at ASC
  `)

  return alerts.map((alert) => ({
    ...alert,
    emoji: alert.provider === 'nws'
      ? getAlertEmoji(alert.event_type)
      : getMeteoFranceAlertEmoji(alert.event_type),
    label: alert.provider === 'nws'
      ? getAlertLabel(alert.event_type)
      : getMeteoFranceAlertLabel(alert.event_type),
  }))
}

/**
 * Get weather alert for a specific property.
 */
export async function getPropertyWeatherAlerts(propertyId: string): Promise<Array<WeatherAlert & {
  emoji: string
  label: string
}>> {
  const alerts = await query<WeatherAlert>(`
    SELECT wa.*
    FROM weather_alerts wa
    JOIN property_weather_alerts pwa ON wa.id = pwa.weather_alert_id
    WHERE pwa.property_id = $1
      AND wa.expires_at > NOW()
      AND wa.severity IN ('moderate', 'severe', 'extreme')
    ORDER BY
      CASE wa.severity
        WHEN 'extreme' THEN 1
        WHEN 'severe' THEN 2
        WHEN 'moderate' THEN 3
        ELSE 4
      END
  `, [propertyId])

  return alerts.map((alert) => ({
    ...alert,
    emoji: alert.provider === 'nws'
      ? getAlertEmoji(alert.event_type)
      : getMeteoFranceAlertEmoji(alert.event_type),
    label: alert.provider === 'nws'
      ? getAlertLabel(alert.event_type)
      : getMeteoFranceAlertLabel(alert.event_type),
  }))
}
