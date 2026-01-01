"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { EventCard } from "./event-card"
import type { CalendarEvent, CalendarEventType } from "@/lib/actions"
import { format, isToday } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import {
  CreditCard,
  Building2,
  Shield,
  Car,
  Wrench,
  AlertTriangle,
} from "lucide-react"

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
}

const eventTypeLabels: Record<CalendarEventType, string> = {
  bill: "Bills & Payments",
  property_tax: "Property Taxes",
  insurance_renewal: "Insurance Renewals",
  insurance_expiration: "Insurance Expirations",
  vehicle_registration: "Vehicle Registrations",
  vehicle_inspection: "Vehicle Inspections",
  maintenance: "Maintenance Tasks",
}

const eventTypeIcons: Record<CalendarEventType, React.ElementType> = {
  bill: CreditCard,
  property_tax: Building2,
  insurance_renewal: Shield,
  insurance_expiration: Shield,
  vehicle_registration: Car,
  vehicle_inspection: Car,
  maintenance: Wrench,
}

export function DayView({ currentDate, events }: DayViewProps) {
  const isCurrentDay = isToday(currentDate)

  // Group events by type
  const eventsByType = useMemo(() => {
    const groups: Record<CalendarEventType, CalendarEvent[]> = {
      bill: [],
      property_tax: [],
      insurance_renewal: [],
      insurance_expiration: [],
      vehicle_registration: [],
      vehicle_inspection: [],
      maintenance: [],
    }

    for (const event of events) {
      groups[event.type].push(event)
    }

    return groups
  }, [events])

  // Calculate totals
  const totalAmount = events.reduce(
    (sum, event) => sum + (event.amount || 0),
    0
  )
  const overdueCount = events.filter((e) => e.isOverdue).length
  const urgentCount = events.filter((e) => e.isUrgent && !e.isOverdue).length

  const typesWithEvents = Object.entries(eventsByType).filter(
    ([_, evts]) => evts.length > 0
  ) as [CalendarEventType, CalendarEvent[]][]

  return (
    <div className="p-6">
      {/* Day Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "text-5xl font-bold",
              isCurrentDay && "text-primary"
            )}
          >
            {format(currentDate, "d")}
          </div>
          <div>
            <div className="text-lg font-medium">
              {format(currentDate, "EEEE")}
            </div>
            <div className="text-muted-foreground">
              {format(currentDate, "MMMM yyyy")}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {events.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <span className="text-2xl font-semibold">{events.length}</span>
              <span className="text-muted-foreground ml-2">
                event{events.length !== 1 ? "s" : ""}
              </span>
            </div>
            {totalAmount > 0 && (
              <div className="border-l pl-4">
                <span className="text-2xl font-semibold">
                  {formatCurrency(totalAmount)}
                </span>
                <span className="text-muted-foreground ml-2">total</span>
              </div>
            )}
            {overdueCount > 0 && (
              <div className="border-l pl-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-semibold text-red-600">
                  {overdueCount}
                </span>
                <span className="text-muted-foreground">overdue</span>
              </div>
            )}
            {urgentCount > 0 && (
              <div className="border-l pl-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-semibold text-orange-600">
                  {urgentCount}
                </span>
                <span className="text-muted-foreground">urgent</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Events by Type */}
      {events.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg">
            No events scheduled for this day
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {typesWithEvents.map(([type, typeEvents]) => {
            const Icon = eventTypeIcons[type]
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">{eventTypeLabels[type]}</h3>
                  <span className="text-sm text-muted-foreground">
                    ({typeEvents.length})
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {typeEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
