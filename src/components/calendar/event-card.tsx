"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  CreditCard,
  Building2,
  Shield,
  Car,
  Wrench,
  DollarSign,
  MapPin,
  User,
  ExternalLink,
  StickyNote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalendarEvent, CalendarEventType } from "@/lib/actions"
import { formatCurrency } from "@/lib/utils"

interface EventCardProps {
  event: CalendarEvent
  compact?: boolean
}

const eventTypeConfig: Record<
  CalendarEventType,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  bill: {
    icon: CreditCard,
    color: "text-blue-700",
    bgColor: "bg-blue-100 hover:bg-blue-200 border-blue-200",
    label: "Bill",
  },
  property_tax: {
    icon: Building2,
    color: "text-purple-700",
    bgColor: "bg-purple-100 hover:bg-purple-200 border-purple-200",
    label: "Property Tax",
  },
  insurance_renewal: {
    icon: Shield,
    color: "text-green-700",
    bgColor: "bg-green-100 hover:bg-green-200 border-green-200",
    label: "Insurance Renewal",
  },
  insurance_expiration: {
    icon: Shield,
    color: "text-orange-700",
    bgColor: "bg-orange-100 hover:bg-orange-200 border-orange-200",
    label: "Insurance Expiration",
  },
  vehicle_registration: {
    icon: Car,
    color: "text-cyan-700",
    bgColor: "bg-cyan-100 hover:bg-cyan-200 border-cyan-200",
    label: "Vehicle Registration",
  },
  vehicle_inspection: {
    icon: Car,
    color: "text-teal-700",
    bgColor: "bg-teal-100 hover:bg-teal-200 border-teal-200",
    label: "Vehicle Inspection",
  },
  maintenance: {
    icon: Wrench,
    color: "text-amber-700",
    bgColor: "bg-amber-100 hover:bg-amber-200 border-amber-200",
    label: "Maintenance",
  },
  pin_note: {
    icon: StickyNote,
    color: "text-yellow-700",
    bgColor: "bg-yellow-100 hover:bg-yellow-200 border-yellow-200",
    label: "Note",
  },
}

export function EventCard({ event, compact = false }: EventCardProps) {
  const config = eventTypeConfig[event.type]
  const Icon = config.icon

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full text-left text-xs px-1.5 py-0.5 rounded truncate border transition-colors",
              config.bgColor,
              config.color,
              event.isOverdue && "ring-2 ring-red-400",
              event.isUrgent && !event.isOverdue && "ring-1 ring-orange-300"
            )}
          >
            <span className="font-medium truncate">{event.title}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <EventPopoverContent event={event} config={config} />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full text-left p-2 rounded-lg border transition-colors",
            config.bgColor,
            event.isOverdue && "ring-2 ring-red-400",
            event.isUrgent && !event.isOverdue && "ring-1 ring-orange-300"
          )}
        >
          <div className="flex items-start gap-2">
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium text-sm truncate", config.color)}>
                {event.title}
              </p>
              {event.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {event.description}
                </p>
              )}
              {event.amount && (
                <p className="text-xs font-medium mt-1">
                  {formatCurrency(Number(event.amount))}
                </p>
              )}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <EventPopoverContent event={event} config={config} />
      </PopoverContent>
    </Popover>
  )
}

interface EventPopoverContentProps {
  event: CalendarEvent
  config: { icon: React.ElementType; color: string; label: string }
}

function EventPopoverContent({ event, config }: EventPopoverContentProps) {
  const Icon = config.icon

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            eventTypeConfig[event.type].bgColor.split(" ")[0]
          )}
        >
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold">{event.title}</h4>
          <p className="text-sm text-muted-foreground">{config.label}</p>
        </div>
      </div>

      {event.description && (
        <div className="text-sm border-l-2 border-muted pl-3 py-1">
          <p className="text-foreground">{event.description}</p>
        </div>
      )}

      <div className="space-y-2 text-sm">
        {event.propertyName && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{event.propertyName}</span>
          </div>
        )}
        {event.vehicleName && (
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span>{event.vehicleName}</span>
          </div>
        )}
        {event.vendorName && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{event.vendorName}</span>
          </div>
        )}
        {event.amount && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatCurrency(Number(event.amount))}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {event.status && (
          <Badge
            variant={
              event.isOverdue
                ? "destructive"
                : event.status === "confirmed"
                ? "default"
                : "secondary"
            }
          >
            {event.isOverdue ? "Overdue" : event.status}
          </Badge>
        )}
        {event.isUrgent && !event.isOverdue && (
          <Badge variant="warning">Urgent</Badge>
        )}
      </div>

      {event.href && (
        <Link
          href={event.href}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View details
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

export function EventDot({ type }: { type: CalendarEventType }) {
  const config = eventTypeConfig[type]
  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full",
        config.bgColor.split(" ")[0].replace("bg-", "bg-")
      )}
      style={{
        backgroundColor:
          type === "bill"
            ? "#3b82f6"
            : type === "property_tax"
            ? "#8b5cf6"
            : type === "insurance_expiration"
            ? "#f97316"
            : type === "vehicle_registration"
            ? "#06b6d4"
            : type === "vehicle_inspection"
            ? "#14b8a6"
            : type === "maintenance"
            ? "#f59e0b"
            : type === "pin_note"
            ? "#eab308"
            : "#6b7280",
      }}
    />
  )
}
