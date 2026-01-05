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
import { PAYMENT_STATUS_LABELS } from "@/types/database"

interface TaxFiltersProps {
  properties: Property[]
  jurisdictions: string[]
}

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const year = new Date().getFullYear() + 1 - i
  return { value: String(year), label: String(year) }
})

export function TaxFilters({ properties, jurisdictions }: TaxFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const status = searchParams?.get("status") || "all"
  const propertyId = searchParams?.get("propertyId") || "all"
  const jurisdiction = searchParams?.get("jurisdiction") || "all"
  const year = searchParams?.get("year") || "all"
  const search = searchParams?.get("search") || ""

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "")
      if (value === "all" || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.push(`/payments/taxes?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push("/payments/taxes")
  }, [router])

  const hasFilters = status !== "all" || propertyId !== "all" || jurisdiction !== "all" || year !== "all" || search !== ""

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={propertyId} onValueChange={(v) => updateFilter("propertyId", v)}>
        <SelectTrigger className="w-[180px]">
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

      <Select value={jurisdiction} onValueChange={(v) => updateFilter("jurisdiction", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Jurisdictions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Jurisdictions</SelectItem>
          {jurisdictions.map((j) => (
            <SelectItem key={j} value={j}>
              {j}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={(v) => updateFilter("year", v)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="All Years" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y.value} value={y.value}>
              {y.label}
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
          placeholder="Search taxes..."
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
