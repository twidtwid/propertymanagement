"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarVendorButtonProps {
  vendorId: string
  isStarred: boolean
  size?: "sm" | "default" | "lg" | "icon"
  variant?: "ghost" | "outline" | "default"
  className?: string
  onToggle?: (isStarred: boolean) => void
}

export function StarVendorButton({
  vendorId,
  isStarred: initialStarred,
  size = "icon",
  variant = "ghost",
  className,
  onToggle,
}: StarVendorButtonProps) {
  const [isStarred, setIsStarred] = useState(initialStarred)
  const [isPending, startTransition] = useTransition()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    startTransition(async () => {
      try {
        const response = await fetch("/api/vendors/star", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorId }),
        })

        if (response.ok) {
          const data = await response.json()
          setIsStarred(data.isStarred)
          onToggle?.(data.isStarred)
        }
      } catch (error) {
        console.error("Failed to toggle vendor star:", error)
      }
    })
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("shrink-0", className)}
      onClick={handleClick}
      disabled={isPending}
      title={isStarred ? "Remove from pinned vendors" : "Pin vendor to top"}
    >
      <Star
        className={cn(
          "h-4 w-4",
          isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
        )}
      />
    </Button>
  )
}
