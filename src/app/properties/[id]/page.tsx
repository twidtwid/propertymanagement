import Link from "next/link"
import { notFound } from "next/navigation"
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
import {
  ArrowLeft,
  Edit,
  MapPin,
  DollarSign,
  FileText,
  Users,
  Wrench,
  ClipboardList,
  Receipt,
  ExternalLink,
  Shield,
  FolderOpen,
} from "lucide-react"
import { EntityDocuments } from "@/components/documents/entity-documents"
import { PropertyAccessCard } from "@/components/properties/property-access-card"
import { PropertyNeighborsCard } from "@/components/properties/property-neighbors-card"
import { PropertyRenewalsCard } from "@/components/properties/property-renewals-card"
import { getProperty, getPropertyVendors, getSharedTaskListsForProperty, getPropertyTaxHistory, getInsurancePoliciesForProperty, getTicketsForProperty, getPropertyAccess, getTrustedNeighbors, getPropertyRenewals, getVendors } from "@/lib/actions"
import { getDocumentCountForEntity } from "@/lib/dropbox/files"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PROPERTY_TYPE_LABELS, VENDOR_SPECIALTY_LABELS, INSURANCE_TYPE_LABELS, RECURRENCE_LABELS } from "@/types/database"

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const property = await getProperty(id)

  if (!property) {
    notFound()
  }

  const [vendors, taskLists, taxHistory, insurancePolicies, documentCount, tickets, accessItems, neighbors, renewals, allVendors] = await Promise.all([
    getPropertyVendors(id),
    getSharedTaskListsForProperty(id),
    getPropertyTaxHistory(id),
    getInsurancePoliciesForProperty(id),
    getDocumentCountForEntity("property", id),
    getTicketsForProperty(id),
    getPropertyAccess(id),
    getTrustedNeighbors(id),
    getPropertyRenewals(id),
    getVendors(),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/properties">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {property.name}
            </h1>
            <Badge
              variant={property.status === "active" ? "success" : "secondary"}
            >
              {property.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <p className="text-lg">
              {property.address}, {property.city},{" "}
              {property.state || property.country}
            </p>
          </div>
        </div>
        <Button size="lg" variant="outline" asChild>
          <Link href={`/properties/${property.id}/edit`}>
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Property Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="text-base font-medium">
                {PROPERTY_TYPE_LABELS[property.property_type]}
              </p>
            </div>
            {property.square_feet && (
              <div>
                <p className="text-sm text-muted-foreground">Square Feet</p>
                <p className="text-base font-medium">
                  {property.square_feet.toLocaleString()} sq ft
                </p>
              </div>
            )}
            {property.purchase_date && (
              <div>
                <p className="text-sm text-muted-foreground">Purchase Date</p>
                <p className="text-base font-medium">
                  {formatDate(property.purchase_date)}
                </p>
              </div>
            )}
            {property.purchase_price && (
              <div>
                <p className="text-sm text-muted-foreground">Purchase Price</p>
                <p className="text-base font-medium">
                  {formatCurrency(property.purchase_price)}
                </p>
              </div>
            )}
            {property.current_value && (
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-base font-medium">
                  {formatCurrency(property.current_value)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tax Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {property.span_number && (
              <div>
                <p className="text-sm text-muted-foreground">SPAN Number (VT)</p>
                <p className="text-base font-medium font-mono">
                  {property.span_number}
                </p>
              </div>
            )}
            {property.block_number && (
              <div>
                <p className="text-sm text-muted-foreground">Block Number (NYC)</p>
                <p className="text-base font-medium font-mono">
                  {property.block_number}
                </p>
              </div>
            )}
            {property.lot_number && (
              <div>
                <p className="text-sm text-muted-foreground">Lot Number (NYC)</p>
                <p className="text-base font-medium font-mono">
                  {property.lot_number}
                </p>
              </div>
            )}
            {property.parcel_id && (
              <div>
                <p className="text-sm text-muted-foreground">Parcel ID</p>
                <p className="text-base font-medium font-mono">
                  {property.parcel_id}
                </p>
              </div>
            )}
            {!property.span_number &&
              !property.block_number &&
              !property.lot_number &&
              !property.parcel_id && (
                <p className="text-muted-foreground">No tax IDs on file</p>
              )}
            {property.tax_lookup_url && (
              <div className="pt-2 border-t">
                <a
                  href={property.tax_lookup_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Tax Portal
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mortgage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {property.has_mortgage ? (
              <>
                {property.mortgage_lender && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lender</p>
                    <p className="text-base font-medium">
                      {property.mortgage_lender}
                    </p>
                  </div>
                )}
                {property.mortgage_account && (
                  <div>
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="text-base font-medium font-mono">
                      {property.mortgage_account}
                    </p>
                  </div>
                )}
                {property.mortgage_payment && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Monthly Payment
                    </p>
                    <p className="text-base font-medium">
                      {formatCurrency(Number(property.mortgage_payment))}
                    </p>
                  </div>
                )}
                {property.mortgage_due_day && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Day</p>
                    <p className="text-base font-medium">
                      {property.mortgage_due_day}
                      {property.mortgage_due_day === 1
                        ? "st"
                        : property.mortgage_due_day === 2
                        ? "nd"
                        : property.mortgage_due_day === 3
                        ? "rd"
                        : "th"}{" "}
                      of month
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No mortgage</p>
            )}
          </CardContent>
        </Card>
      </div>

      {property.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base whitespace-pre-wrap">{property.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Property Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <PropertyAccessCard propertyId={property.id} accessItems={accessItems} />
        <PropertyNeighborsCard propertyId={property.id} neighbors={neighbors} />
        <PropertyRenewalsCard propertyId={property.id} renewals={renewals} vendors={allVendors} />
      </div>

      <Tabs defaultValue="vendors" className="space-y-6">
        <TabsList>
          <TabsTrigger value="vendors" className="gap-2">
            <Users className="h-4 w-4" />
            Vendors ({vendors.length})
          </TabsTrigger>
          <TabsTrigger value="taxes" className="gap-2">
            <Receipt className="h-4 w-4" />
            Tax History ({taxHistory.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Task Lists ({taskLists.length})
          </TabsTrigger>
          <TabsTrigger value="insurance" className="gap-2">
            <Shield className="h-4 w-4" />
            Insurance ({insurancePolicies.length})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <Wrench className="h-4 w-4" />
            Tickets ({tickets.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Documents ({documentCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Assigned Vendors</CardTitle>
              <Button variant="outline" size="sm">
                Add Vendor
              </Button>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No vendors assigned to this property
                </p>
              ) : (
                <div className="space-y-3">
                  {vendors.map((pv) => (
                    <Link
                      key={pv.id}
                      href={`/vendors/${pv.vendor_id}`}
                      className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-medium">
                            {pv.vendor?.name}
                          </p>
                          {pv.is_primary && (
                            <Badge variant="secondary">Primary</Badge>
                          )}
                        </div>
                        {pv.vendor?.company && (
                          <p className="text-sm text-muted-foreground">
                            {pv.vendor.company}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {pv.specialty_override ? (
                          <Badge variant="outline">
                            {VENDOR_SPECIALTY_LABELS[pv.specialty_override]}
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {(pv.vendor?.specialties || ["other"]).map(s => (
                              <Badge key={s} variant="outline">
                                {VENDOR_SPECIALTY_LABELS[s]}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {pv.vendor?.phone && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {pv.vendor.phone}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Property Tax History</CardTitle>
              <Button variant="outline" size="sm">
                Add Tax Record
              </Button>
            </CardHeader>
            <CardContent>
              {taxHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No tax history for this property
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Installment</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxHistory.map((tax) => (
                      <TableRow key={tax.id}>
                        <TableCell className="font-medium">{tax.tax_year}</TableCell>
                        <TableCell>{tax.jurisdiction}</TableCell>
                        <TableCell>{tax.installment}</TableCell>
                        <TableCell>{formatCurrency(Number(tax.amount))}</TableCell>
                        <TableCell>{formatDate(tax.due_date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tax.status === "confirmed"
                                ? "success"
                                : tax.status === "pending"
                                ? "secondary"
                                : tax.status === "overdue"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {tax.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tax.payment_date ? formatDate(tax.payment_date) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shared Task Lists</CardTitle>
              <Button variant="outline" size="sm">
                New Task List
              </Button>
            </CardHeader>
            <CardContent>
              {taskLists.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No task lists for this property
                </p>
              ) : (
                <div className="space-y-3">
                  {taskLists.map((list) => (
                    <Link
                      key={list.id}
                      href={`/properties/${property.id}/tasks/${list.id}`}
                      className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-base font-medium">{list.title}</p>
                        {list.assigned_to && (
                          <p className="text-sm text-muted-foreground">
                            Assigned to: {list.assigned_to}
                          </p>
                        )}
                      </div>
                      <Badge variant={list.is_active ? "success" : "secondary"}>
                        {list.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Insurance Policies</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/insurance/new?property_id=${property.id}`}>
                  Add Policy
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {insurancePolicies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No insurance policies for this property
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insurancePolicies.map((policy) => {
                      const expDate = policy.expiration_date ? new Date(policy.expiration_date) : null
                      const today = new Date()
                      const daysUntil = expDate
                        ? Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        : null
                      const statusVariant = !expDate
                        ? "secondary"
                        : daysUntil && daysUntil < 0
                        ? "destructive"
                        : daysUntil && daysUntil <= 60
                        ? "warning"
                        : "success"
                      const statusText = !expDate
                        ? "No date"
                        : daysUntil && daysUntil < 0
                        ? "Expired"
                        : daysUntil && daysUntil <= 30
                        ? `${daysUntil}d`
                        : "Active"

                      return (
                        <TableRow key={policy.id}>
                          <TableCell>
                            <Link href={`/insurance/${policy.id}`} className="block">
                              <Badge variant="outline">
                                {INSURANCE_TYPE_LABELS[policy.policy_type]}
                              </Badge>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/insurance/${policy.id}`} className="block font-medium hover:underline">
                              {policy.carrier_name}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {policy.policy_number || "—"}
                          </TableCell>
                          <TableCell>
                            {policy.coverage_amount ? formatCurrency(policy.coverage_amount) : "—"}
                          </TableCell>
                          <TableCell>
                            {policy.premium_amount ? (
                              <>
                                {formatCurrency(policy.premium_amount)}
                                <span className="text-xs text-muted-foreground ml-1">
                                  /{RECURRENCE_LABELS[policy.premium_frequency].toLowerCase().replace("-", "")}
                                </span>
                              </>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {policy.expiration_date ? formatDate(policy.expiration_date) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant}>{statusText}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Maintenance Tickets</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tickets/new?property=${property.id}`}>
                  New Ticket
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No open tickets for this property
                </p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-base font-medium">{ticket.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.vendor_name || "Unassigned"}
                          {ticket.vendor_contact_name && ` (${ticket.vendor_contact_name})`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            ticket.priority === "urgent"
                              ? "destructive"
                              : ticket.priority === "high"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {ticket.priority}
                        </Badge>
                        <Badge variant="outline">
                          {ticket.status === "pending"
                            ? "Open"
                            : ticket.status === "in_progress"
                            ? "In Progress"
                            : "Closed"}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4 border-t">
                <Link
                  href={`/tickets?property=${property.id}&showClosed=true`}
                  className="text-sm text-primary hover:underline"
                >
                  View all tickets for this property
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <EntityDocuments
            entityType="property"
            entityId={property.id}
            entityName={property.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
