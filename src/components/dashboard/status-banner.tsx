"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusBannerProps {
  overdueCount: number
  urgentCount: number
  hasItems: boolean
  nextDueDate?: string
  nextDueDescription?: string
}

export function StatusBanner({
  overdueCount,
  urgentCount,
  hasItems,
  nextDueDate,
  nextDueDescription,
}: StatusBannerProps) {
  const hasUrgent = overdueCount > 0 || urgentCount > 0

  if (hasUrgent) {
    // Warning state - items need attention
    const parts: string[] = []
    if (overdueCount > 0) parts.push(`${overdueCount} overdue`)
    if (urgentCount > 0) parts.push(`${urgentCount} due soon`)
    const message = parts.join(" • ")

    return (
      <div
        className={cn(
          "rounded-lg border-l-4 p-4",
          overdueCount > 0
            ? "bg-red-50 border-red-500"
            : "bg-amber-50 border-amber-500"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={cn(
                "h-6 w-6",
                overdueCount > 0 ? "text-red-600" : "text-amber-600"
              )}
            />
            <div>
              <h2
                className={cn(
                  "text-lg font-semibold",
                  overdueCount > 0 ? "text-red-800" : "text-amber-800"
                )}
              >
                {overdueCount > 0 && urgentCount > 0
                  ? `${overdueCount + urgentCount} items need attention`
                  : overdueCount > 0
                  ? `${overdueCount} item${overdueCount > 1 ? "s" : ""} overdue`
                  : `${urgentCount} item${urgentCount > 1 ? "s" : ""} due soon`}
              </h2>
              <p
                className={cn(
                  "text-sm",
                  overdueCount > 0 ? "text-red-700" : "text-amber-700"
                )}
              >
                {message}
              </p>
            </div>
          </div>
          <Link
            href="#pinned-items"
            className={cn(
              "flex items-center gap-1 text-sm font-medium hover:underline",
              overdueCount > 0 ? "text-red-700" : "text-amber-700"
            )}
          >
            View Items
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  // All clear state
  return (
    <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-green-800">All Clear</h2>
            <p className="text-sm text-green-700">
              {hasItems
                ? "No urgent items requiring immediate attention."
                : nextDueDate
                ? `Next payment due ${nextDueDate}${nextDueDescription ? ` (${nextDueDescription})` : ""}`
                : "No upcoming payments in the next 30 days."}
            </p>
          </div>
        </div>
        <Link
          href="/payments"
          className="flex items-center gap-1 text-sm font-medium text-green-700 hover:underline"
        >
          View Payments
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
