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
import {
  TASK_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type Property,
  type Vendor,
  type TaskPriority,
  type TaskStatus,
} from "@/types/database"

interface TicketReportFiltersProps {
  properties: Property[]
  vendors: Vendor[]
}

export function TicketReportFilters({ properties, vendors }: TicketReportFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const property = searchParams?.get("property") || "all"
  const vendor = searchParams?.get("vendor") || "all"
  const status = searchParams?.get("status") || "all"
  const priority = searchParams?.get("priority") || "all"
  const sortBy = searchParams?.get("sortBy") || "date"
  const view = searchParams?.get("view") || "list"

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "")
      if (value === "all" || value === "" || (key === "sortBy" && value === "date") || (key === "view" && value === "list")) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.push(`/reports/tickets?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push("/reports/tickets")
  }, [router])

  const hasFilters = property !== "all" || vendor !== "all" || status !== "all" || priority !== "all" || sortBy !== "date" || view !== "list"

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={view} onValueChange={(v) => updateFilter("view", v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="View" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="list">List View</SelectItem>
          <SelectItem value="byProperty">By Property</SelectItem>
          <SelectItem value="byVendor">By Vendor</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(v) => updateFilter("sortBy", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Date</SelectItem>
          <SelectItem value="property">Property</SelectItem>
          <SelectItem value="vendor">Vendor</SelectItem>
          <SelectItem value="priority">Priority</SelectItem>
          <SelectItem value="status">Status</SelectItem>
        </SelectContent>
      </Select>

      <Select value={property} onValueChange={(v) => updateFilter("property", v)}>
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

      <Select value={vendor} onValueChange={(v) => updateFilter("vendor", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Vendors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Vendors</SelectItem>
          {vendors.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.company || v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => updateFilter("status", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {(Object.entries(TICKET_STATUS_LABELS) as [TaskStatus, string][]).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={priority} onValueChange={(v) => updateFilter("priority", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
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
