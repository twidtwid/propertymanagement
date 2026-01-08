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
import { Key, Plus, Pencil, Trash2, ChevronDown, Eye, EyeOff, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createPropertyAccess, updatePropertyAccess, deletePropertyAccess } from "@/lib/mutations"
import { ACCESS_TYPE_LABELS, type PropertyAccess, type AccessType } from "@/types/database"

interface PropertyAccessCardProps {
  propertyId: string
  accessItems: PropertyAccess[]
}

const accessTypeOptions = Object.entries(ACCESS_TYPE_LABELS).map(([value, label]) => ({
  value: value as AccessType,
  label,
}))

export function PropertyAccessCard({ propertyId, accessItems }: PropertyAccessCardProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(accessItems.length > 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PropertyAccess | null>(null)
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState({
    access_type: "house_key" as AccessType,
    description: "",
    code_value: "",
    holder_name: "",
    notes: "",
  })

  const resetForm = () => {
    setFormData({
      access_type: "house_key",
      description: "",
      code_value: "",
      holder_name: "",
      notes: "",
    })
    setEditingItem(null)
  }

  const handleEdit = (item: PropertyAccess) => {
    setEditingItem(item)
    setFormData({
      access_type: item.access_type,
      description: item.description,
      code_value: item.code_value || "",
      holder_name: item.holder_name || "",
      notes: item.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const data = {
        property_id: propertyId,
        ...formData,
      }

      const result = editingItem
        ? await updatePropertyAccess(editingItem.id, data)
        : await createPropertyAccess(data)

      if (result.success) {
        toast({
          title: editingItem ? "Access item updated" : "Access item added",
          description: formData.description,
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

  const handleDelete = (item: PropertyAccess) => {
    if (!confirm(`Delete "${item.description}"?`)) return

    startTransition(async () => {
      const result = await deletePropertyAccess(item.id, propertyId)
      if (result.success) {
        toast({ title: "Access item deleted" })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  const toggleShowCode = (id: string) => {
    setShowCodes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-4 w-4" />
                Access Codes & Keys
                {accessItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {accessItems.length}
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {accessItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No access items added yet.</p>
            ) : (
              <div className="space-y-2">
                {accessItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ACCESS_TYPE_LABELS[item.access_type]}
                        </Badge>
                        <span className="font-medium text-sm">{item.description}</span>
                      </div>
                      {item.code_value && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Code:</span>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                            {showCodes[item.id] ? item.code_value : "••••••"}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleShowCode(item.id)}
                          >
                            {showCodes[item.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}
                      {item.holder_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          {item.holder_name}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-xs text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Access Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Access Item" : "Add Access Item"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.access_type}
                      onValueChange={(v) => setFormData({ ...formData, access_type: v as AccessType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="e.g., Front door key, Garage opener"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Code/Value</Label>
                    <Input
                      value={formData.code_value}
                      onChange={(e) => setFormData({ ...formData, code_value: e.target.value })}
                      placeholder="e.g., 1234, network password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Holder Name</Label>
                    <Input
                      value={formData.holder_name}
                      onChange={(e) => setFormData({ ...formData, holder_name: e.target.value })}
                      placeholder="Who has this key/code?"
                    />
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
                      disabled={isPending || !formData.description.trim()}
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
