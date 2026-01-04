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

const INSURANCE_TYPES = [
  { value: "homeowners", label: "Homeowners" },
  { value: "auto", label: "Auto" },
  { value: "umbrella", label: "Umbrella" },
  { value: "flood", label: "Flood" },
  { value: "earthquake", label: "Earthquake" },
  { value: "liability", label: "Liability" },
  { value: "other", label: "Other" },
]

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
]

interface InsuranceFiltersProps {
  carriers: string[]
}

export function InsuranceFilters({ carriers }: InsuranceFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const policyType = searchParams.get("type") || "all"
  const carrier = searchParams.get("carrier") || "all"
  const status = searchParams.get("status") || "all"
  const search = searchParams.get("search") || ""

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "all" || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.push(`/insurance?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push("/insurance")
  }, [router])

  const hasFilters = policyType !== "all" || carrier !== "all" || status !== "all" || search !== ""

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={policyType} onValueChange={(v) => updateFilter("type", v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {INSURANCE_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={carrier} onValueChange={(v) => updateFilter("carrier", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Carriers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Carriers</SelectItem>
          {carriers.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
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
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search policies..."
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
  )
}
