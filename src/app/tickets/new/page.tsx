import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { getProperties, getVehicles, getVendors } from "@/lib/actions"
import { TicketForm } from "@/components/tickets/ticket-form"

export default async function NewTicketPage() {
  const [properties, vehicles, vendors] = await Promise.all([
    getProperties(),
    getVehicles(),
    getVendors(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tickets">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New Ticket</h1>
      </div>

      <div className="max-w-2xl">
        <TicketForm properties={properties} vehicles={vehicles} vendors={vendors} />
      </div>
    </div>
  )
}
