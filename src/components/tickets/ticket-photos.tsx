"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Camera, Loader2, ImageIcon, Trash2, Check, X } from "lucide-react"
import { PhotoUploadButton } from "./photo-upload"

interface TicketPhoto {
  name: string
  path: string
  size?: number
  description?: string | null
}

interface TicketPhotosProps {
  ticketId: string
  editable?: boolean
}

export function TicketPhotos({ ticketId, editable = false }: TicketPhotosProps) {
  const [photos, setPhotos] = useState<TicketPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState<string | null>(null)
  const [descriptionText, setDescriptionText] = useState("")
  const [savingDescription, setSavingDescription] = useState(false)

  const fetchPhotos = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/dropbox/list?path=${encodeURIComponent(`/Tickets/${ticketId}`)}`
      )
      if (response.ok) {
        const data = await response.json()
        const imageFiles = (data.entries || []).filter((entry: { is_folder: boolean; name: string }) => {
          if (entry.is_folder) return false
          const ext = entry.name.split(".").pop()?.toLowerCase() || ""
          return ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)
        })

        // Fetch descriptions for all photos
        const photosWithDescriptions = await Promise.all(
          imageFiles.map(async (entry: { name: string; path_display: string; size?: number }) => {
            const descResponse = await fetch(
              `/api/dropbox/description?path=${encodeURIComponent(entry.path_display)}`
            )
            const descData = descResponse.ok ? await descResponse.json() : {}
            return {
              name: entry.name,
              path: entry.path_display,
              size: entry.size,
              description: descData.description || null,
            }
          })
        )

        setPhotos(photosWithDescriptions)
      }
    } catch (error) {
      console.error("Error fetching photos:", error)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const handleUploadComplete = () => {
    fetchPhotos()
  }

  const handleDelete = async (photo: TicketPhoto) => {
    if (!confirm(`Delete ${photo.name}?`)) return

    setDeleting(photo.path)
    try {
      const response = await fetch(
        `/api/dropbox/delete?path=${encodeURIComponent(photo.path)}`,
        { method: "DELETE" }
      )
      if (response.ok) {
        setPhotos(photos.filter(p => p.path !== photo.path))
      }
    } catch (error) {
      console.error("Error deleting photo:", error)
    } finally {
      setDeleting(null)
    }
  }

  const startEditDescription = (photo: TicketPhoto) => {
    setEditingDescription(photo.path)
    setDescriptionText(photo.description || "")
  }

  const cancelEditDescription = () => {
    setEditingDescription(null)
    setDescriptionText("")
  }

  const saveDescription = async (photo: TicketPhoto) => {
    setSavingDescription(true)
    try {
      const response = await fetch("/api/dropbox/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: photo.path,
          description: descriptionText.trim() || null,
        }),
      })
      if (response.ok) {
        setPhotos(photos.map(p =>
          p.path === photo.path
            ? { ...p, description: descriptionText.trim() || null }
            : p
        ))
        setEditingDescription(null)
        setDescriptionText("")
      }
    } catch (error) {
      console.error("Error saving description:", error)
    } finally {
      setSavingDescription(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" />
              Photos
              {photos.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({photos.length})
                </span>
              )}
            </CardTitle>
            <PhotoUploadButton ticketId={ticketId} onUploadComplete={handleUploadComplete} />
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No photos yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {photos.map((photo) => (
                <div
                  key={photo.path}
                  className="flex gap-4 p-3 rounded-lg border bg-muted/30"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => setSelectedPhoto(photo.path)}
                    className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-muted"
                  >
                    <img
                      src={`/api/dropbox/preview?path=${encodeURIComponent(photo.path)}`}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{photo.name}</p>

                    {editingDescription === photo.path ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={descriptionText}
                          onChange={(e) => setDescriptionText(e.target.value)}
                          placeholder="Add a description..."
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveDescription(photo)}
                            disabled={savingDescription}
                          >
                            {savingDescription ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            <span className="ml-1">Save</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditDescription}
                          >
                            <X className="h-3 w-3" />
                            <span className="ml-1">Cancel</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {photo.description ? (
                          <p className="text-sm text-muted-foreground mt-1">
                            {photo.description}
                          </p>
                        ) : editable ? (
                          <button
                            onClick={() => startEditDescription(photo)}
                            className="text-sm text-muted-foreground mt-1 hover:text-foreground"
                          >
                            + Add description
                          </button>
                        ) : null}
                        {editable && photo.description && (
                          <button
                            onClick={() => startEditDescription(photo)}
                            className="text-xs text-muted-foreground mt-1 hover:text-foreground block"
                          >
                            Edit description
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Delete button */}
                  {editable && (
                    <button
                      onClick={() => handleDelete(photo)}
                      disabled={deleting === photo.path}
                      className="flex-shrink-0 p-2 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {deleting === photo.path ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={`/api/dropbox/preview?path=${encodeURIComponent(selectedPhoto)}`}
              alt="Photo preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
