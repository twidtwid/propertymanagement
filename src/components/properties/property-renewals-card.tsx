"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, Plus, Pencil, Trash2, ChevronDown, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createPropertyRenewal, updatePropertyRenewal, deletePropertyRenewal, markRenewalComplete } from "@/lib/mutations"
import { formatCurrency } from "@/lib/utils"
import { RENEWAL_TYPE_LABELS, RECURRENCE_LABELS, type PropertyRenewal, type RenewalType, type Recurrence, type Vendor } from "@/types/database"

interface PropertyRenewalsCardProps {
  propertyId: string
  renewals: PropertyRenewal[]
  vendors: Vendor[]
}

const renewalTypeOptions = Object.entries(RENEWAL_TYPE_LABELS).map(([value, label]) => ({
  value: value as RenewalType,
  label,
}))

const recurrenceOptions = Object.entries(RECURRENCE_LABELS)
  .filter(([value]) => value !== 'one_time')
  .map(([value, label]) => ({
    value: value as Recurrence,
    label,
  }))

function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getRenewalStatus(daysUntil: number): 'overdue' | 'urgent' | 'upcoming' | 'ok' {
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 14) return 'urgent'
  if (daysUntil <= 30) return 'upcoming'
  return 'ok'
}

export function PropertyRenewalsCard({ propertyId, renewals, vendors }: PropertyRenewalsCardProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(renewals.length > 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PropertyRenewal | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    renewal_type: "other" as RenewalType,
    recurrence: "annual" as Recurrence,
    due_date: "",
    last_renewed: "",
    vendor_id: "",
    cost: "",
    notes: "",
  })

  const resetForm = () => {
    setFormData({
      name: "",
      renewal_type: "other",
      recurrence: "annual",
      due_date: "",
      last_renewed: "",
      vendor_id: "",
      cost: "",
      notes: "",
    })
    setEditingItem(null)
  }

  const handleEdit = (item: PropertyRenewal) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      renewal_type: item.renewal_type,
      recurrence: item.recurrence,
      due_date: item.due_date,
      last_renewed: item.last_renewed || "",
      vendor_id: item.vendor_id || "",
      cost: item.cost?.toString() || "",
      notes: item.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const data = {
        property_id: propertyId,
        name: formData.name,
        renewal_type: formData.renewal_type,
        recurrence: formData.recurrence,
        due_date: formData.due_date || null,
        last_renewed: formData.last_renewed || null,
        vendor_id: formData.vendor_id || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        notes: formData.notes || null,
      }

      const result = editingItem
        ? await updatePropertyRenewal(editingItem.id, data)
        : await createPropertyRenewal(data)

      if (result.success) {
        toast({
          title: editingItem ? "Renewal updated" : "Renewal added",
          description: formData.name,
        })
        setDialogOpen(false)
        resetForm()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  const handleDelete = (item: PropertyRenewal) => {
    if (!confirm(`Delete "${item.name}"?`)) return

    startTransition(async () => {
      const result = await deletePropertyRenewal(item.id, propertyId)
      if (result.success) {
        toast({ title: "Renewal deleted" })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  const handleMarkComplete = (item: PropertyRenewal) => {
    startTransition(async () => {
      const result = await markRenewalComplete(item.id, propertyId)
      if (result.success) {
        toast({
          title: "Renewal marked complete",
          description: `Next due: ${new Date(result.data.due_date).toLocaleDateString()}`,
        })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  // Sort renewals by due date
  const sortedRenewals = [...renewals].sort((a, b) =>
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" />
                Annual Renewals
                {renewals.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {renewals.length}
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {renewals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No renewals tracked yet.</p>
            ) : (
              <div className="space-y-2">
                {sortedRenewals.map((renewal) => {
                  const daysUntil = getDaysUntil(renewal.due_date)
                  const status = getRenewalStatus(daysUntil)
                  const vendorName = (renewal as any).vendor_company || (renewal as any).vendor_name

                  return (
                    <div
                      key={renewal.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{renewal.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {RENEWAL_TYPE_LABELS[renewal.renewal_type]}
                          </Badge>
                          {status === 'overdue' && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {Math.abs(daysUntil)}d overdue
                            </Badge>
                          )}
                          {status === 'urgent' && (
                            <Badge variant="warning" className="text-xs">
                              Due in {daysUntil}d
                            </Badge>
                          )}
                          {status === 'upcoming' && (
                            <Badge variant="secondary" className="text-xs">
                              Due in {daysUntil}d
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>Due: {new Date(renewal.due_date).toLocaleDateString()}</span>
                          {renewal.recurrence !== 'one_time' && (
                            <span>({RECURRENCE_LABELS[renewal.recurrence]})</span>
                          )}
                          {vendorName && <span>Vendor: {vendorName}</span>}
                          {renewal.cost && <span>{formatCurrency(renewal.cost)}</span>}
                        </div>
                        {renewal.last_renewed && (
                          <p className="text-xs text-muted-foreground">
                            Last renewed: {new Date(renewal.last_renewed).toLocaleDateString()}
                          </p>
                        )}
                        {renewal.notes && (
                          <p className="text-xs text-muted-foreground">{renewal.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-green-600 hover:text-green-600"
                          onClick={() => handleMarkComplete(renewal)}
                          disabled={isPending}
                          title="Mark as completed and set next due date"
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEdit(renewal)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(renewal)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Renewal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Renewal" : "Add Renewal"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Fire Alarm Inspection"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={formData.renewal_type}
                        onValueChange={(v) => setFormData({ ...formData, renewal_type: v as RenewalType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {renewalTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Recurrence</Label>
                      <Select
                        value={formData.recurrence}
                        onValueChange={(v) => setFormData({ ...formData, recurrence: v as Recurrence })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {recurrenceOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Due Date *</Label>
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Renewed</Label>
                      <Input
                        type="date"
                        value={formData.last_renewed}
                        onChange={(e) => setFormData({ ...formData, last_renewed: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select
                        value={formData.vendor_id || "__none__"}
                        onValueChange={(v) => setFormData({ ...formData, vendor_id: v === "__none__" ? "" : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {vendors
                            .sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name))
                            .map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.company || v.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cost</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cost}
                          onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                          className="pl-7"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isPending || !formData.name.trim() || !formData.due_date}
                    >
                      {isPending ? "Saving..." : editingItem ? "Update" : "Add"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
