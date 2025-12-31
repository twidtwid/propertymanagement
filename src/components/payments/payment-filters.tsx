"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import type { Property } from "@/types/database"
import { BILL_TYPE_LABELS, PAYMENT_STATUS_LABELS } from "@/types/database"

interface PaymentFiltersProps {
  properties: Property[]
}

export function PaymentFilters({ properties }: PaymentFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const category = searchParams.get("category") || "all"
  const status = searchParams.get("status") || "all"
  const propertyId = searchParams.get("propertyId") || "all"
  const search = searchParams.get("search") || ""

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "all" || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.push(`/payments?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push("/payments")
  }, [router])

  const applyPreset = useCallback(
    (preset: string) => {
      const params = new URLSearchParams()
      switch (preset) {
        case "needs-attention":
          params.set("status", "overdue")
          break
        case "this-week":
          // Server will handle date filtering
          params.set("dateRange", "week")
          break
        case "unconfirmed":
          params.set("status", "sent")
          break
      }
      router.push(`/payments?${params.toString()}`)
    },
    [router]
  )

  const hasFilters = category !== "all" || status !== "all" || propertyId !== "all" || search !== ""

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={category} onValueChange={(v) => updateFilter("category", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(BILL_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={propertyId} onValueChange={(v) => updateFilter("propertyId", v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyPreset("needs-attention")}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          Needs Attention
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyPreset("this-week")}
        >
          Due This Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyPreset("unconfirmed")}
          className="text-amber-600 border-amber-200 hover:bg-amber-50"
        >
          Unconfirmed Checks
        </Button>
      </div>
    </div>
  )
}
