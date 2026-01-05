"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Camera, X, Upload, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhotoUploadProps {
  onPhotosChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMB?: number
  disabled?: boolean
}

export function PhotoUpload({
  onPhotosChange,
  maxFiles = 10,
  maxSizeMB = 10,
  disabled = false,
}: PhotoUploadProps) {
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      setError(null)

      const newFiles: File[] = []
      const newPreviews: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Check total count
        if (stagedPhotos.length + newFiles.length >= maxFiles) {
          setError(`Maximum ${maxFiles} photos allowed`)
          break
        }

        // Validate type
        if (!file.type.startsWith("image/")) {
          setError("Only image files are allowed")
          continue
        }

        // Validate size
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(`File "${file.name}" exceeds ${maxSizeMB}MB limit`)
          continue
        }

        newFiles.push(file)
        newPreviews.push(URL.createObjectURL(file))
      }

      if (newFiles.length > 0) {
        const updated = [...stagedPhotos, ...newFiles]
        setStagedPhotos(updated)
        setPreviews([...previews, ...newPreviews])
        onPhotosChange(updated)
      }
    },
    [stagedPhotos, previews, maxFiles, maxSizeMB, onPhotosChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles, disabled]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const removePhoto = useCallback(
    (index: number) => {
      URL.revokeObjectURL(previews[index])
      const updatedPhotos = stagedPhotos.filter((_, i) => i !== index)
      const updatedPreviews = previews.filter((_, i) => i !== index)
      setStagedPhotos(updatedPhotos)
      setPreviews(updatedPreviews)
      onPhotosChange(updatedPhotos)
    },
    [stagedPhotos, previews, onPhotosChange]
  )

  return (
    <div className="space-y-3">
      <Label>Photos (optional)</Label>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
          disabled
            ? "border-muted bg-muted/50 cursor-not-allowed"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer"
        )}
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="flex flex-col items-center gap-2 py-2">
          <Camera className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Click to add photos or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            Up to {maxFiles} photos, max {maxSizeMB}MB each
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Photo previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {previews.map((preview, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={preview}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover rounded-md"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface StagedFile {
  file: File
  preview: string
  description: string
}

interface PhotoUploadButtonProps {
  ticketId: string
  onUploadComplete?: () => void
}

export function PhotoUploadButton({ ticketId, onUploadComplete }: PhotoUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const openFilePicker = () => {
    if (isPickerOpen || isUploading) return
    setIsPickerOpen(true)
    inputRef.current?.click()
  }

  const handleFileSelect = (files: FileList | null) => {
    setIsPickerOpen(false)
    if (!files || files.length === 0) return

    // Stage files with previews
    const newStagedFiles: StagedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith("image/")) {
        newStagedFiles.push({
          file,
          preview: URL.createObjectURL(file),
          description: "",
        })
      }
    }

    if (newStagedFiles.length > 0) {
      setStagedFiles(newStagedFiles)
      setDialogOpen(true)
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const updateDescription = (index: number, description: string) => {
    setStagedFiles(prev =>
      prev.map((sf, i) => (i === index ? { ...sf, description } : sf))
    )
  }

  const removeStagedFile = (index: number) => {
    URL.revokeObjectURL(stagedFiles[index].preview)
    setStagedFiles(prev => prev.filter((_, i) => i !== index))
    if (stagedFiles.length <= 1) {
      setDialogOpen(false)
    }
  }

  const handleUpload = async () => {
    setIsUploading(true)
    try {
      for (const staged of stagedFiles) {
        // Upload file
        const formData = new FormData()
        formData.append("file", staged.file)
        formData.append("path", `/Tickets/${ticketId}`)

        const uploadResponse = await fetch("/api/dropbox/upload", {
          method: "POST",
          body: formData,
        })

        const uploadData = await uploadResponse.json()

        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || "Upload failed")
        }

        // Save description if provided
        if (staged.description.trim() && uploadData.file?.path) {
          await fetch("/api/dropbox/description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: uploadData.file.path,
              description: staged.description.trim(),
            }),
          })
        }
      }

      // Clean up previews
      stagedFiles.forEach(sf => URL.revokeObjectURL(sf.preview))
      setStagedFiles([])
      setDialogOpen(false)
      onUploadComplete?.()
    } catch (error) {
      console.error("Upload error:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    stagedFiles.forEach(sf => URL.revokeObjectURL(sf.preview))
    setStagedFiles([])
    setDialogOpen(false)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={openFilePicker}
        disabled={isUploading || isPickerOpen}
      >
        <Upload className="mr-2 h-4 w-4" />
        Add Photos
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Photos</DialogTitle>
            <DialogDescription>
              Add optional descriptions to your photos before uploading.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {stagedFiles.map((staged, index) => (
              <div key={index} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted">
                  <img
                    src={staged.preview}
                    alt={staged.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate">{staged.file.name}</p>
                    <button
                      type="button"
                      onClick={() => removeStagedFile(index)}
                      className="flex-shrink-0 p-1 text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    value={staged.description}
                    onChange={(e) => updateDescription(index, e.target.value)}
                    placeholder="Add a description (optional)"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || stagedFiles.length === 0}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {stagedFiles.length} Photo{stagedFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
