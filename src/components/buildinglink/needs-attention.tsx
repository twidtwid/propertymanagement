"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NeedsAttentionItems, BuildingLinkMessage } from "@/lib/actions"
import { MessageRow } from "./message-row"
import {
  AlertTriangle,
  Package,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface NeedsAttentionProps {
  items: NeedsAttentionItems
}

export function NeedsAttention({ items }: NeedsAttentionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const totalCount =
    items.activeOutages.length +
    items.uncollectedPackages.length +
    items.flaggedMessages.length

  // Deduplicate flagged messages that might also be in outages or packages
  const flaggedOnly = items.flaggedMessages.filter(
    (m) =>
      !items.activeOutages.some((o) => o.id === m.id) &&
      !items.uncollectedPackages.some((p) => p.id === m.id)
  )

  const isEmpty = totalCount === 0

  if (isEmpty) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            All Clear
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            No active outages, uncollected packages, or flagged items
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
      <CardHeader className="pb-2">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-amber-200 text-amber-800">
              {totalCount}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Active Outages */}
          {items.activeOutages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                <span className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">
                  Active Outages
                </span>
              </div>
              <div className="space-y-1">
                {items.activeOutages.map((msg) => (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    showDate
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Uncollected Packages */}
          {items.uncollectedPackages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wide">
                  Uncollected Packages
                </span>
              </div>
              <div className="space-y-1">
                {items.uncollectedPackages.map((msg) => (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    showDate
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Flagged Messages */}
          {flaggedOnly.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-3.5 w-3.5 text-yellow-600 fill-yellow-400" />
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                  Flagged
                </span>
              </div>
              <div className="space-y-1">
                {flaggedOnly.map((msg) => (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    showDate
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
