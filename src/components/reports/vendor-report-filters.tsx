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
import { X } from "lucide-react"
import { VENDOR_SPECIALTY_LABELS, type VendorSpecialty, type Property } from "@/types/database"

interface VendorReportFiltersProps {
  regions: string[]
  specialties: string[]
  properties: Property[]
}

export function VendorReportFilters({
  regions,
  specialties,
  properties,
}: VendorReportFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const specialty = searchParams?.get("specialty") || "all"
  const region = searchParams?.get("region") || "all"
  const property = searchParams?.get("property") || "all"
  const groupBy = searchParams?.get("groupBy") || "vendor"

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "")
      if (value === "all" || value === "" || (key === "groupBy" && value === "vendor")) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.push(`/reports/vendors?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push("/reports/vendors")
  }, [router])

  const hasFilters = specialty !== "all" || region !== "all" || property !== "all" || groupBy !== "vendor"

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={groupBy} onValueChange={(v) => updateFilter("groupBy", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Group by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="vendor">By Vendor</SelectItem>
          <SelectItem value="region">By Region</SelectItem>
          <SelectItem value="property">By Property</SelectItem>
          <SelectItem value="specialty">By Specialty</SelectItem>
        </SelectContent>
      </Select>

      <Select value={specialty} onValueChange={(v) => updateFilter("specialty", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Specialties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Specialties</SelectItem>
          {specialties.map((s) => (
            <SelectItem key={s} value={s}>
              {VENDOR_SPECIALTY_LABELS[s as VendorSpecialty] || s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={region} onValueChange={(v) => updateFilter("region", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Regions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={property} onValueChange={(v) => updateFilter("property", v)}>
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

      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
