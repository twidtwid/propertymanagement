"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  File,
  ExternalLink,
} from "lucide-react"
import { formatFileSize, getFileExtension } from "@/lib/dropbox/utils"
import type { DropboxFileEntry } from "@/lib/dropbox/types"

interface FilePreviewProps {
  file: DropboxFileEntry | null
  files: DropboxFileEntry[]
  onClose: () => void
  onNavigate: (file: DropboxFileEntry) => void
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg"]
const PDF_EXTENSIONS = ["pdf"]

export function FilePreview({ file, files, onClose, onNavigate }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentIndex = file ? files.findIndex(f => f.path_display === file.path_display) : -1
  const previewableFiles = files.filter(f => {
    const ext = getFileExtension(f.name)
    return IMAGE_EXTENSIONS.includes(ext) || PDF_EXTENSIONS.includes(ext)
  })

  const ext = file ? getFileExtension(file.name) : ""
  const isImage = IMAGE_EXTENSIONS.includes(ext)
  const isPdf = PDF_EXTENSIONS.includes(ext)
  const canPreview = isImage || isPdf

  // Build preview URL (uses proxy endpoint for inline display)
  useEffect(() => {
    if (!file || !canPreview) {
      setPreviewUrl(null)
      setLoading(false)
      return
    }

    // Set loading while image/PDF loads
    setLoading(true)
    setError(null)
    // Use the preview proxy endpoint for inline display
    setPreviewUrl(`/api/dropbox/preview?path=${encodeURIComponent(file.path_display)}`)
  }, [file, canPreview])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!file) return

    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      const prevIndex = currentIndex - 1
      if (prevIndex >= 0) {
        onNavigate(files[prevIndex])
      }
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      const nextIndex = currentIndex + 1
      if (nextIndex < files.length) {
        onNavigate(files[nextIndex])
      }
    }
  }, [file, files, currentIndex, onClose, onNavigate])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const handleDownload = async () => {
    if (!file) return
    try {
      // Fetch the file via our preview proxy
      const response = await fetch(
        `/api/dropbox/preview?path=${encodeURIComponent(file.path_display)}`
      )
      if (!response.ok) throw new Error("Failed to download file")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      // Create a temporary link and trigger download
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download error:", err)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      onNavigate(files[currentIndex - 1])
    }
  }

  const goNext = () => {
    if (currentIndex < files.length - 1) {
      onNavigate(files[currentIndex + 1])
    }
  }

  if (!file) return null

  return (
    <Dialog open={!!file} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{file.name}</h3>
            <p className="text-sm text-muted-foreground">
              {file.size !== undefined && formatFileSize(file.size)}
              {currentIndex >= 0 && ` • ${currentIndex + 1} of ${files.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 relative bg-muted/30 overflow-hidden flex items-center justify-center">
          {/* Navigation Arrows */}
          {currentIndex > 0 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg"
              onClick={goPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {currentIndex < files.length - 1 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg"
              onClick={goNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Content */}
          {error ? (
            <div className="flex flex-col items-center gap-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : !canPreview ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <File className="h-20 w-20 text-muted-foreground" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Preview not available for this file type
                </p>
              </div>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download to View
              </Button>
            </div>
          ) : isImage && previewUrl ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Loading preview...</p>
                </div>
              )}
              <img
                src={previewUrl}
                alt={file.name}
                className={`max-w-full max-h-full object-contain ${loading ? "opacity-0" : "opacity-100"}`}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false)
                  setError("Failed to load image")
                }}
              />
            </>
          ) : isPdf && previewUrl ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Loading PDF...</p>
                </div>
              )}
              <iframe
                src={previewUrl}
                className={`w-full h-full border-0 ${loading ? "opacity-0" : "opacity-100"}`}
                title={file.name}
                onLoad={() => setLoading(false)}
              />
            </>
          ) : null}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t bg-background text-center">
          <p className="text-xs text-muted-foreground">
            Use ← → arrow keys to navigate • Press Esc to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
