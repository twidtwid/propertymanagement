import Link from "next/link"
import { Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import {
  getTickets,
  getProperties,
  getVendors,
  getSmartAndUserPins,
  getPinNotesByEntities,
  getUserPinNotesByEntities,
} from "@/lib/actions"
import { getUser } from "@/lib/auth"
import { TicketFilters } from "@/components/tickets/ticket-filters"
import { TicketsContent } from "@/components/tickets/tickets-content"

interface TicketsPageProps {
  searchParams: Promise<{
    property?: string
    vendor?: string
    search?: string
    showClosed?: string
  }>
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams

  const [tickets, properties, vendors, pins, user] = await Promise.all([
    getTickets({
      propertyId: params.property,
      vendorId: params.vendor,
      search: params.search,
      showClosed: params.showClosed === "true",
    }),
    getProperties(),
    getVendors(),
    getSmartAndUserPins('ticket'),
    getUser(),
  ])

  const openCount = tickets.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled"
  ).length

  // Load notes for all pinned tickets (batch queries - no N+1)
  const allPinnedIds = [...Array.from(pins.smartPins), ...Array.from(pins.userPins)]
  const [notesMap, userNotesMap] = await Promise.all([
    getPinNotesByEntities('ticket', allPinnedIds),
    user ? getUserPinNotesByEntities('ticket', allPinnedIds, user.id) : Promise.resolve(new Map()),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Maintenance Tickets</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {openCount} open ticket{openCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/tickets/new">
            <Plus className="h-5 w-5 mr-2" />
            New Ticket
          </Link>
        </Button>
      </div>

      <Card className="p-4">
        <Suspense fallback={<div className="h-10" />}>
          <TicketFilters properties={properties} vendors={vendors} />
        </Suspense>
      </Card>

      <TicketsContent
        tickets={tickets}
        initialSmartPins={Array.from(pins.smartPins)}
        initialUserPins={Array.from(pins.userPins)}
        initialNotesMap={Object.fromEntries(notesMap)}
        initialUserNotesMap={Object.fromEntries(userNotesMap)}
      />
    </div>
  )
}
