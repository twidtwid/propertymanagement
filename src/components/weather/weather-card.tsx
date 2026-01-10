"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Cloud, RefreshCw, ChevronDown } from "lucide-react"
import type { WeatherCondition } from "@/lib/weather"

const STORAGE_KEY = "weather-card-collapsed"

// Location abbreviations for collapsed view
const LOCATION_ABBREV: Record<string, string> = {
  ri: "RI",
  nyc: "BKLYN",
  vt: "VT",
  paris: "PAR",
  martinique: "MAR",
}

// Weather alert info (would come from API in production)
interface WeatherAlert {
  event: string
  severity: "minor" | "moderate" | "severe" | "extreme"
  headline: string
  expires: string
}

const ALERT_INFO: Record<string, WeatherAlert> = {
  vt: {
    event: "Winter Weather Advisory",
    severity: "moderate",
    headline: "Snow accumulations of 2-4 inches expected",
    expires: "Sun 7:00 PM",
  },
}

// Locations with active weather alerts
const ALERT_LOCATIONS = new Set(Object.keys(ALERT_INFO))

interface WeatherCardProps {
  initialData?: WeatherCondition[]
}

interface WeatherResponse {
  data: WeatherCondition[]
  cached: boolean
  cachedAt: string
  expiresIn: number
}

