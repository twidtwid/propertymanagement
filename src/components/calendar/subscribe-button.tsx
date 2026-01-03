"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Calendar, Copy, Check, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function CalendarSubscribeButton() {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // Build the webcal URL (webcal:// protocol opens calendar apps)
  const feedUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/calendar/feed`
    : "/api/calendar/feed"

  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      toast({
        title: "URL copied",
        description: "Calendar feed URL copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      })
    }
  }

  const handleSubscribe = () => {
    // Open the webcal URL which should trigger the calendar app
    window.location.href = webcalUrl
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          Subscribe
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm">Subscribe to Calendar</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Add this calendar to Apple Calendar, Google Calendar, or Outlook to see all your payments and deadlines.
            </p>
          </div>

          <div className="space-y-3">
            <Button onClick={handleSubscribe} className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Calendar App
            </Button>

            <div className="relative">
              <p className="text-xs text-muted-foreground mb-1.5">
                Or copy the URL to subscribe manually:
              </p>
              <div className="flex gap-2">
                <Input
                  value={feedUrl}
                  readOnly
                  className="text-xs font-mono pr-10"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground border-t pt-3">
            <p className="font-medium mb-1">How to subscribe:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Apple Calendar:</strong> Click &quot;Open in Calendar App&quot; or File &gt; New Calendar Subscription</li>
              <li><strong>Google Calendar:</strong> Settings &gt; Add calendar &gt; From URL</li>
              <li><strong>Outlook:</strong> Add calendar &gt; Subscribe from web</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
