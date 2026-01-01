"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getWeekDays, isSameDateStr } from "@/lib/calendar-utils"
import { EventCard } from "./event-card"
import type { CalendarEvent } from "@/lib/actions"
import { format } from "date-fns"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  selectedDate: string | null
  onDateSelect: (dateStr: string) => void
}

export function WeekView({
  currentDate,
  events,
  selectedDate,
  onDateSelect,
}: WeekViewProps) {
  const days = useMemo(() => getWeekDays(currentDate), [currentDate])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      if (!map[event.date]) {
        map[event.date] = []
      }
      map[event.date].push(event)
    }
    return map
  }, [events])

  return (
    <div className="overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {days.map((day) => (
          <div
            key={day.dateStr}
            className={cn(
              "px-2 py-3 text-center border-r last:border-r-0",
              day.isToday && "bg-primary/5"
            )}
          >
            <div className="text-sm font-medium text-muted-foreground">
              {format(day.date, "EEE")}
            </div>
            <div
              className={cn(
                "text-2xl font-semibold mt-1",
                day.isToday && "text-primary"
              )}
            >
              {format(day.date, "d")}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(day.date, "MMM")}
            </div>
          </div>
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-7 min-h-[500px]">
        {days.map((day) => {
          const dayEvents = eventsByDate[day.dateStr] || []
          const isSelected = selectedDate === day.dateStr

          return (
            <div
              key={day.dateStr}
              className={cn(
                "border-r last:border-r-0 p-2 cursor-pointer transition-colors",
                day.isWeekend && "bg-muted/10",
                day.isToday && "bg-primary/5",
                isSelected && "ring-2 ring-primary ring-inset",
                "hover:bg-muted/20"
              )}
              onClick={() => onDateSelect(day.dateStr)}
            >
              <div className="space-y-2">
                {dayEvents.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No events
                  </div>
                )}
                {dayEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
