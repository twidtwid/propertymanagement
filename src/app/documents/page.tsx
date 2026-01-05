"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings, ExternalLink } from "lucide-react"
import { FileBrowser } from "@/components/documents/file-browser"

function DocumentsContent() {
  const searchParams = useSearchParams()
  const path = searchParams?.get("path") || ""

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Browse property and vehicle documents from Dropbox
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a
              href="https://www.dropbox.com/home/Property%20Management"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Dropbox
            </a>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings/dropbox">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      <FileBrowser initialPath={path} />
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-6 w-80 mt-2" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <DocumentsContent />
    </Suspense>
  )
}
