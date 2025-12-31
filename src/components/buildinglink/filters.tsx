"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X } from "lucide-react"
import { useState } from "react"

interface BuildingLinkFiltersProps {
  currentCategory?: string
  currentUnit?: string
  currentSearch?: string
}

const CATEGORIES = [
  { value: 'important', label: 'Important', color: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
  { value: 'security', label: 'Security Log', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
  { value: 'routine', label: 'Routine', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
  { value: 'noise', label: 'Packages/Noise', color: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
]

const UNITS = [
  { value: 'all', label: 'Both Units' },
  { value: 'PH2E', label: 'PH2E Only' },
  { value: 'PH2F', label: 'PH2F Only' },
]

export function BuildingLinkFilters({ currentCategory, currentUnit, currentSearch }: BuildingLinkFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(currentSearch || '')

  const updateParams = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all' && value !== '') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/buildinglink?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams('search', searchInput)
  }

  const clearSearch = () => {
    setSearchInput('')
    updateParams('search', null)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center mr-2">Show:</span>
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat.value}
            variant="outline"
            className={`cursor-pointer transition-colors ${
              (currentCategory === cat.value || (!currentCategory && cat.value === 'important'))
                ? cat.color + ' border-transparent'
                : 'hover:bg-muted'
            }`}
            onClick={() => updateParams('category', cat.value)}
          >
            {cat.label}
          </Badge>
        ))}
      </div>

      {/* Unit Filter */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center mr-2">Unit:</span>
        {UNITS.map((unit) => (
          <Badge
            key={unit.value}
            variant="outline"
            className={`cursor-pointer transition-colors ${
              (currentUnit === unit.value || (!currentUnit && unit.value === 'all'))
                ? 'bg-primary/10 text-primary border-transparent'
                : 'hover:bg-muted'
            }`}
            onClick={() => updateParams('unit', unit.value)}
          >
            {unit.label}
          </Badge>
        ))}
      </div>

      {/* Active Filters Display */}
      {currentSearch && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Searching for:</span>
          <Badge variant="secondary" className="gap-1">
            "{currentSearch}"
            <button onClick={clearSearch} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  )
}
