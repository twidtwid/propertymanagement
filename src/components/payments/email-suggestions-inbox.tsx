"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Inbox, AlertCircle, Check, X, Loader2, Mail, ChevronDown } from "lucide-react"
import { GmailViewLink } from "@/components/ui/gmail-view-link"
import { formatDate } from "@/lib/utils"
import { dismissPaymentSuggestion, importPaymentSuggestion } from "@/lib/mutations"
import { getEmailById } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import type { PaymentSuggestion, Property, Vehicle } from "@/types/database"
import type { VendorCommunication } from "@/lib/actions"

interface EmailSuggestionsInboxProps {
  suggestions: PaymentSuggestion[]
  properties: Property[]
  vehicles: Vehicle[]
}

// Prepare email HTML for iframe display (per CLAUDE.md - use iframe to isolate styles)
function prepareEmailHtml(html: string): string {
  // Remove scripts for security, but keep styles for proper rendering
  let prepared = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  // Add base styles for better readability
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; margin: 0; padding: 8px; }
        img { max-width: 100%; height: auto; }
        table { max-width: 100%; }
      </style>
    </head>
    <body>${prepared}</body>
    </html>
  `
}

export function EmailSuggestionsInbox({
  suggestions,
  properties,
  vehicles,
}: EmailSuggestionsInboxProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<PaymentSuggestion | null>(null)
  const [importForm, setImportForm] = useState({
    amount: "",
    due_date: "",
    description: "",
    property_id: "",
    vehicle_id: "",
    bill_type: "other",
  })
  // State for expanded email content
  const [loadedEmails, setLoadedEmails] = useState<Record<string, VendorCommunication | null>>({})
  const [loadingEmailId, setLoadingEmailId] = useState<string | null>(null)

  if (suggestions.length === 0) {
    return null
  }

  const handleDismiss = (suggestionId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent details toggle
    setDismissingId(suggestionId)
    startTransition(async () => {
      const result = await dismissPaymentSuggestion(suggestionId)
      if (result.success) {
        toast({ title: "Suggestion dismissed" })
      } else {
        toast({ title: "Error", description: result.error || "Failed to dismiss", variant: "destructive" })
      }
      setDismissingId(null)
    })
  }

  const openImportDialog = (suggestion: PaymentSuggestion, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent details toggle
    setSelectedSuggestion(suggestion)
    // Extract YYYY-MM-DD from date string for date input
    const dueDate = suggestion.due_date_extracted
      ? suggestion.due_date_extracted.split('T')[0]
      : ""
    setImportForm({
      amount: suggestion.amount_extracted?.toString() || "",
      due_date: dueDate,
      description: suggestion.email_subject || "",
      property_id: suggestion.property_id || "",
      vehicle_id: "",
      bill_type: "other",
    })
    setImportDialogOpen(true)
  }

  const handleImport = () => {
    if (!selectedSuggestion) return
    if (!importForm.amount || !importForm.description) {
      toast({ title: "Error", description: "Amount and description are required", variant: "destructive" })
      return
    }

    startTransition(async () => {
      const result = await importPaymentSuggestion(selectedSuggestion.id, {
        vendor_id: selectedSuggestion.vendor_id || undefined,
        property_id: importForm.property_id || undefined,
        vehicle_id: importForm.vehicle_id || undefined,
        amount: parseFloat(importForm.amount),
        due_date: importForm.due_date || new Date().toISOString().split("T")[0],
        description: importForm.description,
        bill_type: importForm.bill_type,
      })

      if (result.success) {
        toast({ title: "Bill created from email" })
        setImportDialogOpen(false)
        setSelectedSuggestion(null)
      } else {
        toast({ title: "Error", description: result.error || "Failed to create bill", variant: "destructive" })
      }
    })
  }

  const loadEmailContent = async (emailId: string | null) => {
    if (!emailId || loadedEmails[emailId] !== undefined) return

    setLoadingEmailId(emailId)
    try {
      const email = await getEmailById(emailId)
      setLoadedEmails(prev => ({ ...prev, [emailId]: email }))
    } catch (error) {
      console.error('Failed to load email:', error)
      setLoadedEmails(prev => ({ ...prev, [emailId]: null }))
    } finally {
      setLoadingEmailId(null)
    }
  }

  return (
    <>
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Inbox className="h-5 w-5 text-orange-600" />
              <span>Review from Email</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                {suggestions.length}
              </Badge>
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Emails that may need payment tracking. Click to view full email.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {suggestions.map((suggestion) => (
            <details
              key={suggestion.id}
              className="group rounded-lg bg-white border border-orange-100 overflow-hidden"
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open && suggestion.email_id) {
                  loadEmailContent(suggestion.email_id)
                }
              }}
            >
              <summary className="cursor-pointer list-none p-3 hover:bg-orange-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <ChevronDown className="h-4 w-4 text-orange-500 mt-1 flex-shrink-0 transition-transform group-open:rotate-180" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium">
                        {suggestion.vendor_name_extracted || "Unknown Vendor"}
                      </span>
                      {suggestion.confidence === "high" && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          High
                        </Badge>
                      )}
                      {suggestion.confidence === "medium" && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          Medium
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {suggestion.email_subject || "(No subject)"}
                      </p>
                      <GmailViewLink subject={suggestion.email_subject || ""} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {suggestion.amount_extracted && (
                        <span className="font-medium text-foreground">
                          ${suggestion.amount_extracted.toLocaleString()}
                        </span>
                      )}
                      {suggestion.due_date_extracted && (
                        <span suppressHydrationWarning>Due: {formatDate(suggestion.due_date_extracted)}</span>
                      )}
                      {suggestion.email_received_at && (
                        <span suppressHydrationWarning>{formatDate(suggestion.email_received_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={(e) => openImportDialog(suggestion, e)}
                      disabled={isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleDismiss(suggestion.id, e)}
                      disabled={isPending || dismissingId === suggestion.id}
                    >
                      {dismissingId === suggestion.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      Ignore
                    </Button>
                  </div>
                </div>
              </summary>

              {/* Expanded email content */}
              <div className="px-3 pb-3 border-t border-orange-100 pt-3 bg-white">
                {loadingEmailId === suggestion.email_id ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading email...
                  </div>
                ) : suggestion.email_id && loadedEmails[suggestion.email_id] ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>From: {loadedEmails[suggestion.email_id]!.from_email}</span>
                    </div>
                    {loadedEmails[suggestion.email_id]!.body_html ? (
                      <iframe
                        srcDoc={prepareEmailHtml(loadedEmails[suggestion.email_id]!.body_html!)}
                        className="w-full bg-white rounded border"
                        style={{ minHeight: '300px', maxHeight: '500px' }}
                        sandbox="allow-same-origin"
                        title="Email content"
                      />
                    ) : loadedEmails[suggestion.email_id]!.body_snippet ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-gray-50 rounded p-3">
                        {loadedEmails[suggestion.email_id]!.body_snippet}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No content available</p>
                    )}
                  </div>
                ) : suggestion.email_snippet ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-gray-50 rounded p-3">
                    {suggestion.email_snippet}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No email content available</p>
                )}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bill from Email</DialogTitle>
            <DialogDescription>
              Review and adjust the extracted information before creating a bill.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Source email info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">{selectedSuggestion?.vendor_name_extracted}</p>
                <p className="text-muted-foreground truncate">
                  {selectedSuggestion?.email_subject}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={importForm.amount}
                  onChange={(e) => setImportForm({ ...importForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={importForm.due_date}
                  onChange={(e) => setImportForm({ ...importForm, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={importForm.description}
                onChange={(e) => setImportForm({ ...importForm, description: e.target.value })}
                placeholder="Bill description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property">Property</Label>
                <Select
                  value={importForm.property_id || "_none"}
                  onValueChange={(value) => setImportForm({ ...importForm, property_id: value === "_none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bill_type">Type</Label>
                <Select
                  value={importForm.bill_type}
                  onValueChange={(value) => setImportForm({ ...importForm, bill_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utility">Utility</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="hoa">HOA</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Bill"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
