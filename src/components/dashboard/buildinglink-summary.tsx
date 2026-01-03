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
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Building2 className="h-5 w-5" />
          BuildingLink
          <Badge variant="secondary" className="ml-2">
            {items.length}
          </Badge>
        </CardTitle>
        <Link
          href="/buildinglink"
          className="text-sm text-amber-700 hover:text-amber-900 flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Outages */}
        {outages.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-red-100 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {outages.length} active outage{outages.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Packages */}
        {packages.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-purple-100 text-purple-800">
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
