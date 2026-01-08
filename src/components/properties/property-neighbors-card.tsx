"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Users, Plus, Pencil, Trash2, ChevronDown, Phone, Mail, MapPin, Key } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createTrustedNeighbor, updateTrustedNeighbor, deleteTrustedNeighbor } from "@/lib/mutations"
import type { TrustedNeighbor } from "@/types/database"

interface PropertyNeighborsCardProps {
  propertyId: string
  neighbors: TrustedNeighbor[]
}

export function PropertyNeighborsCard({ propertyId, neighbors }: PropertyNeighborsCardProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(neighbors.length > 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TrustedNeighbor | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    relationship: "",
    has_keys: false,
    notes: "",
  })

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      relationship: "",
      has_keys: false,
      notes: "",
    })
    setEditingItem(null)
  }

  const handleEdit = (item: TrustedNeighbor) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      phone: item.phone || "",
      email: item.email || "",
      address: item.address || "",
      relationship: item.relationship || "",
      has_keys: item.has_keys,
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
        ? await updateTrustedNeighbor(editingItem.id, data)
        : await createTrustedNeighbor(data)

      if (result.success) {
        toast({
          title: editingItem ? "Neighbor updated" : "Neighbor added",
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

  const handleDelete = (item: TrustedNeighbor) => {
    if (!confirm(`Remove "${item.name}" from trusted neighbors?`)) return

    startTransition(async () => {
      const result = await deleteTrustedNeighbor(item.id, propertyId)
      if (result.success) {
        toast({ title: "Neighbor removed" })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Trusted Neighbors
                {neighbors.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {neighbors.length}
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {neighbors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trusted neighbors added yet.</p>
            ) : (
              <div className="space-y-2">
                {neighbors.map((neighbor) => (
                  <div
                    key={neighbor.id}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{neighbor.name}</span>
                        {neighbor.has_keys && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Key className="h-3 w-3" />
                            Has Keys
                          </Badge>
                        )}
                        {neighbor.relationship && (
                          <span className="text-xs text-muted-foreground">
                            ({neighbor.relationship})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {neighbor.phone && (
                          <a href={`tel:${neighbor.phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="h-3 w-3" />
                            {neighbor.phone}
                          </a>
                        )}
                        {neighbor.email && (
                          <a href={`mailto:${neighbor.email}`} className="flex items-center gap-1 hover:text-foreground">
                            <Mail className="h-3 w-3" />
                            {neighbor.email}
                          </a>
                        )}
                        {neighbor.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {neighbor.address}
                          </span>
                        )}
                      </div>
                      {neighbor.notes && (
                        <p className="text-xs text-muted-foreground">{neighbor.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(neighbor)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(neighbor)}
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
                  Add Trusted Neighbor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Neighbor" : "Add Trusted Neighbor"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Neighbor's name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Email address"
                        type="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Their address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Input
                      value={formData.relationship}
                      onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                      placeholder="e.g., Next door, Across the street"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has_keys"
                      checked={formData.has_keys}
                      onCheckedChange={(checked) => setFormData({ ...formData, has_keys: checked === true })}
                    />
                    <Label htmlFor="has_keys" className="text-sm font-normal cursor-pointer">
                      Has keys to the property
                    </Label>
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
                      disabled={isPending || !formData.name.trim()}
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
