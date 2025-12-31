"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Key, ChevronDown, ChevronUp, LogIn, LogOut } from "lucide-react"
import { format, isToday, isYesterday, startOfDay } from "date-fns"
import type { BuildingLinkMessage } from "@/lib/actions"

interface SecurityLogProps {
  messages: BuildingLinkMessage[]
}

interface ParsedKeyEvent {
  id: string
  type: 'removed' | 'returned'
  unit: string
  person: string
  reason: string
  timestamp: Date
  raw: BuildingLinkMessage
}

function parseKeyEvent(msg: BuildingLinkMessage): ParsedKeyEvent | null {
  const subject = msg.subject.toLowerCase()
  const body = msg.body_snippet || ''

  const type = subject.includes('removed') ? 'removed' : subject.includes('returned') ? 'returned' : null
  if (!type) return null

  // Extract person name (after "Key Given to:" or "by")
  let person = 'Unknown'
  const givenToMatch = body.match(/Key Given to:\s*([^\n]+)/i)
  const byMatch = body.match(/by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i)
  if (givenToMatch) {
    person = givenToMatch[1].trim()
  } else if (byMatch) {
    person = byMatch[1].trim()
  }

  // Extract reason
  let reason = ''
  const reasonMatch = body.match(/Reason:\s*([^\n]+)/i)
  if (reasonMatch) {
    reason = reasonMatch[1].trim()
  }

  // Extract unit
  let unit = msg.unit
  if (unit === 'unknown') {
    if (body.includes('NPH2-E') || body.includes('PH2-E')) unit = 'PH2E'
    else if (body.includes('NPH2-F') || body.includes('PH2-F')) unit = 'PH2F'
  }

  return {
    id: msg.id,
    type,
    unit: unit === 'both' ? 'Both' : unit === 'unknown' ? '?' : unit,
    person,
    reason,
    timestamp: new Date(msg.received_at),
    raw: msg,
  }
}

function groupByDate(events: ParsedKeyEvent[]): Map<string, ParsedKeyEvent[]> {
  const groups = new Map<string, ParsedKeyEvent[]>()

  for (const event of events) {
    const dateKey = startOfDay(event.timestamp).toISOString()
    const existing = groups.get(dateKey) || []
    existing.push(event)
    groups.set(dateKey, existing)
  }

  return groups
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMMM d')
}

export function SecurityLog({ messages }: SecurityLogProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // Parse and filter key events
  const keyEvents = messages
    .map(parseKeyEvent)
    .filter((e): e is ParsedKeyEvent => e !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  const displayEvents = showAll ? keyEvents : keyEvents.slice(0, 20)
  const groupedEvents = groupByDate(displayEvents)

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-green-500" />
            Security Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{keyEvents.length}</Badge>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Key access events for both units
        </p>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          {keyEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No key access events
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedEvents.entries()).map(([dateStr, events]) => (
                <div key={dateStr}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {formatDateHeader(dateStr)}
                  </p>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/30"
                      >
                        {event.type === 'removed' ? (
                          <LogOut className="h-4 w-4 text-orange-500 mt-0.5" />
                        ) : (
                          <LogIn className="h-4 w-4 text-green-500 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{event.person}</span>
                            <Badge variant="outline" className="text-xs">
                              {event.unit}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {event.type === 'removed' ? 'Key out' : 'Key returned'}
                            </span>
                            {event.reason && (
                              <>
                                <span>•</span>
                                <span>{event.reason}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{format(event.timestamp, 'h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!showAll && keyEvents.length > 20 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAll(true)}
                >
                  Show all {keyEvents.length} events
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
