"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
  HelpCircle,
  X,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

interface MatchedTransaction {
  date: string
  description: string
  amount: number
  checkNumber: string | null
  matchedBill?: string
  confidence?: number
  reason?: string
}

interface NeedsReviewTransaction {
  date: string
  description: string
  amount: number
  checkNumber: string | null
  suggestedMatch: {
    billId: string
    description: string
    confidence: number
    reason: string
  } | null
  alternatives: Array<{
    billId: string
    description: string
    confidence: number
  }>
}

interface NoMatchTransaction {
  date: string
  description: string
  amount: number
  checkNumber: string | null
  extractedVendor: string | null
}

interface ImportResult {
  success: boolean
  message: string
  batchId: string
  stats: {
    total: number
    debits: number
    credits: number
    checks: number
    billPay: number
    achAutopay: number
  }
  dateRange: {
    start: string
    end: string
  }
  matches: {
    autoConfirmed: MatchedTransaction[]
    needsReview: NeedsReviewTransaction[]
    noMatch: NoMatchTransaction[]
  }
}

export function BankImportDialog() {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const csvContent = await file.text()

      const response = await fetch('/api/banking/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          filename: file.name
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResult(data)

      if (data.matches.autoConfirmed.length > 0) {
        toast({
          title: 'Transactions imported',
          description: `${data.matches.autoConfirmed.length} payment${data.matches.autoConfirmed.length > 1 ? 's' : ''} auto-confirmed`
        })
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleConfirmMatch = async (transactionId: string, billId: string) => {
    try {
      const response = await fetch('/api/banking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, billId })
      })

      if (!response.ok) {
        throw new Error('Failed to confirm')
      }

      toast({
        title: 'Payment confirmed',
        description: 'The transaction has been matched and confirmed.'
      })

      // Refresh page to show updated data
      window.location.reload()

    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to confirm',
        variant: 'destructive'
      })
    }
  }

  const handleDismiss = async (transactionId: string) => {
    try {
      const response = await fetch('/api/banking/confirm', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId })
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss')
      }

      toast({
        title: 'Transaction dismissed',
        description: 'The transaction has been marked as not a bill.'
      })

    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to dismiss',
        variant: 'destructive'
      })
    }
  }

  const resetDialog = () => {
    setResult(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen)
      if (!newOpen) resetDialog()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import Bank Statement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a Bank of America CSV file to match transactions to bills and auto-confirm payments.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
              `}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
                disabled={isUploading}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  {isUploading ? (
                    <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                  ) : (
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium">
                    {isUploading ? 'Processing...' : 'Drop CSV file here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bank of America transaction export (CSV format)
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Instructions */}
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-medium mb-2">How to download from Bank of America:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Log in to bankofamerica.com</li>
                  <li>Click &quot;See All Transactions&quot; on your checking account</li>
                  <li>Click &quot;Download&quot; above the transaction list</li>
                  <li>Select date range and choose &quot;Spreadsheet (CSV)&quot;</li>
                  <li>Upload the downloaded file here</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Summary */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {result.dateRange.start} to {result.dateRange.end}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {result.matches.autoConfirmed.length > 0 && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {result.matches.autoConfirmed.length} Confirmed
                    </Badge>
                  )}
                  {result.matches.needsReview.length > 0 && (
                    <Badge variant="warning">
                      <HelpCircle className="h-3 w-3 mr-1" />
                      {result.matches.needsReview.length} Need Review
                    </Badge>
                  )}
                  {result.matches.noMatch.length > 0 && (
                    <Badge variant="secondary">
                      {result.matches.noMatch.length} No Match
                    </Badge>
                  )}
                </div>
              </div>

              {/* Auto-confirmed */}
              {result.matches.autoConfirmed.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Auto-Confirmed ({result.matches.autoConfirmed.length})
                  </h4>
                  <div className="space-y-2">
                    {result.matches.autoConfirmed.map((txn, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-green-50 rounded p-2">
                        <div>
                          <span className="font-medium">{txn.description}</span>
                          {txn.checkNumber && (
                            <span className="text-muted-foreground ml-2">Check #{txn.checkNumber}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{txn.matchedBill}</span>
                          <span className="font-medium">{formatCurrency(Math.abs(txn.amount))}</span>
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Needs Review */}
              {result.matches.needsReview.length > 0 && (
                <div>
                  <h4 className="font-medium text-amber-700 mb-2 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Needs Review ({result.matches.needsReview.length})
                  </h4>
                  <div className="space-y-3">
                    {result.matches.needsReview.map((txn, i) => (
                      <Card key={i} className="border-amber-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{txn.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {txn.date} · {formatCurrency(Math.abs(txn.amount))}
                                {txn.checkNumber && ` · Check #${txn.checkNumber}`}
                              </p>
                            </div>
                          </div>
                          {txn.suggestedMatch && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-muted-foreground mb-2">
                                Suggested: {txn.suggestedMatch.description}
                                <Badge variant="secondary" className="ml-2">
                                  {Math.round(txn.suggestedMatch.confidence * 100)}%
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground mb-2">
                                {txn.suggestedMatch.reason}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Confirm Match
                                </Button>
                                <Button size="sm" variant="outline">
                                  <X className="h-3 w-3 mr-1" />
                                  Not a Bill
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* No Match */}
              {result.matches.noMatch.length > 0 && (
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">
                    No Match ({result.matches.noMatch.length})
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    These transactions didn&apos;t match any pending bills. They may be new bills or non-bill payments.
                  </p>
                  <div className="space-y-1">
                    {result.matches.noMatch.slice(0, 5).map((txn, i) => (
                      <div key={i} className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{txn.description}</span>
                        <span>{formatCurrency(Math.abs(txn.amount))}</span>
                      </div>
                    ))}
                    {result.matches.noMatch.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {result.matches.noMatch.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button variant="outline" onClick={resetDialog}>
                  Upload Another
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
