import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { getVehicle } from "@/lib/actions"
import { VehicleForm } from "@/components/vehicles/vehicle-form"

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vehicle = await getVehicle(id)

  if (!vehicle) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/vehicles/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Edit Vehicle
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Update {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
      </div>

      <VehicleForm vehicle={vehicle} />
    </div>
  )
}
