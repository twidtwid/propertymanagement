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
import {
  ArrowLeft,
  Ticket,
  Building2,
  Users,
  DollarSign,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"
import { getTicketReport, getProperties, getVendors } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_LABELS, TICKET_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/types/database"
import { ReportCard, ExportButton } from "@/components/reports"
import { TicketReportFilters } from "@/components/reports/ticket-report-filters"

interface PageProps {
  searchParams: Promise<{
    property?: string
    vendor?: string
    status?: string
    priority?: string
    sortBy?: string
    view?: string
  }>
}

export default async function TicketReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [report, properties, vendors] = await Promise.all([
    getTicketReport({
      property: params.property,
      vendor: params.vendor,
      status: params.status,
      priority: params.priority,
      sortBy: params.sortBy as 'property' | 'vendor' | 'date' | 'priority' | 'status',
    }),
    getProperties(),
    getVendors(),
  ])

  const viewMode = params.view || 'list'

  // Prepare export data
  const exportData = report.tickets.map(t => ({
    title: t.title,
    description: t.description || '',
    property: t.property_name || 'No Property',
    vendor: t.vendor_company || t.vendor_name || 'No Vendor',
    status: TICKET_STATUS_LABELS[t.status] || t.status,
    priority: TASK_PRIORITY_LABELS[t.priority] || t.priority,
    created_at: formatDate(t.created_at),
    due_date: t.due_date ? formatDate(t.due_date) : '',
    completed_date: t.completed_date ? formatDate(t.completed_date) : '',
    estimated_cost: t.estimated_cost || '',
    actual_cost: t.actual_cost || '',
    resolution: t.resolution || '',
  }))

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'warning'
      case 'medium': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'warning'
      case 'cancelled': return 'secondary'
      default: return 'outline'
    }
  }

  const renderTicketRow = (ticket: typeof report.tickets[0]) => (
    <TableRow key={ticket.id}>
      <TableCell>
        <div>
          <Link
            href={`/tickets/${ticket.id}`}
            className="font-medium hover:underline flex items-center gap-1"
          >
            {ticket.title}
            <ExternalLink className="h-3 w-3" />
          </Link>
          {ticket.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
              {ticket.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        {ticket.property_name || <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell>
        {ticket.vendor_company || ticket.vendor_name || (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={getStatusColor(ticket.status)}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={getPriorityColor(ticket.priority)}>
          {TASK_PRIORITY_LABELS[ticket.priority]}
        </Badge>
      </TableCell>
      <TableCell>
        {ticket.completed_date
          ? formatDate(ticket.completed_date)
          : ticket.due_date
          ? formatDate(ticket.due_date)
          : '-'}
      </TableCell>
      <TableCell className="text-right">
        {ticket.actual_cost
          ? formatCurrency(Number(ticket.actual_cost))
          : ticket.estimated_cost
          ? <span className="text-muted-foreground">{formatCurrency(Number(ticket.estimated_cost))}</span>
          : '-'}
      </TableCell>
    </TableRow>
  )

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
            <h1 className="text-3xl font-semibold tracking-tight">Ticket Report</h1>
            <p className="text-lg text-muted-foreground mt-1">
              All maintenance tickets with filtering and grouping
            </p>
          </div>
        </div>
        <ExportButton data={exportData} filename="ticket-report" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Total Tickets"
          value={report.stats.total.toString()}
          subtitle="all matching filters"
          icon={<Ticket className="h-5 w-5" />}
        />
        <ReportCard
          title="Open"
          value={report.stats.open.toString()}
          subtitle="pending or in progress"
          icon={<Clock className="h-5 w-5" />}
        />
        <ReportCard
          title="Completed"
          value={report.stats.completed.toString()}
          subtitle="resolved tickets"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Cost"
          value={formatCurrency(report.stats.totalCost)}
          subtitle="actual expenses"
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      <Card className="p-4">
        <Suspense fallback={null}>
          <TicketReportFilters properties={properties} vendors={vendors} />
        </Suspense>
      </Card>

      {viewMode === 'byProperty' ? (
        // Group by Property view
        Object.entries(report.byProperty)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([propertyName, tickets]) => (
            <Card key={propertyName}>
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {propertyName}
                        <Badge variant="secondary" className="ml-2">
                          {tickets.length}
                        </Badge>
                        {tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length > 0 && (
                          <Badge variant="warning" className="ml-1">
                            {tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length} open
                          </Badge>
                        )}
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
                          <TableHead>Ticket</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tickets.map(renderTicketRow)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
      ) : viewMode === 'byVendor' ? (
        // Group by Vendor view
        Object.entries(report.byVendor)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([vendorName, tickets]) => (
            <Card key={vendorName}>
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {vendorName}
                        <Badge variant="secondary" className="ml-2">
                          {tickets.length}
                        </Badge>
                        {tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length > 0 && (
                          <Badge variant="warning" className="ml-1">
                            {tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length} open
                          </Badge>
                        )}
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
                          <TableHead>Ticket</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tickets.map(renderTicketRow)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
      ) : (
        // List view (default)
        <Card>
          <CardHeader>
            <CardTitle>All Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tickets found matching the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  report.tickets.map(renderTicketRow)
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
