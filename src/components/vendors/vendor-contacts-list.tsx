"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Phone,
  Mail,
  MoreVertical,
  Star,
  Pencil,
  Trash2,
  User,
} from "lucide-react"
import {
  createVendorContact,
  updateVendorContact,
  deleteVendorContact,
  setPrimaryVendorContact,
  type VendorContactFormData,
} from "@/lib/mutations"
import type { VendorContact } from "@/types/database"

interface VendorContactsListProps {
  vendorId: string
  contacts: VendorContact[]
}

export function VendorContactsList({ vendorId, contacts }: VendorContactsListProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<VendorContact | null>(null)

  const handleCreate = async (formData: FormData) => {
    const data: VendorContactFormData = {
      name: formData.get("name") as string,
      title: formData.get("title") as string || null,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      is_primary: formData.get("is_primary") === "on",
      notes: formData.get("notes") as string || null,
    }

    startTransition(async () => {
      const result = await createVendorContact(vendorId, data)
      if (result.success) {
        toast({ title: "Contact added" })
        setIsAddOpen(false)
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  const handleUpdate = async (formData: FormData) => {
    if (!editingContact) return

    const data: Partial<VendorContactFormData> = {
      name: formData.get("name") as string,
      title: formData.get("title") as string || null,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      is_primary: formData.get("is_primary") === "on",
      notes: formData.get("notes") as string || null,
    }

    startTransition(async () => {
      const result = await updateVendorContact(editingContact.id, data)
      if (result.success) {
        toast({ title: "Contact updated" })
        setEditingContact(null)
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  const handleDelete = async (contactId: string) => {
    startTransition(async () => {
      const result = await deleteVendorContact(contactId)
      if (result.success) {
        toast({ title: "Contact deleted" })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  const handleSetPrimary = async (contactId: string) => {
    startTransition(async () => {
      const result = await setPrimaryVendorContact(contactId)
      if (result.success) {
        toast({ title: "Primary contact updated" })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contacts</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <ContactFormFields contact={null} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Adding..." : "Add Contact"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No contacts added yet</p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-start justify-between p-4 rounded-lg border"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.is_primary && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  {contact.title && (
                    <p className="text-sm text-muted-foreground">{contact.title}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1 text-sm hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1 text-sm hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {contact.email}
                      </a>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{contact.notes}</p>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {!contact.is_primary && (
                    <DropdownMenuItem onClick={() => handleSetPrimary(contact.id)}>
                      <Star className="h-4 w-4 mr-2" />
                      Set as Primary
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <form action={handleUpdate} className="space-y-4">
            <ContactFormFields contact={editingContact} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContactFormFields({ contact }: { contact: VendorContact | null }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={contact?.name || ""}
          placeholder="John Smith"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={contact?.title || ""}
          placeholder="Service Manager"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={contact?.phone || ""}
            placeholder="(555) 123-4567"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={contact?.email || ""}
            placeholder="john@example.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={contact?.notes || ""}
          placeholder="Additional notes about this contact..."
          rows={2}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="is_primary"
          name="is_primary"
          defaultChecked={contact?.is_primary || false}
        />
        <Label htmlFor="is_primary" className="font-normal">
          Set as primary contact
        </Label>
      </div>
    </>
  )
}
