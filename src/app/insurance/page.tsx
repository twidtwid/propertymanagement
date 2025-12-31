import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Shield, AlertTriangle, FileText, Building2, Car } from "lucide-react"
import { getInsurancePolicies, getExpiringPolicies } from "@/lib/actions"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  homeowners: "Homeowners",
  auto: "Auto",
  umbrella: "Umbrella",
  flood: "Flood",
  earthquake: "Earthquake",
  liability: "Liability",
  health: "Health",
  travel: "Travel",
  other: "Other",
}

export default async function InsurancePage() {
  const [policies, expiring] = await Promise.all([
    getInsurancePolicies(),
    getExpiringPolicies(60),
  ])

  const propertyPolicies = policies.filter((p) => p.property_id)
  const vehiclePolicies = policies.filter((p) => p.vehicle_id)
  const otherPolicies = policies.filter((p) => !p.property_id && !p.vehicle_id)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Insurance</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Manage your {policies.length} insurance policies
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/insurance/new">
            <Plus className="h-5 w-5 mr-2" />
            Add Policy
          </Link>
        </Button>
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Policies Expiring Soon ({expiring.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiring.map((policy) => {
                const days = daysUntil(policy.expiration_date!)
                return (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      {policy.property_id ? (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Car className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-base font-medium">
                          {policy.carrier_name} - {INSURANCE_TYPE_LABELS[policy.policy_type]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {policy.property?.name ||
                            (policy.vehicle
                              ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}`
                              : "General")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Expires {formatDate(policy.expiration_date!)}
                        </p>
                        <Badge variant={days <= 14 ? "destructive" : "warning"}>
                          {days <= 0 ? "Expired" : `${days} days left`}
                        </Badge>
                      </div>
                      {policy.auto_renew && (
                        <Badge variant="outline">Auto-renew</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="property" className="space-y-6">
        <TabsList>
          <TabsTrigger value="property" className="gap-2">
            <Building2 className="h-4 w-4" />
            Property ({propertyPolicies.length})
          </TabsTrigger>
          <TabsTrigger value="auto" className="gap-2">
            <Car className="h-4 w-4" />
            Auto ({vehiclePolicies.length})
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-2">
            <Shield className="h-4 w-4" />
            Other ({otherPolicies.length})
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2">
            <FileText className="h-4 w-4" />
            Claims
          </TabsTrigger>
        </TabsList>

        <TabsContent value="property">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyPolicies.map((policy) => {
                    const days = policy.expiration_date
                      ? daysUntil(policy.expiration_date)
                      : null
                    return (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">
                          {policy.property?.name}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{policy.carrier_name}</p>
                            {policy.policy_number && (
                              <p className="text-sm text-muted-foreground font-mono">
                                {policy.policy_number}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {INSURANCE_TYPE_LABELS[policy.policy_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {policy.premium_amount ? (
                            <div>
                              <p className="font-medium">
                                {formatCurrency(policy.premium_amount)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                /{policy.premium_frequency}
                              </p>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {policy.expiration_date
                            ? formatDate(policy.expiration_date)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {days !== null && days <= 60 ? (
                            <Badge
                              variant={days <= 14 ? "destructive" : "warning"}
                            >
                              {days <= 0 ? "Expired" : `${days}d left`}
                            </Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehiclePolicies.map((policy) => {
                    const days = policy.expiration_date
                      ? daysUntil(policy.expiration_date)
                      : null
                    return (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">
                          {policy.vehicle
                            ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{policy.carrier_name}</p>
                            {policy.policy_number && (
                              <p className="text-sm text-muted-foreground font-mono">
                                {policy.policy_number}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {policy.premium_amount ? (
                            <div>
                              <p className="font-medium">
                                {formatCurrency(policy.premium_amount)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                /{policy.premium_frequency}
                              </p>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {policy.expiration_date
                            ? formatDate(policy.expiration_date)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {days !== null && days <= 60 ? (
                            <Badge
                              variant={days <= 14 ? "destructive" : "warning"}
                            >
                              {days <= 0 ? "Expired" : `${days}d left`}
                            </Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other">
          <Card>
            <CardContent className="pt-6">
              {otherPolicies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No other policies
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>Expiration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherPolicies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">
                          {policy.carrier_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {INSURANCE_TYPE_LABELS[policy.policy_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {policy.premium_amount
                            ? formatCurrency(policy.premium_amount)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {policy.expiration_date
                            ? formatDate(policy.expiration_date)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Insurance Claims</CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Claim
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                No claims on file
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
