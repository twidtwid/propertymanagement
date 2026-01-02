"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Cloud,
  CheckCircle,
  XCircle,
  Loader2,
  FolderOpen,
  FileText,
  ExternalLink,
} from "lucide-react"

interface DropboxStatus {
  isConnected: boolean
  accountId: string | null
  rootFolderPath: string | null
  connectedAt: string | null
  authUrl: string
}

function DropboxSettingsContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<DropboxStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check for OAuth callback params
  const success = searchParams.get("success")
  const callbackError = searchParams.get("error")

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const response = await fetch("/api/auth/dropbox")
      if (!response.ok) throw new Error("Failed to fetch Dropbox status")
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Dropbox?")) return

    try {
      setLoading(true)
      const response = await fetch("/api/auth/dropbox", { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to disconnect Dropbox")
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dropbox Integration</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Connect Dropbox to browse and download property documents
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-800">
              Successfully connected to Dropbox
            </p>
          </CardContent>
        </Card>
      )}

      {(callbackError || error) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{callbackError || error}</p>
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Connect to the AnneSpalterStudios Dropbox to access property documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isConnected ? (
            <>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Connected</p>
                    {status.accountId && (
                      <p className="text-sm text-muted-foreground">
                        Account: {status.accountId}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              {status.rootFolderPath && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  Root folder: <code className="bg-muted px-1 rounded">{status.rootFolderPath}</code>
                </div>
              )}
              {status.connectedAt && (
                <p className="text-sm text-muted-foreground">
                  Connected on {new Date(status.connectedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" asChild>
                  <Link href="/documents">
                    <FileText className="h-4 w-4 mr-2" />
                    Browse Documents
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 py-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Not Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Click below to connect Dropbox
                  </p>
                </div>
              </div>
              <Button asChild>
                <a href={status?.authUrl}>
                  <Cloud className="h-4 w-4 mr-2" />
                  Connect Dropbox
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Features Info */}
      {status?.isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>What You Can Do</CardTitle>
            <CardDescription>
              With Dropbox connected, you can access property documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>Browse Documents</strong> - View all files organized by property and vehicle
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>Download Files</strong> - Download insurance policies, tax bills, and more
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>Search</strong> - Find documents by name across all properties
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>
                  <strong>Property Integration</strong> - See related documents on property and vehicle pages
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions Required</CardTitle>
          <CardDescription>
            This integration requires the following Dropbox permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                <strong>Read files</strong> - To browse and download documents
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                <strong>Read file metadata</strong> - To show file names, sizes, and dates
              </span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            Files remain in Dropbox and are never copied to our servers. You can disconnect at any time.
          </p>
        </CardContent>
      </Card>

      {/* Dropbox Link */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Manage your Dropbox account
            </span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://www.dropbox.com/home" target="_blank" rel="noopener noreferrer">
              Open Dropbox
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DropboxSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DropboxSettingsContent />
    </Suspense>
  )
}
