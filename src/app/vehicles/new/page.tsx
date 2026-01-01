import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { VehicleForm } from "@/components/vehicles/vehicle-form"
import { getActiveProperties } from "@/lib/actions"

export default async function NewVehiclePage() {
  const properties = await getActiveProperties()

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vehicles">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Add Vehicle</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Add a new vehicle to your fleet
          </p>
        </div>
      </div>

      <VehicleForm properties={properties} />
    </div>
  )
}
