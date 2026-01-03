import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { getTickets, getProperties, getVendors } from "@/lib/actions"
import { TicketFilters } from "@/components/tickets/ticket-filters"
import { TicketList } from "@/components/tickets/ticket-list"

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

  const [tickets, properties, vendors] = await Promise.all([
    getTickets({
      propertyId: params.property,
      vendorId: params.vendor,
      search: params.search,
      showClosed: params.showClosed === "true",
    }),
    getProperties(),
    getVendors(),
  ])

  const openCount = tickets.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled"
  ).length

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
        <TicketFilters properties={properties} vendors={vendors} />
      </Card>

      <TicketList tickets={tickets} />
    </div>
  )
}
