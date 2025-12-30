"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Building2, Car, Users, Wrench, X } from "lucide-react"
import { globalSearch, type SearchResult } from "@/lib/actions"
import { cn } from "@/lib/utils"

const typeIcons = {
  property: Building2,
  vehicle: Car,
  vendor: Users,
  task: Wrench,
  bill: Building2,
}

const typeLabels = {
  property: "Property",
  vehicle: "Vehicle",
  vendor: "Vendor",
  task: "Task",
  bill: "Bill",
}

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const searchResults = await globalSearch(query)
        setResults(searchResults)
        setSelectedIndex(0)
      } catch (error) {
        console.error("Search error:", error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault()
        router.push(results[selectedIndex].href)
        setQuery("")
        setIsOpen(false)
      } else if (e.key === "Escape") {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    },
    [results, selectedIndex, router]
  )

  const handleResultClick = (result: SearchResult) => {
    router.push(result.href)
    setQuery("")
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-full rounded-lg border bg-muted/50 py-2.5 pl-10 pr-10 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("")
              setResults([])
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border bg-white shadow-lg">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length === 0 && query.length >= 2 ? (
            <div className="p-4 text-center text-muted-foreground">
              No results found
            </div>
          ) : (
            <ul className="py-2">
              {results.map((result, index) => {
                const Icon = typeIcons[result.type]
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => handleResultClick(result)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted",
                        index === selectedIndex && "bg-muted"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground uppercase">
                        {typeLabels[result.type]}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
