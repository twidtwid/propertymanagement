"use client"

import { formatDateTime } from "@/lib/utils"
import { Circle } from "lucide-react"
import type { TicketActivity } from "@/types/database"

interface TicketActivityListProps {
  activities: TicketActivity[]
}

function formatActivityMessage(activity: TicketActivity): string {
  const details = activity.details

  switch (activity.action) {
    case "created":
      return `Ticket created by ${activity.user_name}`
    case "status_changed":
      if (details?.from && details?.to) {
        const fromLabel = details.from === "pending" ? "Open" : details.from === "in_progress" ? "In Progress" : details.from
        const toLabel = details.to === "pending" ? "Open" : details.to === "in_progress" ? "In Progress" : details.to
        return `Status changed from ${fromLabel} to ${toLabel}`
      }
      return "Status updated"
    case "assigned":
      if (details?.vendor) {
        return `Assigned to ${details.vendor}`
      }
      return "Vendor assigned"
    case "updated":
      if (details?.field === "priority") {
        return `Priority changed to ${details.to}`
      }
      if (details?.field === "title") {
        return `Title updated`
      }
      return `${activity.user_name} updated the ticket`
    case "closed":
      if (details?.resolution) {
        const preview = String(details.resolution).length > 50
          ? String(details.resolution).substring(0, 50) + "..."
          : details.resolution
        return `Closed by ${activity.user_name}: ${preview}`
      }
      return `Closed by ${activity.user_name}`
    default:
      return `Action: ${activity.action}`
  }
}

export function TicketActivityList({ activities }: TicketActivityListProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No activity recorded yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Circle className="h-2 w-2 fill-current text-muted-foreground" />
            {index < activities.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1" />
            )}
          </div>
          <div className="flex-1 pb-3">
            <p className="text-sm">{formatActivityMessage(activity)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(activity.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
