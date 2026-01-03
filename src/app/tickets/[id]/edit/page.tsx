import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { getTicket, getProperties, getVehicles, getVendors } from "@/lib/actions"
import { TicketForm } from "@/components/tickets/ticket-form"

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ticket, properties, vehicles, vendors] = await Promise.all([
    getTicket(id),
    getProperties(),
    getVehicles(),
    getVendors(),
  ])

  if (!ticket) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/tickets/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Ticket</h1>
      </div>

      <div className="max-w-2xl">
        <TicketForm
          properties={properties}
          vehicles={vehicles}
          vendors={vendors}
          ticket={ticket}
        />
      </div>
    </div>
  )
}
