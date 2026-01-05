import Link from "next/link"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ArrowLeft, Users, MapPin, Building2, Wrench, ChevronDown, Phone, Mail, ExternalLink } from "lucide-react"
import { getVendorReport, getProperties } from "@/lib/actions"
import { formatCurrency } from "@/lib/utils"
import { VENDOR_SPECIALTY_LABELS, type VendorSpecialty } from "@/types/database"
import { ReportCard, ExportButton } from "@/components/reports"
import { VendorReportFilters } from "@/components/reports/vendor-report-filters"

interface PageProps {
  searchParams: Promise<{
    specialty?: string
    region?: string
    property?: string
    groupBy?: string
  }>
}

export default async function VendorReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [report, properties] = await Promise.all([
    getVendorReport({
      specialty: params.specialty,
      region: params.region,
      property: params.property,
      groupBy: params.groupBy as 'vendor' | 'region' | 'property' | 'specialty',
    }),
    getProperties(),
  ])

  const groupBy = params.groupBy || 'vendor'

  // Group vendors based on selected grouping
  const groupedVendors: Record<string, typeof report.vendors> = {}

  if (groupBy === 'region') {
    report.vendors.forEach(v => {
      const regions = new Set<string>()
      v.properties.forEach(p => {
        if (p.state) regions.add(p.state)
        else if (p.country !== 'USA') regions.add(p.country)
      })
      if (regions.size === 0) regions.add('No Region')
      regions.forEach(region => {
        if (!groupedVendors[region]) groupedVendors[region] = []
        groupedVendors[region].push(v)
      })
    })
  } else if (groupBy === 'property') {
    report.vendors.forEach(v => {
      if (v.properties.length === 0) {
        if (!groupedVendors['No Property']) groupedVendors['No Property'] = []
        groupedVendors['No Property'].push(v)
      } else {
        v.properties.forEach(p => {
          if (!groupedVendors[p.name]) groupedVendors[p.name] = []
          groupedVendors[p.name].push(v)
        })
      }
    })
  } else if (groupBy === 'specialty') {
    report.vendors.forEach(v => {
      v.specialties.forEach(s => {
        const label = VENDOR_SPECIALTY_LABELS[s] || s
        if (!groupedVendors[label]) groupedVendors[label] = []
        groupedVendors[label].push(v)
      })
    })
  } else {
    groupedVendors['All Vendors'] = report.vendors
  }

  // Calculate stats
  const totalVendors = report.vendors.length
  const activeVendors = report.vendors.filter(v => v.is_active).length
  const totalTickets = report.vendors.reduce((sum, v) => sum + v.ticket_count, 0)
  const totalSpent = report.vendors.reduce((sum, v) => sum + v.total_spent, 0)

  // Prepare export data
  const exportData = report.vendors.map(v => ({
    name: v.name,
    company: v.company || '',
    specialties: v.specialties.map(s => VENDOR_SPECIALTY_LABELS[s] || s).join(', '),
    phone: v.phone || '',
    email: v.email || '',
    properties: v.properties.map(p => p.name).join(', '),
    regions: Array.from(new Set(v.properties.map(p => p.state || p.country))).join(', '),
    total_tickets: v.ticket_count,
    open_tickets: v.open_ticket_count,
    total_spent: v.total_spent,
    rating: v.rating || '',
    active: v.is_active ? 'Yes' : 'No',
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/reports">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Vendor Directory Report</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Complete vendor listing with contact info and activity
            </p>
          </div>
        </div>
        <ExportButton data={exportData} filename="vendor-report" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Total Vendors"
          value={totalVendors.toString()}
          subtitle={`${activeVendors} active`}
          icon={<Users className="h-5 w-5" />}
        />
        <ReportCard
          title="Regions"
          value={report.regions.length.toString()}
          subtitle="coverage areas"
          icon={<MapPin className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Tickets"
          value={totalTickets.toString()}
          subtitle="all time"
          icon={<Wrench className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Spent"
          value={formatCurrency(totalSpent)}
          subtitle="maintenance costs"
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>

      <Card className="p-4">
        <Suspense fallback={null}>
          <VendorReportFilters
            regions={report.regions}
            specialties={report.specialties}
            properties={properties}
          />
        </Suspense>
      </Card>

      {Object.entries(groupedVendors)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, vendors]) => (
          <Card key={group}>
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {groupBy === 'region' && <MapPin className="h-5 w-5" />}
                      {groupBy === 'property' && <Building2 className="h-5 w-5" />}
                      {groupBy === 'specialty' && <Wrench className="h-5 w-5" />}
                      {groupBy === 'vendor' && <Users className="h-5 w-5" />}
                      {group}
                      <Badge variant="secondary" className="ml-2">
                        {vendors.length}
                      </Badge>
                    </CardTitle>
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Specialty</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Properties</TableHead>
                        <TableHead className="text-right">Tickets</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map(vendor => (
                        <TableRow key={vendor.id}>
                          <TableCell>
                            <div>
                              <Link
                                href={`/vendors/${vendor.id}`}
                                className="font-medium hover:underline flex items-center gap-1"
                              >
                                {vendor.company || vendor.name}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                              {vendor.company && (
                                <p className="text-sm text-muted-foreground">{vendor.name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {vendor.specialties.slice(0, 2).map(s => (
                                <Badge key={s} variant="outline" className="text-xs">
                                  {VENDOR_SPECIALTY_LABELS[s] || s}
                                </Badge>
                              ))}
                              {vendor.specialties.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{vendor.specialties.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {vendor.phone && (
                                <a
                                  href={`tel:${vendor.phone}`}
                                  className="flex items-center gap-1 text-sm hover:underline"
                                >
                                  <Phone className="h-3 w-3" />
                                  {vendor.phone}
                                </a>
                              )}
                              {vendor.email && (
                                <a
                                  href={`mailto:${vendor.email}`}
                                  className="flex items-center gap-1 text-sm hover:underline"
                                >
                                  <Mail className="h-3 w-3" />
                                  {vendor.email}
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {vendor.properties.slice(0, 2).map(p => (
                                <Badge key={p.id} variant="secondary" className="text-xs">
                                  {p.name}
                                </Badge>
                              ))}
                              {vendor.properties.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{vendor.properties.length - 2}
                                </Badge>
                              )}
                              {vendor.properties.length === 0 && (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <span className="font-medium">{vendor.ticket_count}</span>
                              {vendor.open_ticket_count > 0 && (
                                <Badge variant="warning" className="ml-1 text-xs">
                                  {vendor.open_ticket_count} open
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {vendor.total_spent > 0 ? formatCurrency(vendor.total_spent) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}

      {report.vendors.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No vendors found matching the selected filters
          </CardContent>
        </Card>
      )}
    </div>
  )
}
