export const dynamic = 'force-dynamic'

import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarView } from "@/components/calendar/calendar-view"
import { getCalendarEvents } from "@/lib/actions"
import { getMonthRange } from "@/lib/calendar-utils"

async function CalendarContent() {
  // Get initial events for current month
  const today = new Date()
  const { start, end } = getMonthRange(today)
  const events = await getCalendarEvents(start, end)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-lg text-muted-foreground mt-1">
          View all payments, taxes, insurance, and maintenance on a calendar
        </p>
      </div>

      <CalendarView initialEvents={events} />
    </div>
  )
}

function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-80 mt-2" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 m-2" />
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[120px] border-b border-r p-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="space-y-1 mt-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarContent />
    </Suspense>
  )
}
