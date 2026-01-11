"use server"

/**
 * Pushover notification utility for property management alerts.
 * Supports sending to multiple users (Anne and Todd).
 */

const PUSHOVER_API_URL = "https://api.pushover.net/1/messages.json"

interface PushoverResponse {
  status: number
  request: string
  errors?: string[]
}

interface NotifyOptions {
  title?: string
  priority?: -2 | -1 | 0 | 1 | 2
  url?: string
  urlTitle?: string
  sound?: string
}

/**
 * Send a Pushover notification to a specific user.
 */
async function sendToUser(
  userKey: string,
  message: string,
  options: NotifyOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.PUSHOVER_TOKEN
  if (!token) {
    return { success: false, error: "PUSHOVER_TOKEN not configured" }
  }
  if (!userKey) {
    return { success: false, error: "User key not provided" }
  }

  const body = new URLSearchParams({
    token,
    user: userKey,
    message,
    title: options.title || "Property Management",
    priority: String(options.priority ?? 0),
  })

  if (options.url) body.append("url", options.url)
  if (options.urlTitle) body.append("url_title", options.urlTitle)
  if (options.sound) body.append("sound", options.sound)

  try {
    const response = await fetch(PUSHOVER_API_URL, {
      method: "POST",
      body,
    })
    const result: PushoverResponse = await response.json()

    if (result.status === 1) {
      return { success: true }
    } else {
      return { success: false, error: result.errors?.join(", ") || "Unknown error" }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Send notification to Anne.
 */
export async function notifyAnne(
  message: string,
  options: NotifyOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const userKey = process.env.PUSHOVER_USER_ANNE
  if (!userKey) {
    console.warn("[Pushover] PUSHOVER_USER_ANNE not configured")
    return { success: false, error: "PUSHOVER_USER_ANNE not configured" }
  }
  return sendToUser(userKey, message, options)
}

/**
 * Send notification to Todd.
 */
export async function notifyTodd(
  message: string,
  options: NotifyOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const userKey = process.env.PUSHOVER_USER_TODD
  if (!userKey) {
    console.warn("[Pushover] PUSHOVER_USER_TODD not configured")
    return { success: false, error: "PUSHOVER_USER_TODD not configured" }
  }
  return sendToUser(userKey, message, options)
}

/**
 * Send notification to Amelia.
 */
export async function notifyAmelia(
  message: string,
  options: NotifyOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const userKey = process.env.PUSHOVER_USER_AMELIA
  if (!userKey) {
    console.warn("[Pushover] PUSHOVER_USER_AMELIA not configured")
    return { success: false, error: "PUSHOVER_USER_AMELIA not configured" }
  }
  return sendToUser(userKey, message, options)
}

/**
 * Send notification to Anne, Todd, and Amelia.
 */
export async function notifyAll(
  message: string,
  options: NotifyOptions = {}
): Promise<{ anne: boolean; todd: boolean; amelia: boolean; errors: string[] }> {
  const results = await Promise.all([
    notifyAnne(message, options),
    notifyTodd(message, options),
    notifyAmelia(message, options),
  ])

  const errors: string[] = []
  if (!results[0].success && results[0].error) errors.push(`Anne: ${results[0].error}`)
  if (!results[1].success && results[1].error) errors.push(`Todd: ${results[1].error}`)
  if (!results[2].success && results[2].error) errors.push(`Amelia: ${results[2].error}`)

  return {
    anne: results[0].success,
    todd: results[1].success,
    amelia: results[2].success,
    errors,
  }
}

/**
 * Send urgent notification (high priority with persistent alert).
 */
export async function notifyUrgent(
  message: string,
  title: string = "URGENT"
): Promise<{ anne: boolean; todd: boolean; amelia: boolean; errors: string[] }> {
  return notifyAll(message, { title, priority: 1, sound: "siren" })
}
