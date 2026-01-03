"use server"

import { revalidatePath } from "next/cache"
import { query, queryOne } from "./db"
import { getLogger } from "./logger/contextual"
import { audit } from "./logger/audit"
import { canAccessProperty, canAccessVehicle } from "./visibility"
import { syncSmartPinsBills, syncSmartPinsTickets } from "./actions"
import type {
  Property,
  Vehicle,
  Vendor,
  VendorContact,
  Bill,
  PropertyTax,
  InsurancePolicy,
  MaintenanceTask,
  SharedTaskList,
  SharedTaskItem,
} from "@/types/database"
import {
  propertySchema,
  vehicleSchema,
  vendorSchema,
  billSchema,
  propertyTaxSchema,
  insurancePolicySchema,
  maintenanceTaskSchema,
  sharedTaskListSchema,
  sharedTaskItemSchema,
  ticketSchema,
  closeTicketSchema,
  type ActionResult,
} from "./schemas"
import { getUser } from "./auth"

/**
 * Convert empty strings to null for database fields.
 * PostgreSQL doesn't accept "" for date, numeric, or foreign key fields.
 */
function emptyToNull<T>(value: T): T | null {
  if (value === "" || value === undefined) return null
  return value
}

// ============================================
// Properties
// ============================================

export async function createProperty(formData: unknown): Promise<ActionResult<Property>> {
  const log = getLogger("mutations.property")
  const parsed = propertySchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Property validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const property = await queryOne<Property>(
      `INSERT INTO properties (
        name, address, city, state, country, postal_code,
        property_type, square_feet, purchase_date, purchase_price, current_value,
        span_number, block_number, lot_number, parcel_id,
        has_mortgage, mortgage_lender, mortgage_account, mortgage_payment, mortgage_due_day,
        notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        d.name, d.address, d.city, emptyToNull(d.state), d.country, emptyToNull(d.postal_code),
        d.property_type, emptyToNull(d.square_feet), emptyToNull(d.purchase_date), emptyToNull(d.purchase_price), emptyToNull(d.current_value),
        emptyToNull(d.span_number), emptyToNull(d.block_number), emptyToNull(d.lot_number), emptyToNull(d.parcel_id),
        d.has_mortgage, emptyToNull(d.mortgage_lender), emptyToNull(d.mortgage_account), emptyToNull(d.mortgage_payment), emptyToNull(d.mortgage_due_day),
        emptyToNull(d.notes), d.status
      ]
    )

    await audit({
      action: "create",
      entityType: "property",
      entityId: property!.id,
      entityName: property!.name,
    })

    revalidatePath("/properties")
    log.info("Property created", { propertyId: property!.id, name: property!.name })
    return { success: true, data: property! }
  } catch (error) {
    log.error("Failed to create property", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create property" }
  }
}

export async function updateProperty(id: string, formData: unknown): Promise<ActionResult<Property>> {
  const log = getLogger("mutations.property")

  // Authorization check
  const hasAccess = await canAccessProperty(id)
  if (!hasAccess) {
    log.warn("Property update access denied", { propertyId: id })
    return { success: false, error: "Access denied" }
  }

  const parsed = propertySchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Property update validation failed", { propertyId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    // Get old value for audit
    const oldProperty = await queryOne<Property>("SELECT * FROM properties WHERE id = $1", [id])

    const d = parsed.data
    const property = await queryOne<Property>(
      `UPDATE properties SET
        name = COALESCE($2, name),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        state = $5,
        country = COALESCE($6, country),
        postal_code = $7,
        property_type = COALESCE($8, property_type),
        square_feet = $9,
        purchase_date = $10,
        purchase_price = $11,
        current_value = $12,
        span_number = $13,
        block_number = $14,
        lot_number = $15,
        parcel_id = $16,
        has_mortgage = COALESCE($17, has_mortgage),
        mortgage_lender = $18,
        mortgage_account = $19,
        mortgage_payment = $20,
        mortgage_due_day = $21,
        notes = $22,
        status = COALESCE($23, status),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        d.name, d.address, d.city, emptyToNull(d.state), d.country, emptyToNull(d.postal_code),
        d.property_type, emptyToNull(d.square_feet), emptyToNull(d.purchase_date), emptyToNull(d.purchase_price), emptyToNull(d.current_value),
        emptyToNull(d.span_number), emptyToNull(d.block_number), emptyToNull(d.lot_number), emptyToNull(d.parcel_id),
        d.has_mortgage, emptyToNull(d.mortgage_lender), emptyToNull(d.mortgage_account), emptyToNull(d.mortgage_payment), emptyToNull(d.mortgage_due_day),
        emptyToNull(d.notes), d.status
      ]
    )

    if (!property) {
      log.warn("Property not found for update", { propertyId: id })
      return { success: false, error: "Property not found" }
    }

    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (oldProperty) {
      if (oldProperty.name !== property.name) changes.name = { old: oldProperty.name, new: property.name }
      if (oldProperty.address !== property.address) changes.address = { old: oldProperty.address, new: property.address }
      if (oldProperty.status !== property.status) changes.status = { old: oldProperty.status, new: property.status }
    }
    await audit({
      action: "update",
      entityType: "property",
      entityId: property.id,
      entityName: property.name,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    })

    revalidatePath("/properties")
    revalidatePath(`/properties/${id}`)
    log.info("Property updated", { propertyId: property.id, name: property.name })
    return { success: true, data: property }
  } catch (error) {
    log.error("Failed to update property", { propertyId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update property" }
  }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.property")

  // Authorization check
  const hasAccess = await canAccessProperty(id)
  if (!hasAccess) {
    log.warn("Property delete access denied", { propertyId: id })
    return { success: false, error: "Access denied" }
  }

  try {
    // Get property details for audit before deletion
    const property = await queryOne<Property>("SELECT * FROM properties WHERE id = $1", [id])

    await query("DELETE FROM properties WHERE id = $1", [id])

    if (property) {
      await audit({
        action: "delete",
        entityType: "property",
        entityId: id,
        entityName: property.name,
        metadata: { address: property.address, city: property.city },
      })
    }

    revalidatePath("/properties")
    log.info("Property deleted", { propertyId: id, name: property?.name })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete property", { propertyId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete property" }
  }
}

// ============================================
// Vendors
// ============================================

