"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getMonthDays, WEEKDAY_NAMES, isSameDateStr } from "@/lib/calendar-utils"
import { EventCard, EventDot } from "./event-card"
import type { CalendarEvent } from "@/lib/actions"
import { format } from "date-fns"

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  selectedDate: string | null
  onDateSelect: (dateStr: string) => void
}

export function MonthView({
  currentDate,
  events,
  selectedDate,
  onDateSelect,
}: MonthViewProps) {
  const days = useMemo(() => getMonthDays(currentDate), [currentDate])

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
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAY_NAMES.map((day) => (
          <div
            key={day}
            className="px-2 py-3 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = eventsByDate[day.dateStr] || []
          const hasEvents = dayEvents.length > 0
          const isSelected = selectedDate === day.dateStr
          const hasOverdue = dayEvents.some((e) => e.isOverdue)
          const hasUrgent = dayEvents.some((e) => e.isUrgent && !e.isOverdue)

          return (
            <div
              key={day.dateStr}
              className={cn(
                "min-h-[120px] border-b border-r p-1 transition-colors cursor-pointer",
                !day.isCurrentMonth && "bg-muted/20",
                day.isWeekend && day.isCurrentMonth && "bg-muted/10",
                isSelected && "bg-primary/5 ring-2 ring-primary ring-inset",
                idx % 7 === 0 && "border-l",
                "hover:bg-muted/30"
              )}
              onClick={() => onDateSelect(day.dateStr)}
            >
              {/* Date Number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                    day.isToday &&
                      "bg-primary text-primary-foreground font-semibold",
                    !day.isCurrentMonth && "text-muted-foreground",
                    hasOverdue &&
                      !day.isToday &&
                      "ring-2 ring-red-400 ring-offset-1",
                    hasUrgent &&
                      !hasOverdue &&
                      !day.isToday &&
                      "ring-1 ring-orange-300"
                  )}
                >
                  {format(day.date, "d")}
                </span>
                {hasEvents && (
                  <div className="flex gap-0.5">
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <EventDot key={i} type={event.type} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventCard key={event.id} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
