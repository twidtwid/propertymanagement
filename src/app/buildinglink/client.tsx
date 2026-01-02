"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { BuildingLinkMessage, NeedsAttentionItems } from "@/lib/actions"
import { NeedsAttention } from "@/components/buildinglink/needs-attention"
import { Timeline } from "@/components/buildinglink/timeline"
import {
  Search,
  Activity,
  Key,
  Package,
  Users,
} from "lucide-react"

interface BuildingLinkClientProps {
  messages: BuildingLinkMessage[]
  needsAttention: NeedsAttentionItems
  currentTab: string
  showSocial: boolean
  searchQuery: string
}

const TABS = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "security", label: "Security", icon: Key },
  { id: "packages", label: "Packages", icon: Package },
]

export function BuildingLinkClient({
  messages,
  needsAttention,
  currentTab,
  showSocial,
  searchQuery,
}: BuildingLinkClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)

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

  // Handle social toggle
  const handleSocialToggle = (checked: boolean) => {
    updateParams({ social: checked ? "true" : undefined })
  }

  // Handle flag toggle
  const handleFlag = async (messageId: string) => {
    const response = await fetch("/api/buildinglink/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    })
    if (response.ok) {
      // Refresh to get updated data
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* Needs Attention */}
      <NeedsAttention items={needsAttention} onFlag={handleFlag} />

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

        {/* Search and Social toggle */}
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

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox
              checked={showSocial}
              onCheckedChange={handleSocialToggle}
            />
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Social</span>
          </label>
        </div>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="h-1 w-full bg-muted overflow-hidden rounded">
          <div className="h-full w-1/3 bg-primary animate-pulse" />
        </div>
      )}

      {/* Message Timeline */}
      <Timeline messages={messages} onFlag={handleFlag} />
    </div>
  )
}
