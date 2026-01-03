"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PinnedEntityType, PinNote } from "@/types/database"

interface PinNoteButtonProps {
  entityType: PinnedEntityType
  entityId: string
  existingNote?: PinNote | null
  onNoteSaved?: () => Promise<void> | void
  size?: "sm" | "default" | "lg" | "icon"
  variant?: "ghost" | "outline" | "default"
  className?: string
}

export function PinNoteButton({
  entityType,
  entityId,
  existingNote,
  onNoteSaved,
  size = "icon",
  variant = "ghost",
  className,
}: PinNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [noteText, setNoteText] = useState(existingNote?.note || "")
  const [dueDate, setDueDate] = useState(existingNote?.due_date || "")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Update noteText and dueDate when existingNote changes (after save/refresh)
  useEffect(() => {
    setNoteText(existingNote?.note || "")
    setDueDate(existingNote?.due_date || "")
  }, [existingNote?.note, existingNote?.due_date])

  // Reset form when popover opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setNoteText(existingNote?.note || "")
      setDueDate(existingNote?.due_date || "")
      setError(null)
    }
  }

  const handleSave = async () => {
    if (!noteText.trim()) {
      setError("Note cannot be empty")
      return
    }

    if (noteText.length > 500) {
      setError("Note cannot exceed 500 characters")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/pin-notes/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType,
            entityId,
            note: noteText.trim(),
            dueDate: dueDate || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Failed to save note")
          return
        }

        // Refresh notes BEFORE closing popover to ensure immediate update
        if (onNoteSaved) {
          await onNoteSaved()
        }

        setIsOpen(false)
        setError(null)
      } catch (error) {
        console.error("Failed to save note:", error)
        setError("Failed to save note")
      }
    })
  }

  const hasNote = !!existingNote

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn(
            "shrink-0",
            hasNote && "text-blue-600 hover:text-blue-700",
            className
          )}
          title={hasNote ? "Edit your note" : "Add a note"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              {hasNote ? "Edit your note" : "Add a note"}
            </h4>
            <div className="text-xs text-muted-foreground">
              {noteText.length}/500
            </div>
          </div>

          <Textarea
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value)
              setError(null)
            }}
            placeholder="Add context or reminders for the family..."
            maxLength={500}
            className="min-h-[120px] text-sm resize-none"
            disabled={isPending}
          />

          <div className="space-y-1.5">
            <Label htmlFor="due-date" className="text-xs text-muted-foreground">
              Due Date (optional)
            </Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm"
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !noteText.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
