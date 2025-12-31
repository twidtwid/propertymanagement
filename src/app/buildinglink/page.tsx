import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Building,
  AlertTriangle,
  Bell,
  Wrench,
  Key,
  Package,
  Search,
  ExternalLink,
} from "lucide-react"
import {
  getBuildingLinkStats,
  getBuildingLinkMessages,
  type BuildingLinkMessage,
  type BuildingLinkCategory,
} from "@/lib/actions"
import { formatDistanceToNow, format } from "date-fns"
import Link from "next/link"
import { BuildingLinkFilters } from "@/components/buildinglink/filters"
import { MessageList } from "@/components/buildinglink/message-list"
import { SecurityLog } from "@/components/buildinglink/security-log"

interface BuildingLinkPageProps {
  searchParams: Promise<{
    category?: string
    search?: string
    unit?: string
  }>
}

export default async function BuildingLinkPage({ searchParams }: BuildingLinkPageProps) {
  const params = await searchParams
  const [stats, allMessages] = await Promise.all([
    getBuildingLinkStats(),
    getBuildingLinkMessages({ limit: 1000 }),
  ])

  // Filter messages based on params
  let filteredMessages = allMessages
  if (params.category && params.category !== 'all') {
    filteredMessages = filteredMessages.filter(m => m.category === params.category)
  }
  if (params.unit && params.unit !== 'all') {
    filteredMessages = filteredMessages.filter(m => m.unit === params.unit || m.unit === 'both' || m.unit === 'unknown')
  }
  if (params.search) {
    const search = params.search.toLowerCase()
    filteredMessages = filteredMessages.filter(m =>
      m.subject.toLowerCase().includes(search) ||
      (m.body_snippet?.toLowerCase().includes(search))
    )
  }

  // Separate by category for display
  const critical = allMessages.filter(m => m.category === 'critical')
  const important = allMessages.filter(m => m.category === 'important')
  const maintenance = allMessages.filter(m => m.category === 'maintenance')
  const security = allMessages.filter(m => m.category === 'security')

  // Get recent critical (last 7 days)
  const recentCritical = critical.filter(m => {
    const date = new Date(m.received_at)
    const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 7
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">BuildingLink</h1>
            <p className="text-lg text-muted-foreground">
              North Edge (Brooklyn PH2E & PH2F) - {stats.total.toLocaleString()} messages
            </p>
          </div>
        </div>
        <Link
          href="https://www.buildinglink.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Open BuildingLink <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={stats.critical > 0 ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${stats.critical > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Service outages, emergencies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              Important
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.important}</div>
            <p className="text-xs text-muted-foreground">Notices, meetings, policies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.maintenance}</div>
            <p className="text-xs text-muted-foreground">Request updates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4 text-green-500" />
              Security Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.security}</div>
            <p className="text-xs text-muted-foreground">Key access events</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Critical Alerts */}
      {recentCritical.length > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Recent Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCritical.slice(0, 5).map((msg) => (
                <div key={msg.id} className="flex items-start justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-red-700 dark:text-red-400">{msg.subject}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {msg.body_snippet}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {formatDistanceToNow(new Date(msg.received_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <BuildingLinkFilters
        currentCategory={params.category || 'important'}
        currentUnit={params.unit}
        currentSearch={params.search}
      />

      {/* Main Content Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Important & Maintenance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Important Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" />
                  Important Updates
                </span>
                <Badge variant="outline">{important.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MessageList messages={important.slice(0, 10)} showCategory={false} />
              {important.length > 10 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  + {important.length - 10} more important messages
                </p>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-blue-500" />
                  Maintenance Requests
                </span>
                <Badge variant="outline">{maintenance.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MessageList messages={maintenance.slice(0, 10)} showCategory={false} />
              {maintenance.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No maintenance requests on file
                </p>
              )}
            </CardContent>
          </Card>

          {/* All Messages (filtered) */}
          {(params.category === 'all' || params.category === 'routine' || params.category === 'noise' || params.search) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {params.search ? `Search Results: "${params.search}"` : 'All Messages'}
                  </span>
                  <Badge variant="outline">{filteredMessages.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MessageList messages={filteredMessages.slice(0, 50)} showCategory={true} />
                {filteredMessages.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Showing 50 of {filteredMessages.length} messages
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Security Log */}
        <div className="space-y-6">
          <SecurityLog messages={security} />
        </div>
      </div>
    </div>
  )
}
