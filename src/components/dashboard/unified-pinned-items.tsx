"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Pin,
  Star,
  CreditCard,
  Building2,
  Shield,
  Wrench,
  User,
  FileText,
  Building,
  ArrowRight,
  MessageSquare,
} from "lucide-react"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import type { DashboardPinnedItem, DashboardPinStatus, PinNote } from "@/types/database"
import { useToast } from "@/hooks/use-toast"
import { PinNoteButton } from "@/components/ui/pin-note-button"

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
  buildinglink: MessageSquare,
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
  const [userNotesMap, setUserNotesMap] = useState<Record<string, PinNote>>({})
  const { toast } = useToast()

  if (items.length === 0) {
    return null
  }

  // Refresh notes for a specific item
  const refreshNotes = async (entityType: string, entityId: string) => {
    try {
      const response = await fetch(`/api/pin-notes?entityType=${entityType}&entityId=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        // Update the item's notes in the items array
        setItems((prev) =>
          prev.map((item) =>
            item.entityType === entityType && item.entityId === entityId
              ? { ...item, notes: data.notes || [] }
              : item
          )
        )
        // Update user note
        setUserNotesMap((prev) => ({
          ...prev,
          [`${entityType}:${entityId}`]: data.userNote || null,
        }))
      }
    } catch (error) {
      console.error("Failed to refresh notes:", error)
    }
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
              {/* Pin and Note buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Pin indicator - clickable to dismiss/unpin */}
                <button
                  onClick={() => handleDismiss(item)}
                  disabled={dismissing === item.id}
                  className="hover:opacity-70 transition-opacity"
                  title={item.pinType === "smart" ? "Dismiss smart pin" : "Unpin"}
                >
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                </button>

                {/* Note button */}
                <PinNoteButton
                  entityType={item.entityType}
                  entityId={item.entityId}
                  existingNote={userNotesMap[`${item.entityType}:${item.entityId}`]}
                  onNoteSaved={() => refreshNotes(item.entityType, item.entityId)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                />
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
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
