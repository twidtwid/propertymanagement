export const dynamic = 'force-dynamic'

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Car, MapPin, Calendar, AlertTriangle } from "lucide-react"
import { getVehicles } from "@/lib/actions"
import { formatDate, daysUntil } from "@/lib/utils"

export default async function VehiclesPage() {
  const vehicles = await getVehicles()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Vehicles</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Manage your {vehicles.length} vehicles
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/vehicles/new">
            <Plus className="h-5 w-5 mr-2" />
            Add Vehicle
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => {
          const regDays = vehicle.registration_expires
            ? daysUntil(vehicle.registration_expires)
            : null
          const inspDays = vehicle.inspection_expires
            ? daysUntil(vehicle.inspection_expires)
            : null
          const hasAlert =
            (regDays !== null && regDays <= 30) ||
            (inspDays !== null && inspDays <= 0) ||
            vehicle.notes?.toLowerCase().includes("overdue")

          return (
            <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`}>
              <Card
                className={`h-full hover:shadow-md transition-shadow cursor-pointer ${
                  hasAlert ? "border-amber-300" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <Car className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                      {hasAlert && (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                      <Badge
                        variant={vehicle.is_active ? "success" : "secondary"}
                      >
                        {vehicle.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xl font-semibold">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    {vehicle.color && (
                      <p className="text-base text-muted-foreground mt-1">
                        {vehicle.color}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {vehicle.license_plate && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">
                          {vehicle.license_plate} ({vehicle.registration_state})
                        </span>
                      </div>
                    )}
                    {vehicle.registration_expires && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Reg expires: {formatDate(vehicle.registration_expires)}
                          {regDays !== null && regDays <= 30 && (
                            <Badge
                              variant={regDays <= 0 ? "destructive" : "warning"}
                              className="ml-2"
                            >
                              {regDays <= 0
                                ? "Expired"
                                : `${regDays}d left`}
                            </Badge>
                          )}
                        </span>
                      </div>
                    )}
                    {vehicle.inspection_expires && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Inspection: {formatDate(vehicle.inspection_expires)}
                          {inspDays !== null && inspDays <= 0 && (
                            <Badge variant="destructive" className="ml-2">
                              Overdue
                            </Badge>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {vehicle.garage_location && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {vehicle.garage_location}
                      </p>
                    </div>
                  )}
                  {vehicle.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {vehicle.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
