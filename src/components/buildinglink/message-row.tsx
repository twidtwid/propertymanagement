"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow } from "date-fns"
import type { BuildingLinkMessage, BuildingLinkCategory } from "@/lib/actions"
import {
  AlertTriangle,
  Bell,
  Wrench,
  Key,
  Package,
  Calendar,
  Users,
  Star,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  CloudRain,
  Check,
} from "lucide-react"

interface MessageRowProps {
  message: BuildingLinkMessage
  onFlag?: (messageId: string) => Promise<void>
  showTime?: boolean
  showDate?: boolean
  compact?: boolean
}

const CATEGORY_CONFIG: Record<BuildingLinkCategory, {
  icon: typeof AlertTriangle
  color: string
  borderColor: string
}> = {
  critical: { icon: AlertTriangle, color: 'text-red-600', borderColor: 'border-l-red-500' },
  important: { icon: Bell, color: 'text-amber-500', borderColor: 'border-l-amber-500' },
  maintenance: { icon: Wrench, color: 'text-blue-500', borderColor: 'border-l-blue-500' },
  security: { icon: Key, color: 'text-green-500', borderColor: 'border-l-green-500' },
  package: { icon: Package, color: 'text-purple-500', borderColor: 'border-l-purple-500' },
  routine: { icon: Calendar, color: 'text-gray-500', borderColor: 'border-l-gray-400' },
  social: { icon: Users, color: 'text-gray-400', borderColor: 'border-l-gray-300' },
  noise: { icon: Calendar, color: 'text-gray-400', borderColor: 'border-l-gray-300' },
}

// Get more specific icon based on subcategory
function getIcon(category: BuildingLinkCategory, subcategory: string) {
  if (subcategory === 'weather_alert') return CloudRain
  if (subcategory === 'service_restored') return Check
  if (subcategory === 'key_out') return LogOut
  if (subcategory === 'key_returned') return LogIn
  if (subcategory === 'package_pickup') return Check
  return CATEGORY_CONFIG[category].icon
}

export function MessageRow({ message, onFlag, showTime = true, showDate = false, compact = false }: MessageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFlagged, setIsFlagged] = useState(message.is_flagged || false)
  const [isPending, startTransition] = useTransition()

  const config = CATEGORY_CONFIG[message.category]
  const Icon = getIcon(message.category, message.subcategory)
  const isPickup = message.subcategory === 'package_pickup'
  const isRestored = message.subcategory === 'service_restored'

  const handleFlag = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onFlag) {
      startTransition(async () => {
        await onFlag(message.id)
        setIsFlagged(!isFlagged)
      })
    }
  }

  return (
    <div
      className={cn(
        "border-l-4 rounded-r-lg transition-colors",
        config.borderColor,
        isExpanded ? "bg-muted/50" : "hover:bg-muted/30",
        (isPickup || isRestored) && "opacity-60"
      )}
    >
      {/* Main Row */}
      <div
        className={cn(
          "flex items-center gap-2 cursor-pointer",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon className={cn("h-4 w-4 shrink-0", config.color)} />

        {showTime && (
          <span className={cn(
            "text-xs text-muted-foreground shrink-0",
            showDate ? "w-28" : "w-16"
          )}>
            {format(new Date(message.received_at), showDate ? 'MMM d, h:mm a' : 'h:mm a')}
          </span>
        )}

        <span className={cn(
          "flex-1 text-sm truncate",
          compact ? "font-normal" : "font-medium"
        )}>
          {message.subject}
        </span>

        {message.unit !== 'unknown' && (
          <Badge variant="outline" className="text-xs shrink-0">
            {message.unit === 'both' ? 'Both' : message.unit}
          </Badge>
        )}

        {onFlag && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={handleFlag}
            disabled={isPending}
          >
            <Star
              className={cn(
                "h-4 w-4",
                isFlagged ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
              )}
            />
          </Button>
        )}

        {message.body_html && (
          <div className="shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-muted">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <span>{format(new Date(message.received_at), 'EEEE, MMMM d, yyyy at h:mm a')}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(message.received_at), { addSuffix: true })}</span>
          </div>
          {message.body_html ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: message.body_html }}
            />
          ) : message.body_snippet ? (
            <p className="text-sm whitespace-pre-wrap">{message.body_snippet}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No additional details</p>
          )}
        </div>
      )}
    </div>
  )
}
