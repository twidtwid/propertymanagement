import Link from "next/link"
import React, { Suspense } from "react"
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
import { ReportCard, ExportButton, PrintButton } from "@/components/reports"
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
  const selectedRegion = params.region

  // Helper to filter properties by selected region
  const filterPropertiesByRegion = (vendorProperties: typeof report.vendors[0]['properties']) => {
    if (!selectedRegion) return vendorProperties
    return vendorProperties.filter(p =>
      p.state === selectedRegion || p.country === selectedRegion
    )
  }

  // Group vendors based on selected grouping
  const groupedVendors: Record<string, typeof report.vendors> = {}

  if (groupBy === 'region') {
    report.vendors.forEach(v => {
      const regions = new Set<string>()
      // When grouping by region, only add to the selected region's group if filtered
      const propsToCheck = selectedRegion ? filterPropertiesByRegion(v.properties) : v.properties
      propsToCheck.forEach(p => {
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
      const propsToGroup = selectedRegion ? filterPropertiesByRegion(v.properties) : v.properties
      if (propsToGroup.length === 0) {
        if (!groupedVendors['No Property']) groupedVendors['No Property'] = []
        groupedVendors['No Property'].push(v)
      } else {
        propsToGroup.forEach(p => {
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

  // Prepare export data (filtered by region if selected)
  const exportData = report.vendors.map(v => {
    const filteredProps = filterPropertiesByRegion(v.properties)
    return {
      name: v.name,
      company: v.company || '',
      specialties: v.specialties.map(s => VENDOR_SPECIALTY_LABELS[s] || s).join(', '),
      phone: v.phone || '',
      email: v.email || '',
      properties: filteredProps.map(p => p.name).join(', '),
      regions: Array.from(new Set(filteredProps.map(p => p.state || p.country))).join(', '),
      total_tickets: v.ticket_count,
      open_tickets: v.open_ticket_count,
      total_spent: v.total_spent,
      rating: v.rating || '',
      active: v.is_active ? 'Yes' : 'No',
    }
  })

  // Build filter summary for print header
  const filterSummary: string[] = []
  if (params.region) filterSummary.push(`Region: ${params.region}`)
  if (params.specialty) filterSummary.push(`Specialty: ${VENDOR_SPECIALTY_LABELS[params.specialty as VendorSpecialty] || params.specialty}`)
  if (params.property) {
    const propName = properties.find(p => p.id === params.property)?.name
    if (propName) filterSummary.push(`Property: ${propName}`)
  }
  if (groupBy !== 'vendor') filterSummary.push(`Grouped by: ${groupBy}`)

  return (
    <div className="space-y-8">
      {/* Print Header - hidden on screen, shown in print */}
      <div className="print-only print-header">
        <h1 className="text-2xl font-bold">Vendor Contact Directory</h1>
        <p className="text-sm text-muted-foreground">Property Management Contacts</p>
        {filterSummary.length > 0 && (
          <p className="text-sm">{filterSummary.join(' | ')}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | {totalVendors} vendors
        </p>
      </div>

      <div className="flex items-center justify-between no-print">
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
        <div className="flex gap-2">
          <PrintButton />
          <ExportButton data={exportData} filename="vendor-report" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 no-print">
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

      <Card className="p-4 no-print">
        <Suspense fallback={null}>
          <VendorReportFilters
            regions={report.regions}
            specialties={report.specialties}
            properties={properties}
          />
        </Suspense>
      </Card>

      {/* PRINT LAYOUT - Single dense table with category headers as rows */}
      <div className="print-only">
        <table className="print-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Emergency</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const printedVendorIds = new Set<string>()
              return Object.entries(groupedVendors)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([group, vendors]) => {
                  // Filter out already-printed vendors (for specialty grouping where vendors appear in multiple groups)
                  const uniqueVendors = vendors.filter(v => {
                    if (printedVendorIds.has(v.id)) return false
                    printedVendorIds.add(v.id)
                    return true
                  })
                  if (uniqueVendors.length === 0) return null
                  return (
                    <React.Fragment key={group}>
                      {/* Category header row */}
                      {groupBy !== 'vendor' && (
                        <tr className="category-header">
                          <td colSpan={4}>
                            <strong>{group}</strong> ({uniqueVendors.length})
                          </td>
                        </tr>
                      )}
                      {/* Vendor rows */}
                      {uniqueVendors.map(vendor => (
                        <tr key={vendor.id}>
                          <td>
                            <strong>{vendor.company || vendor.name}</strong>
                            {vendor.primary_contact_name && (
                              <span className="contact-name">
                                {' · '}{vendor.primary_contact_name}
                                {vendor.primary_contact_title && ` (${vendor.primary_contact_title})`}
                              </span>
                            )}
                            {groupBy !== 'specialty' && vendor.specialties.length > 0 && (
                              <span className="specialty-text">
                                {' · '}{vendor.specialties.map(s => VENDOR_SPECIALTY_LABELS[s] || s).join(', ')}
                              </span>
                            )}
                          </td>
                          <td>{vendor.phone || '-'}</td>
                          <td>{vendor.email || '-'}</td>
                          <td>{vendor.emergency_phone || '-'}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })
            })()}
          </tbody>
        </table>
      </div>

      {/* SCREEN LAYOUT - Cards with collapsibles */}
      <div className="screen-only">
        {Object.entries(groupedVendors)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([group, vendors]) => (
            <Card key={group} className="mb-4">
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
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Properties</TableHead>
                          <TableHead className="text-right">Tickets</TableHead>
                          <TableHead className="text-right">Spent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendors.map(vendor => {
                          const displayProperties = filterPropertiesByRegion(vendor.properties)
                          return (
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
                                  {vendor.primary_contact_name ? (
                                    <p className="text-sm text-muted-foreground">
                                      {vendor.primary_contact_name}
                                      {vendor.primary_contact_title && ` (${vendor.primary_contact_title})`}
                                    </p>
                                  ) : vendor.company && vendor.name !== vendor.company ? (
                                    <p className="text-sm text-muted-foreground">{vendor.name}</p>
                                  ) : null}
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
                              <TableCell>{vendor.phone || '-'}</TableCell>
                              <TableCell className="text-sm">{vendor.email || '-'}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {displayProperties.slice(0, 2).map(p => (
                                    <Badge key={p.id} variant="secondary" className="text-xs">
                                      {p.name}
                                    </Badge>
                                  ))}
                                  {displayProperties.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{displayProperties.length - 2}
                                    </Badge>
                                  )}
                                  {displayProperties.length === 0 && (
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
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
      </div>

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
