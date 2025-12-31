"use client"

import { forwardRef } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  description?: string
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, description, className, id, ...props }, ref) => {
    const textareaId = id || props.name

    return (
      <div className="space-y-2">
        <Label htmlFor={textareaId} className={error ? "text-destructive" : ""}>
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          ref={ref}
          id={textareaId}
          className={cn(error && "border-destructive", className)}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p id={`${textareaId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }
)
FormTextarea.displayName = "FormTextarea"
