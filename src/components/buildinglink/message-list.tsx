"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDistanceToNow, format } from "date-fns"
import type { BuildingLinkMessage, BuildingLinkCategory } from "@/lib/actions"
import {
  AlertTriangle,
  Bell,
  Wrench,
  Key,
  Package,
  Calendar,
  ChevronRight,
} from "lucide-react"

interface MessageListProps {
  messages: BuildingLinkMessage[]
  showCategory?: boolean
}

const CATEGORY_CONFIG: Record<BuildingLinkCategory, { icon: typeof AlertTriangle; color: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-red-600', label: 'Critical' },
  important: { icon: Bell, color: 'text-amber-500', label: 'Important' },
  maintenance: { icon: Wrench, color: 'text-blue-500', label: 'Maintenance' },
  security: { icon: Key, color: 'text-green-500', label: 'Security' },
  routine: { icon: Calendar, color: 'text-gray-500', label: 'Routine' },
  noise: { icon: Package, color: 'text-gray-400', label: 'Package' },
}

export function MessageList({ messages, showCategory = true }: MessageListProps) {
  const [selectedMessage, setSelectedMessage] = useState<BuildingLinkMessage | null>(null)

  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No messages found
      </p>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {messages.map((msg) => {
          const config = CATEGORY_CONFIG[msg.category]
          const Icon = config.icon

          return (
            <div
              key={msg.id}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => setSelectedMessage(msg)}
            >
              {showCategory && (
                <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm line-clamp-1">{msg.subject}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {msg.unit !== 'unknown' && (
                      <Badge variant="outline" className="text-xs">
                        {msg.unit === 'both' ? 'Both' : msg.unit}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                  {msg.body_snippet}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.received_at), { addSuffix: true })}
                  </span>
                  {showCategory && (
                    <Badge variant="secondary" className="text-xs">
                      {msg.subcategory}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
            </div>
          )
        })}
      </div>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedMessage && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const config = CATEGORY_CONFIG[selectedMessage.category]
                    const Icon = config.icon
                    return <Icon className={`h-5 w-5 ${config.color}`} />
                  })()}
                  <Badge variant="outline">{selectedMessage.subcategory}</Badge>
                  {selectedMessage.unit !== 'unknown' && (
                    <Badge variant="secondary">
                      {selectedMessage.unit === 'both' ? 'Both Units' : selectedMessage.unit}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-left">
                  {selectedMessage.subject}
                </DialogTitle>
                <p className="text-sm text-muted-foreground text-left">
                  {format(new Date(selectedMessage.received_at), 'EEEE, MMMM d, yyyy at h:mm a')}
                </p>
              </DialogHeader>

              <div className="mt-4">
                {selectedMessage.body_html ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.body_html }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedMessage.body_snippet}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
