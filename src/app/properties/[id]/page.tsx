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
} from "lucide-react"
import { getProperty, getPropertyVendors, getSharedTaskListsForProperty, getPropertyTaxHistory } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PROPERTY_TYPE_LABELS, VENDOR_SPECIALTY_LABELS } from "@/types/database"

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

  const [vendors, taskLists, taxHistory] = await Promise.all([
    getPropertyVendors(id),
    getSharedTaskListsForProperty(id),
    getPropertyTaxHistory(id),
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
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
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
                    <div
                      key={pv.id}
                      className="flex items-center justify-between p-4 rounded-xl border"
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
                        <Badge variant="outline">
                          {VENDOR_SPECIALTY_LABELS[
                            pv.specialty_override || pv.vendor?.specialty || "other"
                          ]}
                        </Badge>
                        {pv.vendor?.phone && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {pv.vendor.phone}
                          </p>
                        )}
                      </div>
                    </div>
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

        <TabsContent value="maintenance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Maintenance History</CardTitle>
              <Button variant="outline" size="sm">
                Add Entry
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Maintenance history will appear here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
