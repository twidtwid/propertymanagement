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
  Shield,
  DollarSign,
} from "lucide-react"
import { getVehicle, getInsurancePoliciesForVehicle } from "@/lib/actions"
import { formatDate, formatCurrency, daysUntil } from "@/lib/utils"
import { INSURANCE_TYPE_LABELS, RECURRENCE_LABELS } from "@/types/database"

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [vehicle, insurancePolicies] = await Promise.all([
    getVehicle(id),
    getInsurancePoliciesForVehicle(id),
  ])

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
              Location & Value
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehicle.garage_location && (
              <div>
                <p className="text-sm text-muted-foreground">Garage Location</p>
                <p className="text-base font-medium">{vehicle.garage_location}</p>
              </div>
            )}
            {vehicle.agreed_value && (
              <div>
                <p className="text-sm text-muted-foreground">Insurance Agreed Value</p>
                <p className="text-base font-medium">{formatCurrency(vehicle.agreed_value)}</p>
              </div>
            )}
            {!vehicle.garage_location && !vehicle.agreed_value && (
              <p className="text-muted-foreground">No location or value on file</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insurance Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Insurance
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/insurance/new?vehicle_id=${vehicle.id}`}>
              Add Policy
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {insurancePolicies.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No insurance policies on file
            </p>
          ) : (
            <div className="space-y-4">
              {insurancePolicies.map((policy) => {
                const expDate = policy.expiration_date ? new Date(policy.expiration_date) : null
                const today = new Date()
                const policyDaysUntil = expDate
                  ? Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <Link
                    key={policy.id}
                    href={`/insurance/${policy.id}`}
                    className="block p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{policy.carrier_name}</span>
                          <Badge variant="outline">
                            {INSURANCE_TYPE_LABELS[policy.policy_type]}
                          </Badge>
                          {policyDaysUntil !== null && policyDaysUntil <= 60 && (
                            <Badge variant={policyDaysUntil <= 0 ? "destructive" : "warning"}>
                              {policyDaysUntil <= 0 ? "Expired" : `Expires in ${policyDaysUntil}d`}
                            </Badge>
                          )}
                        </div>
                        {policy.policy_number && (
                          <p className="text-sm text-muted-foreground font-mono">
                            Policy #{policy.policy_number}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {policy.premium_amount && (
                          <p className="font-medium">
                            {formatCurrency(policy.premium_amount)}
                            <span className="text-sm text-muted-foreground">
                              /{RECURRENCE_LABELS[policy.premium_frequency].toLowerCase().replace("-", "")}
                            </span>
                          </p>
                        )}
                        {policy.expiration_date && (
                          <p className="text-sm text-muted-foreground">
                            Expires {formatDate(policy.expiration_date)}
                          </p>
                        )}
                      </div>
                    </div>
                    {policy.coverage_details && Object.keys(policy.coverage_details).length > 0 && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {policy.coverage_details.collision !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Collision:</span>{" "}
                            {formatCurrency(policy.coverage_details.collision)}
                          </div>
                        )}
                        {policy.coverage_details.comprehensive !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Comprehensive:</span>{" "}
                            {formatCurrency(policy.coverage_details.comprehensive)}
                          </div>
                        )}
                        {policy.coverage_details.bodily_injury !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Bodily Injury:</span>{" "}
                            {formatCurrency(policy.coverage_details.bodily_injury)}
                          </div>
                        )}
                        {policy.coverage_details.property_damage !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Property Damage:</span>{" "}
                            {formatCurrency(policy.coverage_details.property_damage)}
                          </div>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
