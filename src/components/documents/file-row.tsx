"use client"

import { useState } from "react"
import { format } from "date-fns"
import { safeParseDate } from "@/lib/utils"
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
import { PinButton } from "@/components/ui/pin-button"
import { PinNoteButton } from "@/components/ui/pin-note-button"
import { PinNotes } from "@/components/ui/pin-notes"
import { formatFileSize, getFileIconType } from "@/lib/dropbox/utils"
import { pathToUUID, createDocumentMetadata } from "@/lib/dropbox/uuid"
import type { DropboxFileEntry } from "@/lib/dropbox/types"
import type { PinNote } from "@/types/database"

interface FileRowProps {
  entry: DropboxFileEntry
  onNavigate: (path: string) => void
  onPreview?: (entry: DropboxFileEntry) => void
  summary?: string
  isPinned?: boolean
  onTogglePin?: (fileId: string, isPinned: boolean) => void
  userNote?: PinNote | null
  onNoteSaved?: () => void
  notes?: PinNote[]
  onNoteDeleted?: () => void
}

export function FileRow({ entry, onNavigate, onPreview, summary, isPinned, onTogglePin, userNote, onNoteSaved, notes, onNoteDeleted }: FileRowProps) {
  const [downloading, setDownloading] = useState(false)
  const fileId = pathToUUID(entry.path_display)
  const hasNotes = notes && notes.length > 0

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
    <div className="border-b hover:bg-muted/50 transition-colors">
      <div
        className={`flex items-center gap-4 px-4 py-3 ${
          entry.is_folder || onPreview ? "cursor-pointer" : ""
        }`}
        onClick={handleClick}
      >
        {/* Pin button (files only) - leftmost for consistency */}
        {!entry.is_folder && (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 shrink-0">
            <PinButton
              entityType="document"
              entityId={fileId}
              isPinned={isPinned || false}
              onToggle={onTogglePin ? (isPinned) => onTogglePin(fileId, isPinned) : undefined}
              size="sm"
              variant="ghost"
              metadata={createDocumentMetadata(entry)}
            />
            {isPinned && (
              <PinNoteButton
                entityType="document"
                entityId={fileId}
                existingNote={userNote}
                onNoteSaved={onNoteSaved}
                size="sm"
                variant="ghost"
              />
            )}
          </div>
        )}

        <div className="flex-shrink-0">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${entry.is_folder ? "text-blue-600" : ""}`}>
            {entry.name}
          </p>
          {!entry.is_folder && entry.server_modified && (() => {
            const date = safeParseDate(entry.server_modified)
            if (!date) return null
            return (
              <p className="text-sm text-muted-foreground">
                {format(date, "MMM d, yyyy")}
                {entry.size !== undefined && ` • ${formatFileSize(entry.size)}`}
              </p>
            )
          })()}
          {summary && (
            <p className="text-sm text-muted-foreground italic truncate">
              {summary}
            </p>
          )}
        </div>

        {/* Download button (files only) */}
        {!entry.is_folder && (
          <div onClick={(e) => e.stopPropagation()}>
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

      {/* Notes section */}
      {hasNotes && (
        <div className="px-4 pb-3">
          <PinNotes notes={notes} onNoteDeleted={onNoteDeleted} />
        </div>
      )}
    </div>
  )
}
