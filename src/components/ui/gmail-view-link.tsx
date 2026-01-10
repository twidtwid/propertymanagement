"use client"

import { ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"

interface GmailViewLinkProps {
  subject: string
  className?: string
  showLabel?: boolean
}

/**
 * Gmail deep link that opens email search in Gmail.
 * Only visible to owners (Todd/Anne), not bookkeepers.
 */
export function GmailViewLink({ subject, className = "", showLabel = true }: GmailViewLinkProps) {
  const [isOwner, setIsOwner] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Check if user is an owner
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (data.user?.role === "owner") {
          setIsOwner(true)
        }
      })
      .catch(() => {
        // Not logged in or error - hide link
      })
  }, [])

  // Don't render until mounted (avoid hydration mismatch)
  if (!mounted || !isOwner) {
    return null
  }

  const gmailUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(subject)}`

  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 flex-shrink-0 ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        window.open(gmailUrl, "_blank", "noopener,noreferrer")
      }}
    >
      <ExternalLink className="h-3 w-3" />
      {showLabel && <span className="hidden sm:inline">View</span>}
    </button>
  )
}
