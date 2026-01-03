"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | string | null
  onChange?: (value: number | null) => void
  error?: string
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, error, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("")
    const [isFocused, setIsFocused] = React.useState(false)

    // Format number to currency string (without $ sign, just commas)
    const formatForDisplay = (num: number | null | undefined): string => {
      if (num === null || num === undefined || isNaN(num)) return ""
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    // Parse string back to number
    const parseValue = (str: string): number | null => {
      const cleaned = str.replace(/[^0-9.-]/g, "")
      if (cleaned === "" || cleaned === "-") return null
      const num = parseFloat(cleaned)
      return isNaN(num) ? null : num
    }

    // Update display when value prop changes (and not focused)
    React.useEffect(() => {
      if (!isFocused) {
        const numValue = typeof value === "string" ? parseFloat(value) : value
        setDisplayValue(formatForDisplay(numValue))
      }
    }, [value, isFocused])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      // Show raw number when focused for easier editing
      const numValue = typeof value === "string" ? parseFloat(value) : value
      if (numValue !== null && numValue !== undefined && !isNaN(numValue)) {
        setDisplayValue(numValue.toString())
      }
      props.onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      const parsed = parseValue(displayValue)
      setDisplayValue(formatForDisplay(parsed))
      props.onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setDisplayValue(newValue)

      // Only call onChange with parsed value
      const parsed = parseValue(newValue)
      onChange?.(parsed)
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

CurrencyInput.displayName = "CurrencyInput"