export async function createVendor(formData: unknown): Promise<ActionResult<Vendor>> {
  const log = getLogger("mutations.vendor")
  const parsed = vendorSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Vendor validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const vendor = await queryOne<Vendor>(
      `INSERT INTO vendors (
        name, company, specialty, phone, email, address, website,
        emergency_phone, account_number, payment_method, login_info,
        notes, rating, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        d.name, emptyToNull(d.company), d.specialty, emptyToNull(d.phone), emptyToNull(d.email), emptyToNull(d.address), emptyToNull(d.website),
        emptyToNull(d.emergency_phone), emptyToNull(d.account_number), emptyToNull(d.payment_method), emptyToNull(d.login_info),
        emptyToNull(d.notes), emptyToNull(d.rating), d.is_active
      ]
    )

    await audit({
      action: "create",
      entityType: "vendor",
      entityId: vendor!.id,
      entityName: vendor!.name,
      metadata: { specialty: vendor!.specialty, company: vendor!.company },
    })

    revalidatePath("/vendors")
    log.info("Vendor created", { vendorId: vendor!.id, name: vendor!.name })
    return { success: true, data: vendor! }
  } catch (error) {
    log.error("Failed to create vendor", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create vendor" }
  }
}

export async function updateVendor(id: string, formData: unknown): Promise<ActionResult<Vendor>> {
  const log = getLogger("mutations.vendor")
  const parsed = vendorSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Vendor update validation failed", { vendorId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldVendor = await queryOne<Vendor>("SELECT * FROM vendors WHERE id = $1", [id])

    const d = parsed.data
    const vendor = await queryOne<Vendor>(
      `UPDATE vendors SET
        name = COALESCE($2, name),
        company = $3,
        specialty = COALESCE($4, specialty),
        phone = $5,
        email = $6,
        address = $7,
        website = $8,
        emergency_phone = $9,
        account_number = $10,
        payment_method = $11,
        login_info = $12,
        notes = $13,
        rating = $14,
        is_active = COALESCE($15, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        d.name, emptyToNull(d.company), d.specialty, emptyToNull(d.phone), emptyToNull(d.email), emptyToNull(d.address), emptyToNull(d.website),
        emptyToNull(d.emergency_phone), emptyToNull(d.account_number), emptyToNull(d.payment_method), emptyToNull(d.login_info),
        emptyToNull(d.notes), emptyToNull(d.rating), d.is_active
      ]
    )

    if (!vendor) {
      log.warn("Vendor not found for update", { vendorId: id })
      return { success: false, error: "Vendor not found" }
    }

    const vendorChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (oldVendor) {
      if (oldVendor.name !== vendor.name) vendorChanges.name = { old: oldVendor.name, new: vendor.name }
      if (oldVendor.specialty !== vendor.specialty) vendorChanges.specialty = { old: oldVendor.specialty, new: vendor.specialty }
      if (oldVendor.is_active !== vendor.is_active) vendorChanges.is_active = { old: oldVendor.is_active, new: vendor.is_active }
    }
    await audit({
      action: "update",
      entityType: "vendor",
      entityId: vendor.id,
      entityName: vendor.name,
      changes: Object.keys(vendorChanges).length > 0 ? vendorChanges : undefined,
    })

    revalidatePath("/vendors")
    revalidatePath(`/vendors/${id}`)
    log.info("Vendor updated", { vendorId: vendor.id, name: vendor.name })
    return { success: true, data: vendor }
  } catch (error) {
    log.error("Failed to update vendor", { vendorId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update vendor" }
  }
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.vendor")
  try {
    const vendor = await queryOne<Vendor>("SELECT * FROM vendors WHERE id = $1", [id])

    await query("DELETE FROM vendors WHERE id = $1", [id])

    if (vendor) {
      await audit({
        action: "delete",
        entityType: "vendor",
        entityId: id,
        entityName: vendor.name,
        metadata: { specialty: vendor.specialty, company: vendor.company },
      })
    }

    revalidatePath("/vendors")
    log.info("Vendor deleted", { vendorId: id, name: vendor?.name })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete vendor", { vendorId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete vendor" }
  }
}

// ============================================
// Vendor Contacts
// ============================================

export interface VendorContactFormData {
  name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  is_primary?: boolean
  notes?: string | null
}

export async function createVendorContact(vendorId: string, formData: VendorContactFormData): Promise<ActionResult<VendorContact>> {
  const log = getLogger("mutations.vendor_contact")

  if (!formData.name || formData.name.trim() === "") {
    return { success: false, error: "Contact name is required" }
  }

  try {
    // If this contact is primary, unset any existing primary contacts
    if (formData.is_primary) {
      await query("UPDATE vendor_contacts SET is_primary = FALSE WHERE vendor_id = $1", [vendorId])
    }

    const contact = await queryOne<VendorContact>(
      `INSERT INTO vendor_contacts (vendor_id, name, title, email, phone, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        vendorId,
        formData.name,
        emptyToNull(formData.title),
        emptyToNull(formData.email),
        emptyToNull(formData.phone),
        formData.is_primary || false,
        emptyToNull(formData.notes),
      ]
    )

    revalidatePath(`/vendors/${vendorId}`)
    log.info("Vendor contact created", { contactId: contact!.id, vendorId, name: formData.name })
    return { success: true, data: contact! }
  } catch (error) {
    log.error("Failed to create vendor contact", { vendorId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create contact" }
  }
}

export async function updateVendorContact(contactId: string, formData: Partial<VendorContactFormData>): Promise<ActionResult<VendorContact>> {
  const log = getLogger("mutations.vendor_contact")

  try {
    // Get the contact to find the vendor_id
    const existing = await queryOne<VendorContact>("SELECT * FROM vendor_contacts WHERE id = $1", [contactId])
    if (!existing) {
      return { success: false, error: "Contact not found" }
    }

    // If this contact is being set as primary, unset others
    if (formData.is_primary) {
      await query("UPDATE vendor_contacts SET is_primary = FALSE WHERE vendor_id = $1 AND id != $2", [existing.vendor_id, contactId])
    }

    const contact = await queryOne<VendorContact>(
      `UPDATE vendor_contacts SET
        name = COALESCE($2, name),
        title = $3,
        email = $4,
        phone = $5,
        is_primary = COALESCE($6, is_primary),
        notes = $7,
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        contactId,
        formData.name,
        emptyToNull(formData.title),
        emptyToNull(formData.email),
        emptyToNull(formData.phone),
        formData.is_primary,
        emptyToNull(formData.notes),
      ]
    )

    revalidatePath(`/vendors/${existing.vendor_id}`)
    log.info("Vendor contact updated", { contactId, name: contact!.name })
    return { success: true, data: contact! }
  } catch (error) {
    log.error("Failed to update vendor contact", { contactId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update contact" }
  }
}

export async function deleteVendorContact(contactId: string): Promise<ActionResult> {
  const log = getLogger("mutations.vendor_contact")

  try {
    const contact = await queryOne<VendorContact>("SELECT * FROM vendor_contacts WHERE id = $1", [contactId])
    if (!contact) {
      return { success: false, error: "Contact not found" }
    }

    await query("DELETE FROM vendor_contacts WHERE id = $1", [contactId])

    revalidatePath(`/vendors/${contact.vendor_id}`)
    log.info("Vendor contact deleted", { contactId, name: contact.name })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete vendor contact", { contactId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete contact" }
  }
}

