import { getCalendarEvents } from "@/lib/actions"
import type { CalendarEvent } from "@/lib/actions"

// Helper to escape special characters in iCal text
function escapeICalText(text: string | null): string {
  if (!text) return ""
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

// Helper to format date as iCal date (YYYYMMDD for all-day events)
function formatICalDate(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

// Helper to format current timestamp for DTSTAMP
function formatICalTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

// Generate a unique stable UID for each event
function generateUID(event: CalendarEvent): string {
  return `${event.id}@spmsystem.com`
}

// Build description from event data
function buildDescription(event: CalendarEvent): string {
  const parts: string[] = []

  if (event.amount) {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(event.amount)
    parts.push(`Amount: ${formatted}`)
  }

  if (event.propertyName) {
    parts.push(`Property: ${event.propertyName}`)
  }

  if (event.vehicleName) {
    parts.push(`Vehicle: ${event.vehicleName}`)
  }

  if (event.vendorName) {
    parts.push(`Vendor: ${event.vendorName}`)
  }

  if (event.status) {
    parts.push(`Status: ${event.status}`)
  }

  if (event.isOverdue) {
    parts.push("OVERDUE")
  }

  return parts.join("\n")
}

// Map event type to category
function getEventCategory(type: string): string {
  switch (type) {
    case "bill":
      return "Bill"
    case "property_tax":
      return "Property Tax"
    case "insurance_renewal":
    case "insurance_expiration":
      return "Insurance"
    case "vehicle_registration":
    case "vehicle_inspection":
      return "Vehicle"
    case "maintenance":
      return "Maintenance"
    case "pin_note":
      return "Reminder"
    default:
      return "Payment"
  }
}

export async function GET(request: Request) {
  try {
    // Get events for the next 2 years (covers annual items)
    const now = new Date()
    const startDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().split("T")[0]
    const endDate = new Date(now.getFullYear() + 2, 11, 31).toISOString().split("T")[0]

    // Get base URL from request or use production URL
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    const events = await getCalendarEvents(startDate, endDate)

    // Build iCal content
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SPM System//Property Management Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SPM Property Management",
      "X-WR-TIMEZONE:America/New_York",
    ]

    for (const event of events) {
      const uid = generateUID(event)
      const dtstamp = formatICalTimestamp()
      const dtstart = formatICalDate(event.date)
      const summary = escapeICalText(event.title)
      const description = escapeICalText(buildDescription(event))
      const location = escapeICalText(event.description)
      const category = getEventCategory(event.type)

      lines.push("BEGIN:VEVENT")
      lines.push(`UID:${uid}`)
      lines.push(`DTSTAMP:${dtstamp}`)
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
      lines.push(`SUMMARY:${summary}`)

      if (description) {
        lines.push(`DESCRIPTION:${description}`)
      }

      if (location) {
        lines.push(`LOCATION:${location}`)
      }

      lines.push(`CATEGORIES:${category}`)

      // Add URL to link back to the item in SPM
      if (event.href) {
        lines.push(`URL:${baseUrl}${event.href}`)
      }

      // Add alarm for urgent items (1 day before)
      if (event.isUrgent || event.isOverdue) {
        lines.push("BEGIN:VALARM")
        lines.push("TRIGGER:-P1D")
        lines.push("ACTION:DISPLAY")
        lines.push(`DESCRIPTION:${summary} is due soon`)
        lines.push("END:VALARM")
      }

      lines.push("END:VEVENT")
    }

    lines.push("END:VCALENDAR")

    const icalContent = lines.join("\r\n")

    return new Response(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="spm-calendar.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Error generating calendar feed:", error)
    return new Response("Error generating calendar feed", { status: 500 })
  }
}
