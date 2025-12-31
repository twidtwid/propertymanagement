"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface ExportButtonProps {
  data: Record<string, unknown>[]
  filename: string
  label?: string
}

export function ExportButton({
  data,
  filename,
  label = "Export CSV",
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToCSV = () => {
    if (data.length === 0) return

    setIsExporting(true)

    try {
      // Get headers from first item
      const headers = Object.keys(data[0])

      // Escape and format CSV values
      const escapeValue = (value: unknown): string => {
        if (value === null || value === undefined) return ""
        const str = String(value)
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      // Build CSV content
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers.map((header) => escapeValue(row[header])).join(",")
        ),
      ].join("\n")

      // Create and download blob
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={exportToCSV}
      disabled={isExporting || data.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      {isExporting ? "Exporting..." : label}
    </Button>
  )
}
