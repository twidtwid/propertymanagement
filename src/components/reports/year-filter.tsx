"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface YearFilterProps {
  currentYear: number
  startYear?: number
}

export function YearFilter({ currentYear, startYear = 2020 }: YearFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const thisYear = new Date().getFullYear()

  const years = []
  for (let y = thisYear; y >= startYear; y--) {
    years.push(y)
  }

  const handleYearChange = (year: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", year)
    router.push(`?${params.toString()}`)
  }

  return (
    <Select value={currentYear.toString()} onValueChange={handleYearChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
