"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronRight,
  Home,
  Search,
  Loader2,
  FolderOpen,
  RefreshCw,
} from "lucide-react"
import { FileRow } from "./file-row"
import { FilePreview } from "./file-preview"
import { PinnedSection } from "@/components/ui/pinned-section"
import { getPathBreadcrumbs, getRelativePath } from "@/lib/dropbox/utils"
import { pathToUUID } from "@/lib/dropbox/uuid"
import type { DropboxFileEntry } from "@/lib/dropbox/types"
import type { PinNote } from "@/types/database"

interface FileBrowserProps {
  initialPath?: string
}

export function FileBrowser({ initialPath = "" }: FileBrowserProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentPath, setCurrentPath] = useState(initialPath)
  const [entries, setEntries] = useState<DropboxFileEntry[]>([])
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [previewFile, setPreviewFile] = useState<DropboxFileEntry | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())

  const [pinnedFiles, setPinnedFiles] = useState<DropboxFileEntry[]>([])
  const [notesMap, setNotesMap] = useState<Record<string, PinNote[]>>({})
  const [userNotesMap, setUserNotesMap] = useState<Record<string, PinNote>>({})

  // Refresh notes for a specific document
  const refreshNotes = async (documentId: string) => {
    try {
      const response = await fetch(`/api/pin-notes?entityType=document&entityId=${documentId}`)
      if (response.ok) {
        const data = await response.json()
        setNotesMap((prev) => ({
          ...prev,
          [documentId]: data.notes || [],
        }))
        setUserNotesMap((prev) => ({
          ...prev,
          [documentId]: data.userNote || null,
        }))
      }
    } catch (error) {
      console.error("Failed to refresh notes:", error)
    }
  }

  const loadFolder = useCallback(async (path: string, search?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (path) params.set("path", path)
      if (search) params.set("search", search)

      const response = await fetch(`/api/dropbox/list?${params}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to load folder")
      }

      const data = await response.json()
      setEntries(data.entries)
      setIsSearching(!!search)

      // Fetch summaries for files (not folders)
      const filePaths = data.entries
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
      } else {
        setSummaries({})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load pinned documents metadata and notes
  useEffect(() => {
    async function loadPinnedDocuments() {
      if (pinnedIds.size === 0) {
        setPinnedFiles([])
        setNotesMap({})
        setUserNotesMap({})
        return
      }

      try {
        // Fetch metadata for all pinned document IDs
        const response = await fetch('/api/dropbox/pinned-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentIds: Array.from(pinnedIds) }),
        })

        if (response.ok) {
          const data = await response.json()
          setPinnedFiles(data.files || [])
        }

        // Fetch notes for all pinned documents
        for (const documentId of Array.from(pinnedIds)) {
          refreshNotes(documentId)
        }
      } catch (err) {
        console.error('Failed to load pinned documents metadata:', err)
      }
    }

    loadPinnedDocuments()
  }, [pinnedIds])

  // Fetch pinned documents on mount
  useEffect(() => {
    async function fetchPins() {
      try {
        const response = await fetch('/api/pinned/list?entityType=document')
        if (response.ok) {
          const data = await response.json()
          setPinnedIds(new Set(data.pinnedIds || []))
        }
      } catch (err) {
        console.error('Failed to fetch pinned documents:', err)
      }
    }
    fetchPins()
  }, [])

  useEffect(() => {
    loadFolder(currentPath)
  }, [currentPath, loadFolder])

  const handleTogglePin = (fileId: string, isPinned: boolean) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (isPinned) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }
      return next
    })
  }

  function handleNavigate(path: string) {
    const relativePath = getRelativePath(path)
    setCurrentPath(relativePath)
    setSearchQuery("")
    setIsSearching(false)

    // Update URL without full page reload
    const newUrl = relativePath ? `/documents?path=${encodeURIComponent(relativePath)}` : "/documents"
    router.push(newUrl, { scroll: false })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      loadFolder(currentPath, searchQuery.trim())
    }
  }

  function handleClearSearch() {
    setSearchQuery("")
    setIsSearching(false)
    loadFolder(currentPath)
  }

  const breadcrumbs = getPathBreadcrumbs(currentPath)

  // Separate folders and files in current folder
  const files = entries.filter(e => !e.is_folder)
  const folders = entries.filter(e => e.is_folder)
  // Don't filter out pinned files from current folder - show all files
  const currentFolderFiles = files

  return (
    <>
      {/* Global Pinned Documents - Always shown at top */}
      {pinnedFiles.length > 0 && (
        <PinnedSection count={pinnedFiles.length} title="Pinned Documents" variant="user">
          <div className="divide-y">
            {pinnedFiles.map((entry) => {
              const fileId = pathToUUID(entry.path_display)
              return (
                <FileRow
                  key={entry.id || entry.path_display}
                  entry={entry}
                  onNavigate={handleNavigate}
                  onPreview={setPreviewFile}
                  summary={summaries[entry.path_display]}
                  isPinned={true}
                  onTogglePin={handleTogglePin}
                  userNote={userNotesMap[fileId]}
                  onNoteSaved={() => refreshNotes(fileId)}
                  notes={notesMap[fileId] || []}
                  onNoteDeleted={() => refreshNotes(fileId)}
                />
              )
            })}
          </div>
        </PinnedSection>
      )}

      <Card>
        <CardHeader className="pb-4">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1 text-sm flex-wrap">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center">
                {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
                <button
                  onClick={() => handleNavigate(crumb.path)}
                  className={`hover:underline ${
                    index === breadcrumbs.length - 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {index === 0 ? <Home className="h-4 w-4" /> : crumb.name}
                </button>
              </div>
            ))}
          </nav>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={loading}>
            Search
          </Button>
          {isSearching && (
            <Button type="button" variant="ghost" onClick={handleClearSearch}>
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => loadFolder(currentPath)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </form>

        {isSearching && (
          <p className="text-sm text-muted-foreground mt-2">
            Search results for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Current Folder Contents */}
        {loading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-5 w-5" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32 mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-destructive">{error}</p>
            {error === "Dropbox not connected" && (
              <Button className="mt-4" onClick={() => router.push("/settings/dropbox")}>
                Connect Dropbox
              </Button>
            )}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isSearching ? "No documents found" : "This folder is empty"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Folders first */}
            {folders.map((entry) => (
              <FileRow
                key={entry.id || entry.path_display}
                entry={entry}
                onNavigate={handleNavigate}
                onPreview={setPreviewFile}
                summary={summaries[entry.path_display]}
              />
            ))}

            {/* Then all files in current folder */}
            {currentFolderFiles.map((entry) => {
              const fileId = pathToUUID(entry.path_display)
              const isPinned = pinnedIds.has(fileId)
              return (
                <FileRow
                  key={entry.id || entry.path_display}
                  entry={entry}
                  onNavigate={handleNavigate}
                  onPreview={setPreviewFile}
                  summary={summaries[entry.path_display]}
                  isPinned={isPinned}
                  onTogglePin={handleTogglePin}
                  userNote={userNotesMap[fileId]}
                  onNoteSaved={() => refreshNotes(fileId)}
                  notes={notesMap[fileId] || []}
                  onNoteDeleted={() => refreshNotes(fileId)}
                />
              )
            })}
          </div>
        )}
      </CardContent>
      </Card>

      {/* File Preview Modal */}
      <FilePreview
        file={previewFile}
        files={entries.filter(e => !e.is_folder)}
        onClose={() => setPreviewFile(null)}
        onNavigate={setPreviewFile}
      />
    </>
  )
}