export async function setPrimaryVendorContact(contactId: string): Promise<ActionResult<VendorContact>> {
  const log = getLogger("mutations.vendor_contact")

  try {
    const contact = await queryOne<VendorContact>("SELECT * FROM vendor_contacts WHERE id = $1", [contactId])
    if (!contact) {
      return { success: false, error: "Contact not found" }
    }

    // Unset all primaries for this vendor, then set this one
    await query("UPDATE vendor_contacts SET is_primary = FALSE WHERE vendor_id = $1", [contact.vendor_id])
    const updated = await queryOne<VendorContact>(
      "UPDATE vendor_contacts SET is_primary = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
      [contactId]
    )

    revalidatePath(`/vendors/${contact.vendor_id}`)
    log.info("Primary contact set", { contactId, vendorId: contact.vendor_id })
    return { success: true, data: updated! }
  } catch (error) {
    log.error("Failed to set primary contact", { contactId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to set primary contact" }
  }
}

// ============================================
// Vehicles
// ============================================

export async function createVehicle(formData: unknown): Promise<ActionResult<Vehicle>> {
  const log = getLogger("mutations.vehicle")
  const parsed = vehicleSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Vehicle validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const vehicle = await queryOne<Vehicle>(
      `INSERT INTO vehicles (
        year, make, model, color, vin, license_plate,
        registration_state, registration_expires, inspection_expires,
        garage_location, property_id, notes, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        d.year, d.make, d.model, emptyToNull(d.color), emptyToNull(d.vin), emptyToNull(d.license_plate),
        d.registration_state, emptyToNull(d.registration_expires), emptyToNull(d.inspection_expires),
        emptyToNull(d.garage_location), emptyToNull(d.property_id), emptyToNull(d.notes), d.is_active
      ]
    )

    await audit({
      action: "create",
      entityType: "vehicle",
      entityId: vehicle!.id,
      entityName: `${vehicle!.year} ${vehicle!.make} ${vehicle!.model}`,
    })

    revalidatePath("/vehicles")
    log.info("Vehicle created", { vehicleId: vehicle!.id, make: vehicle!.make, model: vehicle!.model })
    return { success: true, data: vehicle! }
  } catch (error) {
    log.error("Failed to create vehicle", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create vehicle" }
  }
}

export async function updateVehicle(id: string, formData: unknown): Promise<ActionResult<Vehicle>> {
  const log = getLogger("mutations.vehicle")

  // Authorization check
  const hasAccess = await canAccessVehicle(id)
  if (!hasAccess) {
    log.warn("Vehicle update access denied", { vehicleId: id })
    return { success: false, error: "Access denied" }
  }

  const parsed = vehicleSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Vehicle update validation failed", { vehicleId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldVehicle = await queryOne<Vehicle>("SELECT * FROM vehicles WHERE id = $1", [id])

    const d = parsed.data
    const vehicle = await queryOne<Vehicle>(
      `UPDATE vehicles SET
        year = COALESCE($2, year),
        make = COALESCE($3, make),
        model = COALESCE($4, model),
        color = $5,
        vin = $6,
        license_plate = $7,
        registration_state = COALESCE($8, registration_state),
        registration_expires = $9,
        inspection_expires = $10,
        garage_location = $11,
        property_id = $12,
        notes = $13,
        is_active = COALESCE($14, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        d.year, d.make, d.model, emptyToNull(d.color), emptyToNull(d.vin), emptyToNull(d.license_plate),
        d.registration_state, emptyToNull(d.registration_expires), emptyToNull(d.inspection_expires),
        emptyToNull(d.garage_location), emptyToNull(d.property_id), emptyToNull(d.notes), d.is_active
      ]
    )

    if (!vehicle) {
      log.warn("Vehicle not found for update", { vehicleId: id })
      return { success: false, error: "Vehicle not found" }
    }

    const vehicleChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (oldVehicle) {
      if (oldVehicle.license_plate !== vehicle.license_plate) vehicleChanges.license_plate = { old: oldVehicle.license_plate, new: vehicle.license_plate }
      if (oldVehicle.is_active !== vehicle.is_active) vehicleChanges.is_active = { old: oldVehicle.is_active, new: vehicle.is_active }
    }
    await audit({
      action: "update",
      entityType: "vehicle",
      entityId: vehicle.id,
      entityName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      changes: Object.keys(vehicleChanges).length > 0 ? vehicleChanges : undefined,
    })

    revalidatePath("/vehicles")
    revalidatePath(`/vehicles/${id}`)
    log.info("Vehicle updated", { vehicleId: vehicle.id, make: vehicle.make, model: vehicle.model })
    return { success: true, data: vehicle }
  } catch (error) {
    log.error("Failed to update vehicle", { vehicleId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update vehicle" }
  }
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.vehicle")

  // Authorization check
  const hasAccess = await canAccessVehicle(id)
  if (!hasAccess) {
    log.warn("Vehicle delete access denied", { vehicleId: id })
    return { success: false, error: "Access denied" }
  }

  try {
    const vehicle = await queryOne<Vehicle>("SELECT * FROM vehicles WHERE id = $1", [id])

    await query("DELETE FROM vehicles WHERE id = $1", [id])

    if (vehicle) {
      await audit({
        action: "delete",
        entityType: "vehicle",
        entityId: id,
        entityName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      })
    }

    revalidatePath("/vehicles")
    log.info("Vehicle deleted", { vehicleId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete vehicle", { vehicleId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete vehicle" }
  }
}

// ============================================
// Bills
// ============================================

export async function createBill(formData: unknown): Promise<ActionResult<Bill>> {
  const log = getLogger("mutations.bill")
  const parsed = billSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Bill validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const bill = await queryOne<Bill>(
      `INSERT INTO bills (
        property_id, vehicle_id, vendor_id, bill_type, description,
        amount, currency, due_date, recurrence, status,
        payment_method, payment_date, payment_reference,
        confirmation_date, confirmation_notes, days_to_confirm,
        document_url, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), emptyToNull(d.vendor_id), d.bill_type, emptyToNull(d.description),
        d.amount, d.currency, d.due_date, d.recurrence, d.status,
        emptyToNull(d.payment_method), emptyToNull(d.payment_date), emptyToNull(d.payment_reference),
        emptyToNull(d.confirmation_date), emptyToNull(d.confirmation_notes), d.days_to_confirm,
        emptyToNull(d.document_url), emptyToNull(d.notes)
      ]
    )

    await audit({
      action: "create",
      entityType: "bill",
      entityId: bill!.id,
      entityName: bill!.description || `${bill!.bill_type} - $${bill!.amount}`,
      metadata: { amount: bill!.amount, dueDate: bill!.due_date, billType: bill!.bill_type },
    })

    revalidatePath("/payments")
    log.info("Bill created", { billId: bill!.id, amount: bill!.amount, dueDate: bill!.due_date })
    return { success: true, data: bill! }
  } catch (error) {
    log.error("Failed to create bill", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create bill" }
  }
}

export async function updateBill(id: string, formData: unknown): Promise<ActionResult<Bill>> {
  const log = getLogger("mutations.bill")
  const parsed = billSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Bill update validation failed", { billId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldBill = await queryOne<Bill>("SELECT * FROM bills WHERE id = $1", [id])

    const d = parsed.data
    const bill = await queryOne<Bill>(
      `UPDATE bills SET
        property_id = $2,
        vehicle_id = $3,
        vendor_id = $4,
        bill_type = COALESCE($5, bill_type),
        description = $6,
        amount = COALESCE($7, amount),
        currency = COALESCE($8, currency),
        due_date = COALESCE($9, due_date),
        recurrence = COALESCE($10, recurrence),
        status = COALESCE($11, status),
        payment_method = $12,
        payment_date = $13,
        payment_reference = $14,
        confirmation_date = $15,
        confirmation_notes = $16,
        days_to_confirm = COALESCE($17, days_to_confirm),
        document_url = $18,
        notes = $19,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), emptyToNull(d.vendor_id), d.bill_type, emptyToNull(d.description),
        d.amount, d.currency, d.due_date, d.recurrence, d.status,
        emptyToNull(d.payment_method), emptyToNull(d.payment_date), emptyToNull(d.payment_reference),
        emptyToNull(d.confirmation_date), emptyToNull(d.confirmation_notes), d.days_to_confirm,
        emptyToNull(d.document_url), emptyToNull(d.notes)
      ]
    )

    if (!bill) {
      log.warn("Bill not found for update", { billId: id })
      return { success: false, error: "Bill not found" }
    }

    const billChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (oldBill) {
      if (oldBill.amount !== bill.amount) billChanges.amount = { old: oldBill.amount, new: bill.amount }
      if (oldBill.status !== bill.status) billChanges.status = { old: oldBill.status, new: bill.status }
      if (oldBill.due_date !== bill.due_date) billChanges.due_date = { old: oldBill.due_date, new: bill.due_date }
    }
    await audit({
      action: "update",
      entityType: "bill",
      entityId: bill.id,
      entityName: bill.description || `${bill.bill_type} - $${bill.amount}`,
      changes: Object.keys(billChanges).length > 0 ? billChanges : undefined,
    })

    // Sync smart pins if status or due_date changed
    if (billChanges.status || billChanges.due_date) {
      await syncSmartPinsBills().catch((err) =>
        log.warn("Failed to sync smart pins after bill update", { error: err })
      )
    }

    revalidatePath("/payments")
    log.info("Bill updated", { billId: bill.id, amount: bill.amount })
    return { success: true, data: bill }
  } catch (error) {
    log.error("Failed to update bill", { billId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update bill" }
  }
}

export async function markBillPaid(id: string, paymentDate: string, paymentMethod?: string): Promise<ActionResult<Bill>> {
  const log = getLogger("mutations.bill")
  try {
    // Get old status for audit
    const oldBill = await queryOne<Bill>("SELECT * FROM bills WHERE id = $1", [id])

    const bill = await queryOne<Bill>(
      `UPDATE bills SET
        status = 'sent',
        payment_date = $2,
        payment_method = COALESCE($3, payment_method),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, paymentDate, paymentMethod || null]
    )

    if (!bill) {
      log.warn("Bill not found for mark paid", { billId: id })
      return { success: false, error: "Bill not found" }
    }

    await audit({
      action: "mark_paid",
      entityType: "bill",
      entityId: bill.id,
      entityName: bill.description || `Bill ${bill.id}`,
      changes: {
        status: { old: oldBill?.status || "pending", new: "sent" },
        payment_date: { old: oldBill?.payment_date, new: paymentDate },
        payment_method: { old: oldBill?.payment_method, new: paymentMethod || oldBill?.payment_method },
      },
    })

    revalidatePath("/payments")
    log.info("Bill marked as paid", { billId: bill.id, paymentDate, paymentMethod })
    return { success: true, data: bill }
  } catch (error) {
    log.error("Failed to mark bill paid", { billId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to mark bill paid" }
  }
}

export async function confirmBillPayment(id: string, notes?: string): Promise<ActionResult<Bill>> {
  const log = getLogger("mutations.bill")
  try {
    // Get old status for audit
    const oldBill = await queryOne<Bill>("SELECT * FROM bills WHERE id = $1", [id])

    const bill = await queryOne<Bill>(
      `UPDATE bills SET
        status = 'confirmed',
        confirmation_date = CURRENT_DATE,
        confirmation_notes = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, notes || null]
    )

    if (!bill) {
      log.warn("Bill not found for confirmation", { billId: id })
      return { success: false, error: "Bill not found" }
    }

    await audit({
      action: "confirm",
      entityType: "bill",
      entityId: bill.id,
      entityName: bill.description || `Bill ${bill.id}`,
      changes: {
        status: { old: oldBill?.status || "sent", new: "confirmed" },
        confirmation_date: { old: null, new: bill.confirmation_date },
      },
      metadata: notes ? { notes } : undefined,
    })

    // Sync smart pins to remove this bill from "needs attention" if applicable
    await syncSmartPinsBills().catch((err) =>
      log.warn("Failed to sync smart pins after bill confirmation", { error: err })
    )

    revalidatePath("/payments")
    log.info("Bill payment confirmed", { billId: bill.id, description: bill.description })
    return { success: true, data: bill }
  } catch (error) {
    log.error("Failed to confirm payment", { billId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to confirm payment" }
  }
}

export async function deleteBill(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.bill")
  try {
    // Get bill details for audit before deletion
    const bill = await queryOne<Bill>("SELECT * FROM bills WHERE id = $1", [id])

    await query("DELETE FROM bills WHERE id = $1", [id])

    if (bill) {
      await audit({
        action: "delete",
        entityType: "bill",
        entityId: id,
        entityName: bill.description || `Bill ${id}`,
        metadata: { amount: bill.amount, dueDate: bill.due_date },
      })
    }

    revalidatePath("/payments")
    log.info("Bill deleted", { billId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete bill", { billId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete bill" }
  }
}

// ============================================
// Property Taxes
// ============================================

export async function createPropertyTax(formData: unknown): Promise<ActionResult<PropertyTax>> {
  const log = getLogger("mutations.property_tax")
  const parsed = propertyTaxSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Property tax validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const tax = await queryOne<PropertyTax>(
      `INSERT INTO property_taxes (
        property_id, tax_year, jurisdiction, installment, amount,
        due_date, payment_url, status, payment_date, confirmation_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        d.property_id, d.tax_year, d.jurisdiction, d.installment, d.amount,
        d.due_date, emptyToNull(d.payment_url), d.status, emptyToNull(d.payment_date), emptyToNull(d.confirmation_date), emptyToNull(d.notes)
      ]
    )

    await audit({
      action: "create",
      entityType: "property_tax",
      entityId: tax!.id,
      entityName: `${tax!.jurisdiction} ${tax!.tax_year} Q${tax!.installment}`,
      metadata: { amount: tax!.amount, dueDate: tax!.due_date, propertyId: tax!.property_id },
    })

    revalidatePath("/payments")
    revalidatePath(`/properties/${d.property_id}`)
    log.info("Property tax created", { taxId: tax!.id, jurisdiction: tax!.jurisdiction, year: tax!.tax_year })
    return { success: true, data: tax! }
  } catch (error) {
    log.error("Failed to create property tax", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create property tax record" }
  }
}

export async function updatePropertyTax(id: string, formData: unknown): Promise<ActionResult<PropertyTax>> {
  const log = getLogger("mutations.property_tax")
  const parsed = propertyTaxSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Property tax update validation failed", { taxId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldTax = await queryOne<PropertyTax>("SELECT * FROM property_taxes WHERE id = $1", [id])

    const d = parsed.data
    const tax = await queryOne<PropertyTax>(
      `UPDATE property_taxes SET
        tax_year = COALESCE($2, tax_year),
        jurisdiction = COALESCE($3, jurisdiction),
        installment = COALESCE($4, installment),
        amount = COALESCE($5, amount),
        due_date = COALESCE($6, due_date),
        payment_url = $7,
        status = COALESCE($8, status),
        payment_date = $9,
        confirmation_date = $10,
        notes = $11
      WHERE id = $1
      RETURNING *`,
      [
        id,
        d.tax_year, d.jurisdiction, d.installment, d.amount,
        d.due_date, emptyToNull(d.payment_url), d.status, emptyToNull(d.payment_date), emptyToNull(d.confirmation_date), emptyToNull(d.notes)
      ]
    )

    if (!tax) {
      log.warn("Property tax not found for update", { taxId: id })
      return { success: false, error: "Property tax not found" }
    }

    const taxChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (oldTax) {
      if (oldTax.status !== tax.status) taxChanges.status = { old: oldTax.status, new: tax.status }
      if (oldTax.amount !== tax.amount) taxChanges.amount = { old: oldTax.amount, new: tax.amount }
      if (oldTax.payment_date !== tax.payment_date) taxChanges.payment_date = { old: oldTax.payment_date, new: tax.payment_date }
    }
    await audit({
      action: "update",
      entityType: "property_tax",
      entityId: tax.id,
      entityName: `${tax.jurisdiction} ${tax.tax_year} Q${tax.installment}`,
      changes: Object.keys(taxChanges).length > 0 ? taxChanges : undefined,
    })

    revalidatePath("/payments")
    if (d.property_id) revalidatePath(`/properties/${d.property_id}`)
    log.info("Property tax updated", { taxId: tax.id, status: tax.status })
    return { success: true, data: tax }
  } catch (error) {
    log.error("Failed to update property tax", { taxId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update property tax" }
  }
}

export async function deletePropertyTax(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.property_tax")
  try {
    const tax = await queryOne<PropertyTax>("SELECT * FROM property_taxes WHERE id = $1", [id])

    await query("DELETE FROM property_taxes WHERE id = $1", [id])

    if (tax) {
      await audit({
        action: "delete",
        entityType: "property_tax",
        entityId: id,
        entityName: `${tax.jurisdiction} ${tax.tax_year} Q${tax.installment}`,
        metadata: { amount: tax.amount },
      })
    }

    revalidatePath("/payments")
    log.info("Property tax deleted", { taxId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete property tax", { taxId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete property tax" }
  }
}

// ============================================
// Insurance Policies
// ============================================

export async function createInsurancePolicy(formData: unknown): Promise<ActionResult<InsurancePolicy>> {
  const log = getLogger("mutations.insurance")
  const parsed = insurancePolicySchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Insurance policy validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const policy = await queryOne<InsurancePolicy>(
      `INSERT INTO insurance_policies (
        property_id, vehicle_id, policy_type, carrier_name, policy_number,
        agent_name, agent_phone, agent_email, premium_amount, premium_frequency,
        coverage_amount, deductible, effective_date, expiration_date,
        auto_renew, payment_method, document_url, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), d.policy_type, d.carrier_name, emptyToNull(d.policy_number),
        emptyToNull(d.agent_name), emptyToNull(d.agent_phone), emptyToNull(d.agent_email), emptyToNull(d.premium_amount), d.premium_frequency,
        emptyToNull(d.coverage_amount), emptyToNull(d.deductible), emptyToNull(d.effective_date), emptyToNull(d.expiration_date),
        d.auto_renew, emptyToNull(d.payment_method), emptyToNull(d.document_url), emptyToNull(d.notes)
      ]
    )

    await audit({
      action: "create",
      entityType: "insurance_policy",
      entityId: policy!.id,
      entityName: `${policy!.policy_type} - ${policy!.carrier_name}`,
      metadata: { policyNumber: policy!.policy_number, expirationDate: policy!.expiration_date },
    })

    revalidatePath("/insurance")
    log.info("Insurance policy created", { policyId: policy!.id, carrier: policy!.carrier_name })
    return { success: true, data: policy! }
  } catch (error) {
    log.error("Failed to create insurance policy", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create insurance policy" }
  }
}

export async function updateInsurancePolicy(id: string, formData: unknown): Promise<ActionResult<InsurancePolicy>> {
  const log = getLogger("mutations.insurance")
  const parsed = insurancePolicySchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Insurance policy update validation failed", { policyId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldPolicy = await queryOne<InsurancePolicy>("SELECT * FROM insurance_policies WHERE id = $1", [id])

    const d = parsed.data
    const policy = await queryOne<InsurancePolicy>(
      `UPDATE insurance_policies SET
        property_id = $2,
        vehicle_id = $3,
        policy_type = COALESCE($4, policy_type),
        carrier_name = COALESCE($5, carrier_name),
        policy_number = $6,
        agent_name = $7,
        agent_phone = $8,
        agent_email = $9,
        premium_amount = $10,
        premium_frequency = COALESCE($11, premium_frequency),
        coverage_amount = $12,
        deductible = $13,
        effective_date = $14,
        expiration_date = $15,
        auto_renew = COALESCE($16, auto_renew),
        payment_method = $17,
        document_url = $18,
        notes = $19,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), d.policy_type, d.carrier_name, emptyToNull(d.policy_number),
        emptyToNull(d.agent_name), emptyToNull(d.agent_phone), emptyToNull(d.agent_email), emptyToNull(d.premium_amount), d.premium_frequency,
        emptyToNull(d.coverage_amount), emptyToNull(d.deductible), emptyToNull(d.effective_date), emptyToNull(d.expiration_date),
        d.auto_renew, emptyToNull(d.payment_method), emptyToNull(d.document_url), emptyToNull(d.notes)
      ]
    )

    if (!policy) {
      log.warn("Insurance policy not found for update", { policyId: id })
      return { success: false, error: "Insurance policy not found" }
    }

    const policyChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (oldPolicy) {
      if (oldPolicy.premium_amount !== policy.premium_amount) policyChanges.premium_amount = { old: oldPolicy.premium_amount, new: policy.premium_amount }
      if (oldPolicy.expiration_date !== policy.expiration_date) policyChanges.expiration_date = { old: oldPolicy.expiration_date, new: policy.expiration_date }
    }
    await audit({
      action: "update",
      entityType: "insurance_policy",
      entityId: policy.id,
      entityName: `${policy.policy_type} - ${policy.carrier_name}`,
      changes: Object.keys(policyChanges).length > 0 ? policyChanges : undefined,
    })

    revalidatePath("/insurance")
    log.info("Insurance policy updated", { policyId: policy.id, carrier: policy.carrier_name })
    return { success: true, data: policy }
  } catch (error) {
    log.error("Failed to update insurance policy", { policyId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update insurance policy" }
  }
}

export async function deleteInsurancePolicy(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.insurance")
  try {
    const policy = await queryOne<InsurancePolicy>("SELECT * FROM insurance_policies WHERE id = $1", [id])

    await query("DELETE FROM insurance_policies WHERE id = $1", [id])

    if (policy) {
      await audit({
        action: "delete",
        entityType: "insurance_policy",
        entityId: id,
        entityName: `${policy.policy_type} - ${policy.carrier_name}`,
        metadata: { policyNumber: policy.policy_number },
      })
    }

    revalidatePath("/insurance")
    log.info("Insurance policy deleted", { policyId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete insurance policy", { policyId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete insurance policy" }
  }
}

// ============================================
// Maintenance Tasks
// ============================================

export async function createMaintenanceTask(formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.maintenance")
  const parsed = maintenanceTaskSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Maintenance task validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const task = await queryOne<MaintenanceTask>(
      `INSERT INTO maintenance_tasks (
        property_id, vehicle_id, equipment_id, vendor_id, title, description,
        priority, due_date, completed_date, recurrence, status,
        estimated_cost, actual_cost, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), emptyToNull(d.equipment_id), emptyToNull(d.vendor_id), d.title, emptyToNull(d.description),
        d.priority, emptyToNull(d.due_date), emptyToNull(d.completed_date), d.recurrence, d.status,
        emptyToNull(d.estimated_cost), emptyToNull(d.actual_cost), emptyToNull(d.notes)
      ]
    )

    await audit({
      action: "create",
      entityType: "maintenance_task",
      entityId: task!.id,
      entityName: task!.title,
      metadata: { priority: task!.priority, dueDate: task!.due_date },
    })

    revalidatePath("/maintenance")
    log.info("Maintenance task created", { taskId: task!.id, title: task!.title })
    return { success: true, data: task! }
  } catch (error) {
    log.error("Failed to create maintenance task", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create maintenance task" }
  }
}

export async function updateMaintenanceTask(id: string, formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.maintenance")
  const parsed = maintenanceTaskSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Maintenance task update validation failed", { taskId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldTask = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])

    const d = parsed.data
    const task = await queryOne<MaintenanceTask>(
      `UPDATE maintenance_tasks SET
        property_id = $2,
        vehicle_id = $3,
        equipment_id = $4,
        vendor_id = $5,
        title = COALESCE($6, title),
        description = $7,
        priority = COALESCE($8, priority),
        due_date = $9,
        completed_date = $10,
        recurrence = COALESCE($11, recurrence),
        status = COALESCE($12, status),
        estimated_cost = $13,
        actual_cost = $14,
        notes = $15,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), emptyToNull(d.equipment_id), emptyToNull(d.vendor_id), d.title, emptyToNull(d.description),
        d.priority, emptyToNull(d.due_date), emptyToNull(d.completed_date), d.recurrence, d.status,
        emptyToNull(d.estimated_cost), emptyToNull(d.actual_cost), emptyToNull(d.notes)
      ]
    )

    if (!task) {
      log.warn("Maintenance task not found for update", { taskId: id })
      return { success: false, error: "Task not found" }
    }

    const taskChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (oldTask) {
      if (oldTask.status !== task.status) taskChanges.status = { old: oldTask.status, new: task.status }
      if (oldTask.priority !== task.priority) taskChanges.priority = { old: oldTask.priority, new: task.priority }
    }
    await audit({
      action: "update",
      entityType: "maintenance_task",
      entityId: task.id,
      entityName: task.title,
      changes: Object.keys(taskChanges).length > 0 ? taskChanges : undefined,
    })

    revalidatePath("/maintenance")
    log.info("Maintenance task updated", { taskId: task.id, title: task.title })
    return { success: true, data: task }
  } catch (error) {
    log.error("Failed to update maintenance task", { taskId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update maintenance task" }
  }
}

export async function completeMaintenanceTask(id: string, actualCost?: number): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.maintenance")
  try {
    const oldTask = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])

    const task = await queryOne<MaintenanceTask>(
      `UPDATE maintenance_tasks SET
        status = 'completed',
        completed_date = CURRENT_DATE,
        actual_cost = COALESCE($2, actual_cost),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, actualCost || null]
    )

    if (!task) {
      log.warn("Maintenance task not found for completion", { taskId: id })
      return { success: false, error: "Task not found" }
    }

    await audit({
      action: "update",
      entityType: "maintenance_task",
      entityId: task.id,
      entityName: task.title,
      changes: {
        status: { old: oldTask?.status || "pending", new: "completed" },
        completed_date: { old: null, new: task.completed_date },
      },
      metadata: actualCost ? { actualCost } : undefined,
    })

    revalidatePath("/maintenance")
    log.info("Maintenance task completed", { taskId: task.id, title: task.title })
    return { success: true, data: task }
  } catch (error) {
    log.error("Failed to complete maintenance task", { taskId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to complete task" }
  }
}

export async function deleteMaintenanceTask(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.maintenance")
  try {
    const task = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])

    await query("DELETE FROM maintenance_tasks WHERE id = $1", [id])

    if (task) {
      await audit({
        action: "delete",
        entityType: "maintenance_task",
        entityId: id,
        entityName: task.title,
      })
    }

    revalidatePath("/maintenance")
    revalidatePath("/tickets")
    log.info("Maintenance task deleted", { taskId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete maintenance task", { taskId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete maintenance task" }
  }
}

// ============================================
// Tickets (Enhanced Maintenance Tasks)
// ============================================

async function logTicketActivity(
  ticketId: string,
  action: 'created' | 'status_changed' | 'assigned' | 'updated' | 'closed',
  details?: Record<string, unknown>
): Promise<void> {
  const user = await getUser()
  const userName = user?.full_name || user?.email || 'System'

  await query(
    `INSERT INTO ticket_activity (ticket_id, user_id, user_name, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketId, user?.id || null, userName, action, details ? JSON.stringify(details) : null]
  )
}

export async function createTicket(formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.tickets")
  const parsed = ticketSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Ticket validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  const user = await getUser()

  try {
    const d = parsed.data
    const ticket = await queryOne<MaintenanceTask>(
      `INSERT INTO maintenance_tasks (
        property_id, vehicle_id, vendor_id, vendor_contact_id, title, description,
        priority, status, recurrence, estimated_cost, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'one_time', $8, $9)
      RETURNING *`,
      [
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), emptyToNull(d.vendor_id),
        emptyToNull(d.vendor_contact_id), d.title, emptyToNull(d.description),
        d.priority, emptyToNull(d.estimated_cost), emptyToNull(d.due_date)
      ]
    )

    if (ticket) {
      await logTicketActivity(ticket.id, 'created')

      // Log assignment if vendor was set
      if (d.vendor_id) {
        const vendor = await queryOne<{ company: string }>(
          "SELECT company FROM vendors WHERE id = $1",
          [d.vendor_id]
        )
        await logTicketActivity(ticket.id, 'assigned', {
          vendor: vendor?.company || 'Unknown vendor'
        })
      }
    }

    await audit({
      action: "create",
      entityType: "ticket",
      entityId: ticket!.id,
      entityName: ticket!.title,
      metadata: { priority: ticket!.priority },
    })

    revalidatePath("/tickets")
    revalidatePath("/maintenance")
    log.info("Ticket created", { ticketId: ticket!.id, title: ticket!.title })
    return { success: true, data: ticket! }
  } catch (error) {
    log.error("Failed to create ticket", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create ticket" }
  }
}

export async function updateTicket(id: string, formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.tickets")
  const parsed = ticketSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Ticket update validation failed", { ticketId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const oldTicket = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])
    if (!oldTicket) {
      return { success: false, error: "Ticket not found" }
    }

    const d = parsed.data
    const ticket = await queryOne<MaintenanceTask>(
      `UPDATE maintenance_tasks SET
        property_id = COALESCE($2, property_id),
        vehicle_id = $3,
        vendor_id = $4,
        vendor_contact_id = $5,
        title = COALESCE($6, title),
        description = $7,
        priority = COALESCE($8, priority),
        estimated_cost = $9,
        due_date = $10,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        emptyToNull(d.property_id), emptyToNull(d.vehicle_id), emptyToNull(d.vendor_id),
        emptyToNull(d.vendor_contact_id), d.title, emptyToNull(d.description),
        d.priority, emptyToNull(d.estimated_cost), emptyToNull(d.due_date)
      ]
    )

    if (!ticket) {
      return { success: false, error: "Ticket not found" }
    }

    // Log changes
    const changes: string[] = []
    if (oldTicket.priority !== ticket.priority) {
      changes.push(`priority changed to ${ticket.priority}`)
      await logTicketActivity(id, 'updated', { field: 'priority', from: oldTicket.priority, to: ticket.priority })
    }
    if (oldTicket.vendor_id !== ticket.vendor_id) {
      if (ticket.vendor_id) {
        const vendor = await queryOne<{ company: string }>(
          "SELECT company FROM vendors WHERE id = $1",
          [ticket.vendor_id]
        )
        await logTicketActivity(id, 'assigned', { vendor: vendor?.company || 'Unknown vendor' })
      }
    }
    if (oldTicket.title !== ticket.title) {
      await logTicketActivity(id, 'updated', { field: 'title', to: ticket.title })
    }

    await audit({
      action: "update",
      entityType: "ticket",
      entityId: ticket.id,
      entityName: ticket.title,
    })

    // Sync smart pins if priority changed
    if (oldTicket.priority !== ticket.priority) {
      await syncSmartPinsTickets().catch((err) =>
        log.warn("Failed to sync smart pins after ticket update", { error: err })
      )
    }

    revalidatePath("/tickets")
    revalidatePath("/maintenance")
    log.info("Ticket updated", { ticketId: ticket.id, title: ticket.title })
    return { success: true, data: ticket }
  } catch (error) {
    log.error("Failed to update ticket", { ticketId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update ticket" }
  }
}

export async function updateTicketStatus(id: string, status: 'pending' | 'in_progress'): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.tickets")

  try {
    const oldTicket = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])
    if (!oldTicket) {
      return { success: false, error: "Ticket not found" }
    }

    const ticket = await queryOne<MaintenanceTask>(
      `UPDATE maintenance_tasks SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status]
    )

    if (ticket && oldTicket.status !== status) {
      await logTicketActivity(id, 'status_changed', { from: oldTicket.status, to: status })
    }

    await audit({
      action: "update",
      entityType: "ticket",
      entityId: id,
      entityName: ticket!.title,
      changes: { status: { old: oldTicket.status, new: status } },
    })

    revalidatePath("/tickets")
    revalidatePath("/maintenance")
    log.info("Ticket status updated", { ticketId: id, from: oldTicket.status, to: status })
    return { success: true, data: ticket! }
  } catch (error) {
    log.error("Failed to update ticket status", { ticketId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update ticket status" }
  }
}

export async function closeTicket(id: string, formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const log = getLogger("mutations.tickets")
  const parsed = closeTicketSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Close ticket validation failed", { ticketId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  const user = await getUser()

  try {
    const oldTicket = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])
    if (!oldTicket) {
      return { success: false, error: "Ticket not found" }
    }

    const d = parsed.data
    const ticket = await queryOne<MaintenanceTask>(
      `UPDATE maintenance_tasks SET
        status = 'completed',
        resolution = $2,
        actual_cost = COALESCE($3, actual_cost),
        resolved_at = NOW(),
        resolved_by = $4,
        completed_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, d.resolution, emptyToNull(d.actual_cost), user?.id || null]
    )

    if (ticket) {
      await logTicketActivity(id, 'closed', {
        resolution: d.resolution,
        actual_cost: d.actual_cost || null
      })
    }

    await audit({
      action: "update",
      entityType: "ticket",
      entityId: id,
      entityName: ticket!.title,
      changes: { status: { old: oldTicket.status, new: 'completed' } },
      metadata: { resolution: d.resolution },
    })

    // Sync smart pins to remove completed ticket
    await syncSmartPinsTickets().catch((err) =>
      log.warn("Failed to sync smart pins after ticket closure", { error: err })
    )

    revalidatePath("/tickets")
    revalidatePath("/maintenance")
    log.info("Ticket closed", { ticketId: id, resolution: d.resolution })
    return { success: true, data: ticket! }
  } catch (error) {
    log.error("Failed to close ticket", { ticketId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to close ticket" }
  }
}

export async function deleteTicket(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.tickets")
  try {
    const ticket = await queryOne<MaintenanceTask>("SELECT * FROM maintenance_tasks WHERE id = $1", [id])

    await query("DELETE FROM maintenance_tasks WHERE id = $1", [id])

    if (ticket) {
      await audit({
        action: "delete",
        entityType: "ticket",
        entityId: id,
        entityName: ticket.title,
      })
    }

    revalidatePath("/tickets")
    revalidatePath("/maintenance")
    log.info("Ticket deleted", { ticketId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete ticket", { ticketId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete ticket" }
  }
}

// ============================================
// Shared Task Lists
// ============================================

export async function createSharedTaskList(formData: unknown): Promise<ActionResult<SharedTaskList>> {
  const log = getLogger("mutations.shared_task")
  const parsed = sharedTaskListSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Shared task list validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const list = await queryOne<SharedTaskList>(
      `INSERT INTO shared_task_lists (property_id, title, assigned_to, assigned_contact, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [d.property_id, d.title, emptyToNull(d.assigned_to), emptyToNull(d.assigned_contact), d.is_active]
    )

    await audit({
      action: "create",
      entityType: "shared_task_list",
      entityId: list!.id,
      entityName: list!.title,
      metadata: { assignedTo: list!.assigned_to },
    })

    revalidatePath("/maintenance")
    revalidatePath(`/properties/${d.property_id}`)
    log.info("Shared task list created", { listId: list!.id, title: list!.title })
    return { success: true, data: list! }
  } catch (error) {
    log.error("Failed to create shared task list", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create task list" }
  }
}

export async function updateSharedTaskList(id: string, formData: unknown): Promise<ActionResult<SharedTaskList>> {
  const log = getLogger("mutations.shared_task")
  const parsed = sharedTaskListSchema.partial().safeParse(formData)
  if (!parsed.success) {
    log.warn("Shared task list update validation failed", { listId: id, errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const list = await queryOne<SharedTaskList>(
      `UPDATE shared_task_lists SET
        title = COALESCE($2, title),
        assigned_to = $3,
        assigned_contact = $4,
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, d.title, emptyToNull(d.assigned_to), emptyToNull(d.assigned_contact), d.is_active]
    )

    if (!list) {
      log.warn("Shared task list not found for update", { listId: id })
      return { success: false, error: "Task list not found" }
    }

    revalidatePath("/maintenance")
    log.info("Shared task list updated", { listId: list.id, title: list.title })
    return { success: true, data: list }
  } catch (error) {
    log.error("Failed to update shared task list", { listId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update task list" }
  }
}

export async function deleteSharedTaskList(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.shared_task")
  try {
    const list = await queryOne<SharedTaskList>("SELECT * FROM shared_task_lists WHERE id = $1", [id])

    await query("DELETE FROM shared_task_lists WHERE id = $1", [id])

    if (list) {
      await audit({
        action: "delete",
        entityType: "shared_task_list",
        entityId: id,
        entityName: list.title,
      })
    }

    revalidatePath("/maintenance")
    log.info("Shared task list deleted", { listId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete shared task list", { listId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete task list" }
  }
}

// Shared Task Items
export async function createSharedTaskItem(formData: unknown): Promise<ActionResult<SharedTaskItem>> {
  const log = getLogger("mutations.shared_task")
  const parsed = sharedTaskItemSchema.safeParse(formData)
  if (!parsed.success) {
    log.warn("Shared task item validation failed", { errors: parsed.error.errors })
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const item = await queryOne<SharedTaskItem>(
      `INSERT INTO shared_task_items (list_id, task, is_completed, completed_date, priority, notes, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [d.list_id, d.task, d.is_completed, emptyToNull(d.completed_date), d.priority, emptyToNull(d.notes), d.sort_order]
    )

    revalidatePath("/maintenance")
    log.info("Shared task item created", { itemId: item!.id, task: item!.task })
    return { success: true, data: item! }
  } catch (error) {
    log.error("Failed to create task item", { error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to create task item" }
  }
}

export async function toggleSharedTaskItem(id: string): Promise<ActionResult<SharedTaskItem>> {
  const log = getLogger("mutations.shared_task")
  try {
    const item = await queryOne<SharedTaskItem>(
      `UPDATE shared_task_items SET
        is_completed = NOT is_completed,
        completed_date = CASE WHEN is_completed THEN NULL ELSE CURRENT_DATE END
      WHERE id = $1
      RETURNING *`,
      [id]
    )

    if (!item) {
      log.warn("Task item not found for toggle", { itemId: id })
      return { success: false, error: "Task item not found" }
    }

    revalidatePath("/maintenance")
    log.info("Shared task item toggled", { itemId: item.id, isCompleted: item.is_completed })
    return { success: true, data: item }
  } catch (error) {
    log.error("Failed to toggle task item", { itemId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to toggle task item" }
  }
}

export async function deleteSharedTaskItem(id: string): Promise<ActionResult> {
  const log = getLogger("mutations.shared_task")
  try {
    await query("DELETE FROM shared_task_items WHERE id = $1", [id])
    revalidatePath("/maintenance")
    log.info("Shared task item deleted", { itemId: id })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete task item", { itemId: id, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to delete task item" }
  }
}

// ============================================
// Property-Vendor Associations
// ============================================

export async function updateVendorProperties(
  vendorId: string,
  propertyIds: string[]
): Promise<ActionResult> {
  const log = getLogger("mutations.vendor")
  try {
    // Delete existing associations
    await query("DELETE FROM property_vendors WHERE vendor_id = $1", [vendorId])

    // Insert new associations
    if (propertyIds.length > 0) {
      const values = propertyIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ")
      await query(
        `INSERT INTO property_vendors (vendor_id, property_id) VALUES ${values}`,
        [vendorId, ...propertyIds]
      )
    }

    await audit({
      action: "update",
      entityType: "vendor",
      entityId: vendorId,
      entityName: `Vendor ${vendorId}`,
      metadata: { propertyCount: propertyIds.length },
    })

    revalidatePath("/vendors")
    revalidatePath(`/vendors/${vendorId}`)
    log.info("Vendor properties updated", { vendorId, propertyCount: propertyIds.length })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to update vendor properties", { vendorId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to update vendor properties" }
  }
}

export async function addVendorToProperty(
  vendorId: string,
  propertyId: string,
  isPrimary: boolean = false
): Promise<ActionResult> {
  const log = getLogger("mutations.vendor")
  try {
    await query(
      `INSERT INTO property_vendors (vendor_id, property_id, is_primary)
       VALUES ($1, $2, $3)
       ON CONFLICT (property_id, vendor_id, specialty_override) DO UPDATE
       SET is_primary = $3`,
      [vendorId, propertyId, isPrimary]
    )

    revalidatePath("/vendors")
    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath(`/properties/${propertyId}`)
    log.info("Vendor added to property", { vendorId, propertyId, isPrimary })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to add vendor to property", { vendorId, propertyId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to add vendor to property" }
  }
}

export async function removeVendorFromProperty(
  vendorId: string,
  propertyId: string
): Promise<ActionResult> {
  const log = getLogger("mutations.vendor")
  try {
    await query(
      "DELETE FROM property_vendors WHERE vendor_id = $1 AND property_id = $2",
      [vendorId, propertyId]
    )

    revalidatePath("/vendors")
    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath(`/properties/${propertyId}`)
    log.info("Vendor removed from property", { vendorId, propertyId })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to remove vendor from property", { vendorId, propertyId, error: error instanceof Error ? error.message : "Unknown" })
    return { success: false, error: "Failed to remove vendor from property" }
  }
}

// ============================================
// Pin Notes
// ============================================

/**
 * Upsert (create or update) a pin note
 * One note per user per pin
 */
export async function upsertPinNote(params: {
  entityType: string
  entityId: string
  userId: string
  userName: string
  note: string
  dueDate?: string | null
}): Promise<ActionResult> {
  const log = getLogger("mutations.pin-note")

  try {
    // Validate note length
    if (!params.note || params.note.trim().length === 0) {
      return { success: false, error: "Note cannot be empty" }
    }

    if (params.note.length > 500) {
      return { success: false, error: "Note cannot exceed 500 characters" }
    }

    const trimmedNote = params.note.trim()

    // Upsert the note (insert or update if exists)
    await query(
      `INSERT INTO pin_notes (entity_type, entity_id, user_id, user_name, note, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (entity_type, entity_id, user_id)
       DO UPDATE SET
         note = EXCLUDED.note,
         due_date = EXCLUDED.due_date,
         updated_at = NOW()`,
      [params.entityType, params.entityId, params.userId, params.userName, trimmedNote, params.dueDate || null]
    )

    log.info("Pin note upserted", {
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      noteLength: trimmedNote.length,
      hasDueDate: !!params.dueDate
    })

    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to upsert pin note", {
      entityType: params.entityType,
      entityId: params.entityId,
      error: error instanceof Error ? error.message : "Unknown"
    })
    return { success: false, error: "Failed to save note" }
  }
}

/**
 * Delete a pin note
 * Any user can delete any note
 */
export async function deletePinNote(noteId: string): Promise<ActionResult> {
  const log = getLogger("mutations.pin-note")

  try {
    await query("DELETE FROM pin_notes WHERE id = $1", [noteId])

    log.info("Pin note deleted", { noteId })
    return { success: true, data: undefined }
  } catch (error) {
    log.error("Failed to delete pin note", {
      noteId,
      error: error instanceof Error ? error.message : "Unknown"
    })
    return { success: false, error: "Failed to delete note" }
  }
}
