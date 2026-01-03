"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { BuildingLinkMessage } from "@/lib/actions"
import type { PinNote } from "@/types/database"
import { PinnedSection } from "@/components/ui/pinned-section"
import { PinNotes } from "@/components/ui/pin-notes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageRow } from "@/components/buildinglink/message-row"
import { Timeline } from "@/components/buildinglink/timeline"
import {
  Search,
  Activity,
  Key,
  Package,
} from "lucide-react"

interface BuildingLinkClientProps {
  messages: BuildingLinkMessage[]
  smartPins: string[]
  userPins: string[]
  uncollectedPackages: BuildingLinkMessage[]
  currentTab: string
  searchQuery: string
  initialNotesMap: Record<string, PinNote[]>
  initialUserNotesMap: Record<string, PinNote>
}

const TABS = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "security", label: "Security", icon: Key },
  { id: "packages", label: "Packages", icon: Package },
]

export function BuildingLinkClient({
  messages,
  smartPins: initialSmartPins,
  userPins: initialUserPins,
  uncollectedPackages,
  currentTab,
  searchQuery,
  initialNotesMap,
  initialUserNotesMap,
}: BuildingLinkClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [smartPins, setSmartPins] = useState<Set<string>>(new Set(initialSmartPins))
  const [userPins, setUserPins] = useState<Set<string>>(new Set(initialUserPins))
  const [notesMap, setNotesMap] = useState<Record<string, PinNote[]>>(initialNotesMap)
  const [userNotesMap, setUserNotesMap] = useState<Record<string, PinNote>>(initialUserNotesMap)

  const allPinnedIds = new Set([...Array.from(smartPins), ...Array.from(userPins)])

  // Refresh notes for a specific entity
  const refreshNotes = async (entityId: string) => {
    try {
      const response = await fetch(`/api/pin-notes?entityType=buildinglink_message&entityId=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        setNotesMap((prev) => ({
          ...prev,
          [entityId]: data.notes || [],
        }))
        setUserNotesMap((prev) => ({
          ...prev,
          [entityId]: data.userNote || null,
        }))
      }
    } catch (error) {
      console.error("Failed to refresh notes:", error)
    }
  }

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      startTransition(() => {
        router.push(`/buildinglink?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  // Handle tab change
  const handleTabChange = (tab: string) => {
    updateParams({ tab: tab === "activity" ? undefined : tab })
  }

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search: search || undefined })
  }

  // Handle pin toggle
  const handleTogglePin = (messageId: string, isPinned: boolean) => {
    if (isPinned) {
      // Adding a pin - always goes to user pins
      setUserPins((prev) => new Set(prev).add(messageId))
    } else {
      // Removing a pin - could be from either smart or user pins
      setSmartPins((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
      setUserPins((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }

  // Separate messages into smart pins, user pins, and unpinned
  const smartPinMessages = messages.filter(m => smartPins.has(m.id))
  const userPinMessages = messages.filter(m => !smartPins.has(m.id) && userPins.has(m.id))
  const unpinnedMessages = messages.filter(m => !allPinnedIds.has(m.id))

  return (
    <div className="space-y-4">
      {/* Smart Pins */}
      {smartPinMessages.length > 0 && (
        <PinnedSection count={smartPinMessages.length} title="Smart Pins" variant="smart">
          <div className="space-y-2">
            {smartPinMessages.map((message) => (
              <div key={message.id}>
                <MessageRow
                  message={{ ...message, is_flagged: true }}
                  showDate
                  onTogglePin={handleTogglePin}
                  userNote={userNotesMap[message.id]}
                  onNoteSaved={() => refreshNotes(message.id)}
                />
                {(notesMap[message.id] || []).length > 0 && (
                  <div className="mt-2 ml-12">
                    <PinNotes
                      notes={notesMap[message.id] || []}
                      onNoteDeleted={() => refreshNotes(message.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </PinnedSection>
      )}

      {/* User Pins */}
      {userPinMessages.length > 0 && (
        <PinnedSection count={userPinMessages.length} title="User Pins" variant="user">
          <div className="space-y-2">
            {userPinMessages.map((message) => (
              <div key={message.id}>
                <MessageRow
                  message={{ ...message, is_flagged: true }}
                  showDate
                  onTogglePin={handleTogglePin}
                  userNote={userNotesMap[message.id]}
                  onNoteSaved={() => refreshNotes(message.id)}
                />
                {(notesMap[message.id] || []).length > 0 && (
                  <div className="mt-2 ml-12">
                    <PinNotes
                      notes={notesMap[message.id] || []}
                      onNoteDeleted={() => refreshNotes(message.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </PinnedSection>
      )}

      {/* Uncollected Packages */}
      {uncollectedPackages.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Uncollected Packages
              </CardTitle>
              <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                {uncollectedPackages.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {uncollectedPackages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                showDate
                compact
                onTogglePin={handleTogglePin}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex-1 sm:flex-initial">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full sm:w-48"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="h-1 w-full bg-muted overflow-hidden rounded">
          <div className="h-full w-1/3 bg-primary animate-pulse" />
        </div>
      )}

      {/* Message Timeline */}
      <Timeline messages={unpinnedMessages} onTogglePin={handleTogglePin} />
    </div>
  )
}
