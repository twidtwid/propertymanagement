import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Package, AlertTriangle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BuildingLinkItem {
  type: "outage" | "package" | "flagged"
  subject: string
  unit: string
  receivedAt: string
  snippet?: string
}

interface BuildingLinkSummaryProps {
  items: BuildingLinkItem[]
}

export function BuildingLinkSummary({ items }: BuildingLinkSummaryProps) {
  if (items.length === 0) {
    return null
  }

  const outages = items.filter((i) => i.type === "outage")
  const packages = items.filter((i) => i.type === "package")
  const flagged = items.filter((i) => i.type === "flagged")

  return (
    <Card className="border-purple-500/30 bg-purple-500/10">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <Building2 className="h-5 w-5" />
          BuildingLink
          <Badge variant="secondary" className="ml-2">
            {items.length}
          </Badge>
        </CardTitle>
        <Link
          href="/buildinglink"
          className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Outages */}
        {outages.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-red-500/20 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {outages.length} active outage{outages.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Packages */}
        {packages.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
            <Package className="h-4 w-4" />
            <span className="text-sm font-medium">
              {packages.length} package{packages.length > 1 ? "s" : ""} waiting
            </span>
          </div>
        )}

        {/* Flagged items summary */}
        {flagged.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {flagged.length} flagged item{flagged.length > 1 ? "s" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
