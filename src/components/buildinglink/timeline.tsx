"use client"

import { useState } from "react"
import { startOfDay, isToday, isYesterday, format } from "date-fns"
import type { BuildingLinkMessage } from "@/lib/actions"
import { MessageRow } from "./message-row"
import { Button } from "@/components/ui/button"

interface TimelineProps {
  messages: BuildingLinkMessage[]
  onFlag: (messageId: string) => Promise<void>
  initialLimit?: number
}

function formatDateHeader(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMMM d')
}

function groupByDate(messages: BuildingLinkMessage[]): Map<string, BuildingLinkMessage[]> {
  const groups = new Map<string, BuildingLinkMessage[]>()

  for (const msg of messages) {
    const dateKey = startOfDay(new Date(msg.received_at)).toISOString()
    const existing = groups.get(dateKey) || []
    existing.push(msg)
    groups.set(dateKey, existing)
  }

  return groups
}

export function Timeline({ messages, onFlag, initialLimit = 50 }: TimelineProps) {
  const [showAll, setShowAll] = useState(false)

  const displayMessages = showAll ? messages : messages.slice(0, initialLimit)
  const groupedMessages = groupByDate(displayMessages)

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No messages found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Array.from(groupedMessages.entries()).map(([dateStr, dayMessages]) => (
        <div key={dateStr}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sticky top-0 bg-background py-1">
            {formatDateHeader(new Date(dateStr))}
          </h3>
          <div className="space-y-1">
            {dayMessages.map((msg) => (
              <MessageRow
                key={msg.id}
                message={msg}
                onFlag={onFlag}
              />
            ))}
          </div>
        </div>
      ))}

      {!showAll && messages.length > initialLimit && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
          >
            Show all {messages.length} messages
          </Button>
        </div>
      )}
    </div>
  )
}