// Alert badge - hover on desktop, tap on iOS/touch devices
function AlertBadge({ location, children }: { location: string; children: React.ReactNode }) {
  const alert = ALERT_INFO[location]
  if (!alert) return <>{children}</>

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="cursor-help" onClick={(e) => e.stopPropagation()}>
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <p className="font-medium text-orange-600">{alert.event}</p>
          <p className="text-sm text-slate-600 mt-1">{alert.headline}</p>
          <p className="text-xs text-slate-400 mt-2">Expires: {alert.expires}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function WeatherCard({ initialData }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherCondition[]>(initialData || [])
  const [loading, setLoading] = useState(!initialData)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    setMounted(true)
    // Load collapsed state from localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true") {
      setIsOpen(false)
    }

    // Update time every minute for the time display
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    localStorage.setItem(STORAGE_KEY, open ? "false" : "true")
  }

  useEffect(() => {
    if (!initialData) {
      fetchWeather()
    }
  }, [initialData])

  const fetchWeather = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/weather/conditions")
      if (response.ok) {
        const data: WeatherResponse = await response.json()
        setWeather(data.data)
        setLastUpdated(new Date(data.cachedAt))
      }
    } catch (error) {
      console.error("Failed to fetch weather:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && weather.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading weather...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (weather.length === 0) {
    return null
  }

  // Format time for "Updated X ago" - only after mount to avoid hydration mismatch
  const formatLastUpdated = () => {
    if (!mounted || !lastUpdated) return ""
    const mins = Math.round((Date.now() - lastUpdated.getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins === 1) return "1 min ago"
    if (mins < 60) return `${mins} min ago`
    return lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <Card className="overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 border-sky-200/50">
        <CardContent className="p-0">
          {/* Header - clickable to collapse */}
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-4 pt-3 pb-2 cursor-pointer hover:bg-sky-100/50 transition-colors gap-2">
              <div className="flex items-center gap-2 text-sky-700 min-w-0 flex-1">
                <Cloud className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium flex-shrink-0">Weather</span>
                  {!isOpen && weather.length > 0 && mounted && (
                    <span className="text-xs text-sky-600/70 ml-1 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 min-w-0">
                      {weather.map((w, i) => {
                        const abbrev = LOCATION_ABBREV[w.location] || w.location
                        const hasAlert = ALERT_LOCATIONS.has(w.location)
                        // Show local time for non-US locations
                        const showTime = w.location === "paris" || w.location === "martinique"
                        const localTime = showTime ? getLocalTimeInfo(w.timezone).time.replace(":00", "").toLowerCase() : ""

                        const locationContent = (
                          <span className="inline-flex items-center">
                            {hasAlert && <span className="text-[10px]">⚠️</span>}
                            <span className={hasAlert ? "text-red-500 font-medium" : ""}>{abbrev}</span>
                            <span>{w.emoji}</span>
                            <span className="text-slate-500 ml-0.5">{w.tempF}°F</span>
                            {showTime && <span className="text-slate-400 ml-0.5 text-[10px]">{localTime}</span>}
                          </span>
                        )

                        return (
                          <span key={w.location} className="inline-flex items-center">
                            {hasAlert ? <AlertBadge location={w.location}>{locationContent}</AlertBadge> : locationContent}
                            {i < weather.length - 1 && <span className="mx-1 text-sky-300">·</span>}
                          </span>
                        )
                      })}
                    </span>
                  )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {mounted && lastUpdated && (
                  <span className="text-xs text-sky-600/70 hidden sm:block" suppressHydrationWarning>
                    {formatLastUpdated()}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-sky-600/70 transition-transform duration-200 ${
                    isOpen ? "" : "-rotate-90"
                  }`}
                />
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Weather grid - responsive */}
          <CollapsibleContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-sky-200/30">
              {weather.map((w) => (
                <WeatherItem key={w.location} data={w} currentTime={currentTime} mounted={mounted} hasAlert={ALERT_LOCATIONS.has(w.location)} />
              ))}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  )
}

// Get moon phase emoji based on current date
function getMoonPhase(): string {
  const date = new Date()

  // Simple lunar phase calculation (synodic month = 29.53 days)
  // Reference: Jan 6, 2000 was a new moon
  const refDate = new Date(2000, 0, 6)
  const daysSinceRef = Math.floor((date.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24))
  const lunarAge = daysSinceRef % 29.53

  // Moon phase emojis
  if (lunarAge < 1.85) return "🌑" // New moon
  if (lunarAge < 5.53) return "🌒" // Waxing crescent
  if (lunarAge < 9.22) return "🌓" // First quarter
  if (lunarAge < 12.91) return "🌔" // Waxing gibbous
  if (lunarAge < 16.61) return "🌕" // Full moon
  if (lunarAge < 20.30) return "🌖" // Waning gibbous
  if (lunarAge < 23.99) return "🌗" // Last quarter
  if (lunarAge < 27.68) return "🌘" // Waning crescent
  return "🌑" // New moon
}

// Get local time info for a timezone
function getLocalTimeInfo(timezone: string): { time: string; dayTime: string; hour: number; isNight: boolean } {
  try {
    const now = new Date()
    const dayOfWeek = now.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "short",
    })
    const localTime = now.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    const hour = parseInt(
      now.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }),
      10
    )
    // Night is roughly 7pm to 6am
    const isNight = hour >= 19 || hour < 6

    return { time: localTime, dayTime: `${dayOfWeek} ${localTime}`, hour, isNight }
  } catch {
    return { time: "", dayTime: "", hour: 12, isNight: false }
  }
}

function WeatherItem({ data, currentTime, mounted, hasAlert }: { data: WeatherCondition; currentTime: Date; mounted: boolean; hasAlert: boolean }) {
  const temp = data.useFahrenheit ? data.tempF : data.tempC
  const high = data.useFahrenheit ? data.highF : data.highC
  const low = data.useFahrenheit ? data.lowF : data.lowC
  const unit = data.useFahrenheit ? "F" : "C"

  // Only calculate time on client to avoid hydration mismatch
  const timeInfo = mounted ? getLocalTimeInfo(data.timezone) : { time: "", dayTime: "", hour: 12, isNight: false }
  const moonPhase = getMoonPhase()

  // Simple consistent background - emoji conveys weather
  const bgColor = "bg-sky-50/60"

  const content = (
    <>
      {/* Location + Time */}
      <div className="flex flex-col items-center">
        <span className={`text-xs font-medium truncate max-w-full flex items-center gap-1 ${hasAlert ? "text-red-600" : "text-slate-600"}`}>
          {hasAlert && <span>⚠️</span>}
          {data.displayName}
        </span>
        {mounted && (
          <span className="text-[10px] text-slate-400">
            {timeInfo.dayTime} {timeInfo.isNight && moonPhase}
          </span>
        )}
      </div>

      {/* Emoji + Temp */}
      <div className="flex flex-col items-center py-1">
        <span className="text-2xl leading-none">{data.emoji}</span>
        <span className="text-xl font-semibold text-slate-800 mt-1">
          {temp}°{unit}
        </span>
      </div>

      {/* High/Low + Description */}
      <div className="space-y-0.5">
        <div className="text-xs text-slate-500">
          <span className="text-slate-600">H:{high}°</span>
          <span className="mx-1 text-slate-400">/</span>
          <span className="text-slate-500">L:{low}°</span>
        </div>
        <div className="text-xs text-slate-500 truncate max-w-[100px]">
          {data.description}
        </div>
      </div>
    </>
  )

  // Wrap entire item in AlertBadge if there's an alert
  return (
    <div className={`p-3 ${bgColor} flex flex-col items-center text-center min-h-[100px] justify-between ${hasAlert ? "cursor-help" : ""}`}>
      {hasAlert ? (
        <AlertBadge location={data.location}>
          <div className="flex flex-col items-center justify-between h-full w-full">
            {content}
          </div>
        </AlertBadge>
      ) : (
        content
      )}
    </div>
  )
}
