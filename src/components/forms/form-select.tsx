"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// Sentinel value for "none" options since SelectItem doesn't allow empty strings
const NONE_VALUE = "__none__"

interface Option {
  value: string
  label: string
}

interface FormSelectProps {
  label: string
  name: string
  options: Option[]
  value?: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function FormSelect({
  label,
  name,
  options,
  value,
  onChange,
  error,
  placeholder,
  required,
  disabled,
  className,
}: FormSelectProps) {
  // Convert empty string to sentinel value for Select component
  const selectValue = value === "" ? NONE_VALUE : value

  // Convert options with empty values to use sentinel
  const normalizedOptions = options.map((opt) => ({
    ...opt,
    value: opt.value === "" ? NONE_VALUE : opt.value,
  }))

  const handleChange = (newValue: string) => {
    // Convert sentinel back to empty string for the form
    onChange(newValue === NONE_VALUE ? "" : newValue)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} className={error ? "text-destructive" : ""}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={selectValue} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger
          id={name}
          className={cn(error && "border-destructive")}
        >
          <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {normalizedOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
