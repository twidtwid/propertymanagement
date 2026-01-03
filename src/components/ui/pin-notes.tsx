"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { safeParseDate } from "@/lib/utils"
import type { PinNote } from "@/types/database"

interface PinNotesProps {
  notes: PinNote[]
  onNoteDeleted?: () => void
}

export function PinNotes({ notes, onNoteDeleted }: PinNotesProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  // Only format dates on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (notes.length === 0) return null

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/pin-notes/${noteId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          console.error("Failed to delete note")
          setDeletingId(null)
          return
        }

        onNoteDeleted?.()
      } catch (error) {
        console.error("Failed to delete note:", error)
      } finally {
        setDeletingId(null)
      }
    })
  }

  const formatNoteDate = (dateStr: string) => {
    const date = safeParseDate(dateStr)
    if (!date) return "unknown"

    if (!mounted) {
      // On server or before mount, just show the date
      return format(date, "MMM d")
    }

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Today
    if (date.toDateString() === today.toDateString()) {
      return "today"
    }

    // Yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return "yesterday"
    }

    // This year - show "Jan 3"
    if (date.getFullYear() === today.getFullYear()) {
      return format(date, "MMM d")
    }

    // Other years - show "Jan 3, 2023"
    return format(date, "MMM d, yyyy")
  }

  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-3 border border-border/50">
      {notes.map((note) => {
        const isDeleting = deletingId === note.id

        return (
          <div
            key={note.id}
            className="flex items-start justify-between gap-3 group"
          >
            <div className="text-sm text-muted-foreground leading-relaxed flex-1 min-w-0">
              <span className="font-medium text-foreground">
                {note.user_name}
              </span>
              <span className="mx-1.5">•</span>
              <span>{formatNoteDate(note.created_at)}</span>
              <span className="mx-1.5">•</span>
              <span className="break-words">
                {note.note}
                {note.due_date && (() => {
                  const dueDate = safeParseDate(note.due_date)
                  if (!dueDate) return null
                  return (
                    <span className="ml-2 text-xs font-medium text-orange-600">
                      (due: {format(dueDate, "MMM d, yyyy")})
                    </span>
                  )
                })()}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => handleDelete(note.id)}
              disabled={isPending}
              title="Delete note"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              )}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
