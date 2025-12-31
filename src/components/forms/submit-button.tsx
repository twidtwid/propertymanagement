"use client"

import { Button, type ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface SubmitButtonProps extends ButtonProps {
  isLoading?: boolean
  loadingText?: string
}

export function SubmitButton({
  children,
  isLoading,
  loadingText = "Saving...",
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
