"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
} from "lucide-react"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"
import { CalendarLegend } from "./calendar-legend"
import type { CalendarEvent } from "@/lib/actions"
import {
  CalendarViewType,
  navigateDate,
  formatDateHeader,
  getMonthRange,
  getWeekRange,
  getDayRange,
} from "@/lib/calendar-utils"
import { format, setMonth, setYear } from "date-fns"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

// Generate years from 2020 to 5 years in future
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 2020 + 6 }, (_, i) => 2020 + i)

interface CalendarViewProps {
  initialEvents?: CalendarEvent[]
}

export function CalendarView({ initialEvents = [] }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarViewType>("month")
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      let range: { start: string; end: string }
      switch (view) {
        case "month":
          range = getMonthRange(currentDate)
          break
        case "week":
          range = getWeekRange(currentDate)
          break
        case "day":
          range = getDayRange(currentDate)
          break
      }

      const response = await fetch(
        `/api/calendar/events?start=${range.start}&end=${range.end}`
      )
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error("Failed to fetch calendar events:", error)
    } finally {
      setIsLoading(false)
    }
  }, [currentDate, view])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleNavigate = (direction: "prev" | "next") => {
    setCurrentDate(navigateDate(currentDate, direction, view))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr)
    // If in month view and clicking a date, optionally switch to day view
    // setView("day")
    // setCurrentDate(parseISO(dateStr))
  }

  const handleViewChange = (newView: CalendarViewType) => {
    setView(newView)
  }

  const handleMonthChange = (monthIndex: string) => {
    setCurrentDate(setMonth(currentDate, parseInt(monthIndex)))
  }

  const handleYearChange = (year: string) => {
    setCurrentDate(setYear(currentDate, parseInt(year)))
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigate("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigate("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>

          {/* Month Selector */}
          <Select
            value={currentDate.getMonth().toString()}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, idx) => (
                <SelectItem key={month} value={idx.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Selector */}
          <Select
            value={currentDate.getFullYear().toString()}
            onValueChange={handleYearChange}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <CalendarLegend />
          <Select value={view} onValueChange={(v) => handleViewChange(v as CalendarViewType)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Content */}
      <Card>
        <CardContent className="p-0">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
