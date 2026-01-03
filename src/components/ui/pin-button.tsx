"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Star, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PinnedEntityType } from "@/types/database"

interface PinButtonProps {
  entityType: PinnedEntityType
  entityId: string
  isPinned: boolean
  pinType?: "smart" | "user"  // Indicates if this is a smart pin (orange) or user pin (yellow)
  metadata?: Record<string, any>
  size?: "sm" | "default" | "lg" | "icon"
  variant?: "ghost" | "outline" | "default"
  className?: string
  onToggle?: (isPinned: boolean) => void
  tooltip?: string
}

/**
 * Reusable pin button component for all entity types
 * Shared pins - all users see the same pinned items
 */
export function PinButton({
  entityType,
  entityId,
  isPinned: initialPinned,
  pinType = "user",
  metadata,
  size = "icon",
  variant = "ghost",
  className,
  onToggle,
  tooltip,
}: PinButtonProps) {
  const [isPinned, setIsPinned] = useState(initialPinned)
  const [isPending, startTransition] = useTransition()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    startTransition(async () => {
      try {
        const response = await fetch("/api/pinned/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId, metadata }),
        })

        if (response.ok) {
          const data = await response.json()
          setIsPinned(data.isPinned)
          onToggle?.(data.isPinned)
        } else {
          console.error("Failed to toggle pin:", await response.text())
        }
      } catch (error) {
        console.error("Pin toggle error:", error)
      }
    })
  }

  // Smart pins (orange) vs User pins (yellow)
  const fillColor = isPinned
    ? (pinType === 'smart' ? 'fill-orange-400 text-orange-400' : 'fill-yellow-400 text-yellow-400')
    : 'text-muted-foreground'

  const defaultTooltip = isPinned
    ? (pinType === 'smart' ? "Dismiss smart pin" : "Remove pin (shared with all users)")
    : "Pin for all users"

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("shrink-0", className)}
      onClick={handleClick}
      disabled={isPending}
      title={tooltip || defaultTooltip}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Star className={cn("h-4 w-4 transition-colors", fillColor)} />
      )}
    </Button>
  )
}
