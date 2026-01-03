import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Building,
  Car,
  User,
  Clock,
  DollarSign,
  Play,
  CheckCircle2,
} from "lucide-react"
import { getTicket, getTicketActivity } from "@/lib/actions"
import { formatDateTime, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/types/database"
import { TicketActivityList } from "@/components/tickets/ticket-activity"
import { CloseTicketDialog } from "@/components/tickets/close-ticket-dialog"
import { TicketStatusButton } from "@/components/tickets/ticket-status-button"

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ticket, activities] = await Promise.all([
    getTicket(id),
    getTicketActivity(id),
  ])

  if (!ticket) {
    notFound()
  }

  const locationName = ticket.property_name || ticket.vehicle_name || "No location"
  const locationIcon = ticket.property_id ? Building : Car
  const LocationIcon = locationIcon

  const isOpen = ticket.status === "pending" || ticket.status === "in_progress"
  const isPending = ticket.status === "pending"
  const isInProgress = ticket.status === "in_progress"

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/tickets">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={getPriorityVariant(ticket.priority)}>
              {TASK_PRIORITY_LABELS[ticket.priority]}
            </Badge>
            <Badge variant={isOpen ? "outline" : "secondary"}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <LocationIcon className="h-4 w-4" />
            <span>{locationName}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {ticket.vendor_contact?.phone && (
          <Button size="lg" asChild>
            <a href={`tel:${ticket.vendor_contact.phone}`}>
              <Phone className="h-5 w-5 mr-2" />
              Call {ticket.vendor_contact.name.split(" ")[0]}
            </a>
          </Button>
        )}
        <Button size="lg" variant="outline" asChild>
          <Link href={`/tickets/${ticket.id}/edit`}>
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Link>
        </Button>
        {isPending && (
          <TicketStatusButton ticketId={ticket.id} newStatus="in_progress">
            <Button size="lg" variant="outline">
              <Play className="h-5 w-5 mr-2" />
              Start Work
            </Button>
          </TicketStatusButton>
        )}
        {isInProgress && (
          <TicketStatusButton ticketId={ticket.id} newStatus="pending">
            <Button size="lg" variant="outline">
              <Clock className="h-5 w-5 mr-2" />
              Put on Hold
            </Button>
          </TicketStatusButton>
        )}
        {isOpen && (
          <CloseTicketDialog ticketId={ticket.id} ticketTitle={ticket.title}>
            <Button size="lg" variant="default">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Close Ticket
            </Button>
          </CloseTicketDialog>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Assigned To */}
          {ticket.vendor && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Assigned To
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/vendors/${ticket.vendor.id}`}
                  className="font-medium hover:underline"
                >
                  {ticket.vendor.company || ticket.vendor.name}
                </Link>
                {ticket.vendor_contact && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {ticket.vendor_contact.name}
                      {ticket.vendor_contact.title && ` · ${ticket.vendor_contact.title}`}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {ticket.vendor_contact.phone && (
                        <a
                          href={`tel:${ticket.vendor_contact.phone}`}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {ticket.vendor_contact.phone}
                        </a>
                      )}
                      {ticket.vendor_contact.email && (
                        <a
                          href={`mailto:${ticket.vendor_contact.email}`}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {ticket.vendor_contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDateTime(ticket.created_at)}</p>
                </div>
                {ticket.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Need By Date</p>
                    <p className="font-medium">{formatDate(ticket.due_date)}</p>
                  </div>
                )}
                {ticket.estimated_cost && (
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Cost</p>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {ticket.estimated_cost.toLocaleString()}
                    </p>
                  </div>
                )}
                {ticket.actual_cost && (
                  <div>
                    <p className="text-sm text-muted-foreground">Final Cost</p>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {ticket.actual_cost.toLocaleString()}
                    </p>
                  </div>
                )}
                {ticket.resolved_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                    <p className="font-medium">{formatDateTime(ticket.resolved_at)}</p>
                  </div>
                )}
              </div>
              {ticket.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="whitespace-pre-wrap">{ticket.description}</p>
                </div>
              )}
              {ticket.resolution && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Resolution</p>
                  <p className="whitespace-pre-wrap">{ticket.resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TicketActivityList activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
