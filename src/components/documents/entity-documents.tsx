"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { safeParseDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Folder,
  File,
  FileText,
  FileImage,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { formatFileSize, getFileIconType, getRelativePath } from "@/lib/dropbox/utils"
import type { DropboxFileEntry } from "@/lib/dropbox/types"
import { FilePreview } from "./file-preview"

interface EntityDocumentsProps {
  entityType: "property" | "vehicle" | "insurance"
  entityId: string
  entityName: string
  folderPath?: string // Override auto-detected folder path
  showTitle?: boolean
  maxFiles?: number
  documentCount?: number // Pre-fetched document count to show in title
  title?: string // Override default "Documents" title
}

export function EntityDocuments({
  entityType,
  entityId,
  entityName,
  folderPath,
  showTitle = true,
  maxFiles = 10,
  documentCount,
  title = "Documents",
}: EntityDocumentsProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<DropboxFileEntry[]>([])
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [detectedPath, setDetectedPath] = useState<string>("")
  const [previewFile, setPreviewFile] = useState<DropboxFileEntry | null>(null)

  useEffect(() => {
    async function loadDocuments() {
      setLoading(true)
      setError(null)

      try {
        // Get folder path from mapping or use provided path
        let path = folderPath
        if (!path) {
          // Look up the folder mapping for this entity
          const mappingType = entityType === "insurance" ? "insurance_portfolio" : entityType
          const mappingResponse = await fetch(
            `/api/dropbox/mapping?entityType=${mappingType}&entityId=${entityId}`
          )
          if (mappingResponse.ok) {
            const mappingData = await mappingResponse.json()
            path = mappingData.folderPath
          }
        }

        if (!path) {
          // No mapping found - show empty state
          setEntries([])
          setDetectedPath("")
          setLoading(false)
          return
        }

        setDetectedPath(path)

        const response = await fetch(`/api/dropbox/list?path=${encodeURIComponent(path)}`)

        if (!response.ok) {
          const data = await response.json()
          if (data.error === "Dropbox not connected") {
            setError("not_connected")
          } else {
            throw new Error(data.error || "Failed to load documents")
          }
          return
        }

        const data = await response.json()
        // Show both folders and files, sorted (folders first)
        const limitedEntries = data.entries.slice(0, maxFiles)
        setEntries(limitedEntries)

        // Fetch summaries for files
        const filePaths = limitedEntries
          .filter((e: DropboxFileEntry) => !e.is_folder)
          .map((e: DropboxFileEntry) => e.path_display)

        if (filePaths.length > 0) {
          try {
            const summaryResponse = await fetch(
              `/api/dropbox/summaries?paths=${filePaths.map(encodeURIComponent).join(",")}`
            )
            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json()
              setSummaries(summaryData.summaries || {})
            }
          } catch (summaryErr) {
            console.error("Failed to fetch summaries:", summaryErr)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents")
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [entityType, entityId, entityName, folderPath, maxFiles])

  async function handleDownload(entry: DropboxFileEntry) {
    setDownloadingId(entry.id)
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
      setDownloadingId(null)
    }
  }

  function getIcon(entry: DropboxFileEntry) {
    if (entry.is_folder) {
      return <Folder className="h-4 w-4 text-blue-500" />
    }

    const iconType = getFileIconType(entry.name)
    switch (iconType) {
      case "pdf":
        return <FileText className="h-4 w-4 text-red-500" />
      case "image":
        return <FileImage className="h-4 w-4 text-purple-500" />
      default:
        return <File className="h-4 w-4 text-gray-500" />
    }
  }

  const browsePath = `/documents?path=${encodeURIComponent(detectedPath)}`

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error === "not_connected") {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {title}{documentCount !== undefined ? ` (${documentCount})` : ""}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Connect Dropbox to view documents
            </p>
            <Button size="sm" asChild>
              <Link href="/settings/dropbox">Connect Dropbox</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {title}{documentCount !== undefined ? ` (${documentCount})` : ""}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={browsePath}>
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
          {error && error !== "not_connected" && (
            <CardDescription className="text-destructive">{error}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className={showTitle ? "pt-0" : ""}>
        {entries.length === 0 ? (
          <div className="text-center py-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No documents found
            </p>
            <Button variant="link" size="sm" asChild className="mt-2">
              <a
                href={`https://www.dropbox.com/home/Property%20Management${detectedPath}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Add documents in Dropbox
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id || entry.path_display}
                className="flex items-center gap-3 py-2 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors cursor-pointer"
                onClick={() => {
                  if (entry.is_folder) {
                    router.push(`/documents?path=${encodeURIComponent(entry.path_display)}`)
                  } else {
                    setPreviewFile(entry)
                  }
                }}
              >
                {getIcon(entry)}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${entry.is_folder ? "text-blue-600" : ""}`}>
                    {entry.name}
                  </p>
                  {!entry.is_folder && entry.server_modified && (() => {
                    const date = safeParseDate(entry.server_modified)
                    if (!date) return null
                    return (
                      <p className="text-xs text-muted-foreground">
                        {format(date, "MMM d, yyyy")}
                        {entry.size !== undefined && ` • ${formatFileSize(entry.size)}`}
                      </p>
                    )
                  })()}
                  {summaries[entry.path_display] && (
                    <p className="text-xs text-muted-foreground italic truncate">
                      {summaries[entry.path_display]}
                    </p>
                  )}
                </div>
                {!entry.is_folder && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(entry)
                    }}
                    disabled={downloadingId === entry.id}
                  >
                    {downloadingId === entry.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* File Preview Modal */}
      <FilePreview
        file={previewFile}
        files={entries.filter(e => !e.is_folder)}
        onClose={() => setPreviewFile(null)}
        onNavigate={setPreviewFile}
      />
    </Card>
  )
}
