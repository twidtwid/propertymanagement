"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  Users,
  FileText,
  AlertTriangle,
  Building2,
} from "lucide-react"
import type { EmailAnalysisReport } from "@/types/gmail"

interface GmailStatus {
  isConnected: boolean
  userEmail: string | null
  connectedAt: string | null
  scopes: string[]
  authUrl: string
}

export default function GmailSettingsPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisReport, setAnalysisReport] = useState<EmailAnalysisReport | null>(null)
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check for OAuth callback params
  const success = searchParams.get("success")
  const callbackError = searchParams.get("error")
  const connectedEmail = searchParams.get("email")

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const response = await fetch("/api/auth/gmail")
      if (!response.ok) throw new Error("Failed to fetch Gmail status")
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Gmail?")) return

    try {
      setLoading(true)
      const response = await fetch("/api/auth/gmail", { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to disconnect Gmail")
      await fetchStatus()
      setAnalysisReport(null)
      setAnalysisSummary(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    try {
      setAnalyzing(true)
      setError(null)

      const response = await fetch("/api/gmail/analyze")
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Analysis failed")
      }

      const data = await response.json()
      setAnalysisReport(data.report)
      setAnalysisSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setAnalyzing(false)
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
          <h1 className="text-3xl font-semibold tracking-tight">Gmail Integration</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Connect Gmail to analyze vendor communications
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && connectedEmail && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-800">
              Successfully connected Gmail for <strong>{connectedEmail}</strong>
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
            <Mail className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Connect Anne&apos;s Gmail to read vendor emails and enable notifications
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
                    <p className="text-sm text-muted-foreground">
                      {status.userEmail}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              {status.connectedAt && (
                <p className="text-sm text-muted-foreground">
                  Connected on {new Date(status.connectedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex gap-3 pt-2">
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
                    Click below to connect Gmail
                  </p>
                </div>
              </div>
              <Button asChild>
                <a href={status?.authUrl}>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Analysis */}
      {status?.isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Email Analysis
            </CardTitle>
            <CardDescription>
              Analyze all 2025 emails to understand vendor communication patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing emails...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Analyze 2025 Emails
                </>
              )}
            </Button>

            {analysisReport && (
              <div className="space-y-6 pt-4">
                <Separator />

                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <FileText className="h-4 w-4" />
                      Total Emails
                    </div>
                    <p className="text-2xl font-semibold">
                      {analysisReport.totalEmails.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      Unique Senders
                    </div>
                    <p className="text-2xl font-semibold">
                      {analysisReport.uniqueSenders}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <CheckCircle className="h-4 w-4" />
                      Vendor Matches
                    </div>
                    <p className="text-2xl font-semibold">
                      {analysisReport.vendorMatches.length}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Building2 className="h-4 w-4" />
                      Properties Mentioned
                    </div>
                    <p className="text-2xl font-semibold">
                      {analysisReport.propertyMentions.length}
                    </p>
                  </div>
                </div>

                {/* Top Senders */}
                <div>
                  <h3 className="font-semibold mb-3">Top Email Senders</h3>
                  <div className="space-y-2">
                    {analysisReport.topSenders.slice(0, 10).map((sender) => {
                      const match = analysisReport.vendorMatches.find((v) =>
                        v.senderEmails.includes(sender.email)
                      )
                      return (
                        <div
                          key={sender.email}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div>
                            <p className="font-medium">
                              {sender.name || sender.email}
                            </p>
                            {sender.name && (
                              <p className="text-sm text-muted-foreground">
                                {sender.email}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {sender.count} emails
                            </span>
                            {match ? (
                              <Badge variant="success">{match.vendorName}</Badge>
                            ) : (
                              <Badge variant="outline">No match</Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Email Patterns */}
                <div>
                  <h3 className="font-semibold mb-3">Detected Patterns</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysisReport.emailPatterns.map((pattern) => (
                      <div
                        key={pattern.pattern}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{pattern.pattern}</span>
                          <Badge variant="secondary">{pattern.count}</Badge>
                        </div>
                        {pattern.examples[0] && (
                          <p className="text-sm text-muted-foreground truncate">
                            e.g., &quot;{pattern.examples[0]}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {analysisReport.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {analysisReport.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Raw Summary */}
                {analysisSummary && (
                  <div>
                    <h3 className="font-semibold mb-3">Full Report</h3>
                    <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                      {analysisSummary}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions Required</CardTitle>
          <CardDescription>
            This integration requires the following Gmail permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                <strong>Read emails</strong> - To analyze vendor communications
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                <strong>Send emails</strong> - To send notifications and daily summaries
              </span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            Your data is encrypted and never shared. You can disconnect at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
