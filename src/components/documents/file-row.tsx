"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFileSize, getFileIconType } from "@/lib/dropbox/utils"
import type { DropboxFileEntry } from "@/lib/dropbox/types"

interface FileRowProps {
  entry: DropboxFileEntry
  onNavigate: (path: string) => void
  onPreview?: (entry: DropboxFileEntry) => void
  summary?: string
}

export function FileRow({ entry, onNavigate, onPreview, summary }: FileRowProps) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (entry.is_folder) {
      onNavigate(entry.path_display)
      return
    }

    setDownloading(true)
    try {
      // Fetch the file via preview proxy (avoids popup blockers)
      const response = await fetch(`/api/dropbox/preview?path=${encodeURIComponent(entry.path_display)}`)
      if (!response.ok) throw new Error("Failed to download file")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      // Create a temporary link and trigger download
      const a = document.createElement("a")
      a.href = url
      a.download = entry.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloading(false)
    }
  }

  function handleClick() {
    if (entry.is_folder) {
      onNavigate(entry.path_display)
    } else if (onPreview) {
      onPreview(entry)
    }
  }

  function getIcon() {
    if (entry.is_folder) {
      return <Folder className="h-5 w-5 text-blue-500" />
    }

    const iconType = getFileIconType(entry.name)
    switch (iconType) {
      case "pdf":
        return <FileText className="h-5 w-5 text-red-500" />
      case "image":
        return <FileImage className="h-5 w-5 text-purple-500" />
      case "document":
        return <FileText className="h-5 w-5 text-blue-500" />
      case "spreadsheet":
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />
      case "archive":
        return <FileArchive className="h-5 w-5 text-amber-500" />
      default:
        return <File className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors ${
        entry.is_folder || onPreview ? "cursor-pointer" : ""
      }`}
      onClick={handleClick}
    >
      <div className="flex-shrink-0">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${entry.is_folder ? "text-blue-600" : ""}`}>
          {entry.name}
        </p>
        {!entry.is_folder && entry.server_modified && (
          <p className="text-sm text-muted-foreground">
            {format(new Date(entry.server_modified), "MMM d, yyyy")}
            {entry.size !== undefined && ` • ${formatFileSize(entry.size)}`}
          </p>
        )}
        {summary && (
          <p className="text-sm text-muted-foreground italic truncate">
            {summary}
          </p>
        )}
      </div>

      {!entry.is_folder && (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
