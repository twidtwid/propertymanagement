import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Edit,
  Car,
  Calendar,
  MapPin,
  FileText,
  AlertTriangle,
} from "lucide-react"
import { getVehicle } from "@/lib/actions"
import { formatDate, daysUntil } from "@/lib/utils"

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vehicle = await getVehicle(id)

  if (!vehicle) {
    notFound()
  }

  const regDays = vehicle.registration_expires
    ? daysUntil(vehicle.registration_expires)
    : null
  const inspDays = vehicle.inspection_expires
    ? daysUntil(vehicle.inspection_expires)
    : null

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vehicles">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <Badge variant={vehicle.is_active ? "success" : "secondary"}>
              {vehicle.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {vehicle.color && (
            <p className="text-lg text-muted-foreground mt-1">{vehicle.color}</p>
          )}
        </div>
        <Button size="lg" variant="outline" asChild>
          <Link href={`/vehicles/${vehicle.id}/edit`}>
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Year / Make / Model</p>
              <p className="text-base font-medium">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            </div>
            {vehicle.color && (
              <div>
                <p className="text-sm text-muted-foreground">Color</p>
                <p className="text-base font-medium">{vehicle.color}</p>
              </div>
            )}
            {vehicle.vin && (
              <div>
                <p className="text-sm text-muted-foreground">VIN</p>
                <p className="text-base font-medium font-mono">{vehicle.vin}</p>
              </div>
            )}
            {vehicle.license_plate && (
              <div>
                <p className="text-sm text-muted-foreground">License Plate</p>
                <p className="text-base font-medium font-mono">
                  {vehicle.license_plate} ({vehicle.registration_state})
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Registration & Inspection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Registration State</p>
              <p className="text-base font-medium">{vehicle.registration_state}</p>
            </div>
            {vehicle.registration_expires && (
              <div>
                <p className="text-sm text-muted-foreground">Registration Expires</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium">
                    {formatDate(vehicle.registration_expires)}
                  </p>
                  {regDays !== null && regDays <= 30 && (
                    <Badge variant={regDays <= 0 ? "destructive" : "warning"}>
                      {regDays <= 0 ? "Expired" : `${regDays}d left`}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {vehicle.inspection_expires && (
              <div>
                <p className="text-sm text-muted-foreground">Inspection Expires</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium">
                    {formatDate(vehicle.inspection_expires)}
                  </p>
                  {inspDays !== null && inspDays <= 0 && (
                    <Badge variant="destructive">Overdue</Badge>
                  )}
                  {inspDays !== null && inspDays > 0 && inspDays <= 30 && (
                    <Badge variant="warning">{inspDays}d left</Badge>
                  )}
                </div>
              </div>
            )}
            {!vehicle.registration_expires && !vehicle.inspection_expires && (
              <p className="text-muted-foreground">No dates on file</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehicle.garage_location ? (
              <div>
                <p className="text-sm text-muted-foreground">Garage Location</p>
                <p className="text-base font-medium">{vehicle.garage_location}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">No location on file</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {((regDays !== null && regDays <= 30) ||
        (inspDays !== null && inspDays <= 0) ||
        vehicle.notes?.toLowerCase().includes("overdue")) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {regDays !== null && regDays <= 0 && (
                <li className="text-destructive font-medium">
                  Registration has expired!
                </li>
              )}
              {regDays !== null && regDays > 0 && regDays <= 30 && (
                <li className="text-amber-700 dark:text-amber-400">
                  Registration expires in {regDays} days
                </li>
              )}
              {inspDays !== null && inspDays <= 0 && (
                <li className="text-destructive font-medium">
                  Inspection is overdue!
                </li>
              )}
              {vehicle.notes?.toLowerCase().includes("overdue") && (
                <li className="text-amber-700 dark:text-amber-400">
                  Check notes for overdue items
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {vehicle.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base whitespace-pre-wrap">{vehicle.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
