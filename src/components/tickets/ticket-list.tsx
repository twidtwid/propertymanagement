"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Circle,
} from "lucide-react"
import { TASK_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/types/database"
import type { TicketWithDetails } from "@/lib/actions"
import { PinButton } from "@/components/ui/pin-button"

interface TicketListProps {
  tickets: TicketWithDetails[]
  pinnedIds: Set<string>
  onTogglePin?: (ticketId: string, isPinned: boolean) => void
}

function getPriorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "urgent":
      return "destructive"
    case "high":
      return "default"
    case "medium":
      return "secondary"
    default:
      return "outline"
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "in_progress":
      return <Clock className="h-4 w-4 text-blue-500" />
    case "completed":
    case "cancelled":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    default:
      return <Circle className="h-4 w-4 text-gray-400" />
  }
}

export function TicketRowSimple({ ticket, pinnedIds, onTogglePin }: { ticket: TicketWithDetails; pinnedIds: Set<string>; onTogglePin?: (id: string, isPinned: boolean) => void }) {
  const locationName = ticket.property_name || ticket.vehicle_name || "Unassigned"
  const assigneeName = ticket.vendor_contact_name
    ? `${ticket.vendor_name} (${ticket.vendor_contact_name})`
    : ticket.vendor_name || "Unassigned"

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      <PinButton
        entityType="ticket"
        entityId={ticket.id}
        isPinned={pinnedIds.has(ticket.id)}
        onToggle={onTogglePin ? (isPinned) => onTogglePin(ticket.id, isPinned) : undefined}
        size="sm"
        variant="ghost"
        className="shrink-0"
        metadata={{
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
        }}
      />
      <Link href={`/tickets/${ticket.id}`} className="flex items-start gap-3 flex-1 min-w-0">
        {getStatusIcon(ticket.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{ticket.title}</p>
            <Badge variant={getPriorityVariant(ticket.priority)} className="text-xs">
              {TASK_PRIORITY_LABELS[ticket.priority]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span>{locationName}</span>
            <span>·</span>
            <span>{assigneeName}</span>
          </div>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {TICKET_STATUS_LABELS[ticket.status]}
        </Badge>
      </Link>
    </div>
  )
}

interface TicketSectionProps {
  title: string
  tickets: TicketWithDetails[]
  icon: React.ReactNode
  variant: "urgent" | "open" | "progress" | "closed"
  defaultExpanded?: boolean
  pinnedIds: Set<string>
  onTogglePin: (id: string, isPinned: boolean) => void
}

function TicketSection({ title, tickets, icon, variant, defaultExpanded = true, pinnedIds, onTogglePin }: TicketSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (tickets.length === 0) return null

  const bgClasses = {
    urgent: "border-red-200 bg-red-50/50 dark:bg-red-950/10",
    open: "",
    progress: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10",
    closed: "border-gray-200 bg-gray-50/50 dark:bg-gray-900/10",
  }

  const headerClasses = {
    urgent: "text-red-700 dark:text-red-400",
    open: "text-foreground",
    progress: "text-blue-700 dark:text-blue-400",
    closed: "text-gray-600 dark:text-gray-400",
  }

  return (
    <Card className={bgClasses[variant]}>
      <CardHeader className="pb-2">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className={`text-sm font-medium flex items-center gap-2 ${headerClasses[variant]}`}>
            {icon}
            {title}
            <Badge variant="secondary" className="ml-1">
              {tickets.length}
            </Badge>
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <TicketRowSimple key={ticket.id} ticket={ticket} pinnedIds={pinnedIds} onTogglePin={onTogglePin} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function TicketList({ tickets, pinnedIds, onTogglePin }: TicketListProps) {
  // No internal state - controlled by parent component

  // Group tickets by status (no separate urgent section - Smart Pins handles that)
  const openTickets = tickets.filter((t) => t.status === "pending")
  const inProgressTickets = tickets.filter((t) => t.status === "in_progress")
  const closedTickets = tickets.filter(
    (t) => t.status === "completed" || t.status === "cancelled"
  )

  const hasOpenTickets = openTickets.length > 0 || inProgressTickets.length > 0

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-sm mt-1">No open tickets. Create a new ticket to track maintenance issues.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <TicketSection
        title="Open"
        tickets={openTickets}
        icon={<Circle className="h-4 w-4" />}
        variant="open"
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin || (() => {})}
      />

      <TicketSection
        title="In Progress"
        tickets={inProgressTickets}
        icon={<Clock className="h-4 w-4" />}
        variant="progress"
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin || (() => {})}
      />

      {closedTickets.length > 0 && (
        <TicketSection
          title="Closed"
          tickets={closedTickets}
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="closed"
          defaultExpanded={!hasOpenTickets}
          pinnedIds={pinnedIds}
          onTogglePin={onTogglePin || (() => {})}
        />
      )}
    </div>
  )
}
