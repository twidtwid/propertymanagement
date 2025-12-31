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
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} className={error ? "text-destructive" : ""}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={name}
          className={cn(error && "border-destructive")}
        >
          <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
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
