"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Pin,
  Zap,
  Star,
  CreditCard,
  Building2,
  Shield,
  Wrench,
  User,
  FileText,
  Building,
  ArrowRight,
  X,
} from "lucide-react"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import type { DashboardPinnedItem, DashboardPinStatus } from "@/types/database"
import { useToast } from "@/hooks/use-toast"

interface UnifiedPinnedItemsProps {
  items: DashboardPinnedItem[]
}

const iconMap = {
  bill: CreditCard,
  tax: Building2,
  insurance: Shield,
  ticket: Wrench,
  vendor: User,
  document: FileText,
  building: Building,
}

const statusStyles: Record<DashboardPinStatus, { border: string; badge: string; badgeVariant: "destructive" | "warning" | "secondary" | "default" }> = {
  overdue: { border: "border-l-red-500", badge: "OVERDUE", badgeVariant: "destructive" },
  urgent: { border: "border-l-amber-500", badge: "", badgeVariant: "warning" },
  upcoming: { border: "border-l-blue-500", badge: "", badgeVariant: "secondary" },
  normal: { border: "border-l-gray-300", badge: "", badgeVariant: "default" },
}

export function UnifiedPinnedItems({ items: initialItems }: UnifiedPinnedItemsProps) {
  const [items, setItems] = useState(initialItems)
  const [dismissing, setDismissing] = useState<string | null>(null)
  const { toast } = useToast()

  if (items.length === 0) {
    return null
  }

  const handleDismiss = async (item: DashboardPinnedItem) => {
    setDismissing(item.id)

    try {
      const response = await fetch("/api/pinned/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: item.entityType,
          entityId: item.entityId,
        }),
      })

      if (response.ok) {
        // Remove from local state
        setItems((prev) => prev.filter((i) => i.id !== item.id))

        // Show toast with undo for smart pins
        if (item.pinType === "smart") {
          toast({
            title: "Smart pin dismissed",
            description: item.title,
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Undo the dismissal
                  await fetch("/api/pinned/undo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      entityType: item.entityType,
                      entityId: item.entityId,
                    }),
                  })
                  // Add back to state
                  setItems((prev) => [...prev, item].sort(sortItems))
                }}
              >
                Undo
              </Button>
            ),
          })
        }
      }
    } catch (error) {
      console.error("Failed to dismiss:", error)
    } finally {
      setDismissing(null)
    }
  }

  const sortItems = (a: DashboardPinnedItem, b: DashboardPinnedItem) => {
    const statusOrder: Record<DashboardPinStatus, number> = {
      overdue: 0,
      urgent: 1,
      upcoming: 2,
      normal: 3,
    }
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    if (a.daysUntilOrOverdue === null && b.daysUntilOrOverdue === null) return 0
    if (a.daysUntilOrOverdue === null) return 1
    if (b.daysUntilOrOverdue === null) return -1
    return a.daysUntilOrOverdue - b.daysUntilOrOverdue
  }

  const getDaysBadgeText = (item: DashboardPinnedItem): string | null => {
    if (item.daysUntilOrOverdue === null) return null
    if (item.status === "overdue") {
      return `${Math.abs(item.daysUntilOrOverdue)}d overdue`
    }
    if (item.daysUntilOrOverdue === 0) return "Today"
    if (item.daysUntilOrOverdue === 1) return "Tomorrow"
    return `${item.daysUntilOrOverdue}d`
  }

  return (
    <Card id="pinned-items">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Pin className="h-5 w-5" />
          Needs Attention
          <Badge variant="secondary" className="ml-2">
            {items.length}
          </Badge>
        </CardTitle>
        <Link
          href="/payments"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View All Payments
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = iconMap[item.icon]
          const style = statusStyles[item.status]

          return (
            <div
              key={`${item.entityType}-${item.id}`}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border-l-4 bg-card hover:bg-muted/50 transition-colors",
                style.border
              )}
            >
              {/* Pin Type Indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {item.pinType === "smart" ? (
                  <Zap className="h-4 w-4 text-orange-500" />
                ) : (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>

              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <Link href={item.href} className="hover:underline">
                  <p className="font-medium truncate">{item.title}</p>
                </Link>
                {item.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">
                    {item.subtitle}
                  </p>
                )}
                {/* Notes */}
                {item.notes.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {item.notes.slice(0, 2).map((note) => (
                      <p
                        key={note.id}
                        className="text-xs text-muted-foreground italic truncate"
                      >
                        "{note.note}" — {note.user_name}
                      </p>
                    ))}
                    {item.notes.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{item.notes.length - 2} more notes
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Amount & Badge */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.amount !== null && (
                  <span className="font-semibold">
                    {formatCurrency(item.amount)}
                  </span>
                )}
                {getDaysBadgeText(item) && (
                  <Badge variant={style.badgeVariant}>
                    {item.status === "overdue" ? style.badge : getDaysBadgeText(item)}
                  </Badge>
                )}
              </div>

              {/* Dismiss Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => handleDismiss(item)}
                disabled={dismissing === item.id}
                title={item.pinType === "smart" ? "Dismiss" : "Unpin"}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
