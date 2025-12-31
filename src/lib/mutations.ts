"use server"

import { revalidatePath } from "next/cache"
import { query, queryOne } from "./db"
import type {
  Property,
  Vehicle,
  Vendor,
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
  type ActionResult,
} from "./schemas"

// ============================================
// Properties
// ============================================

export async function createProperty(formData: unknown): Promise<ActionResult<Property>> {
  const parsed = propertySchema.safeParse(formData)
  if (!parsed.success) {
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
        d.name, d.address, d.city, d.state || null, d.country, d.postal_code || null,
        d.property_type, d.square_feet || null, d.purchase_date || null, d.purchase_price || null, d.current_value || null,
        d.span_number || null, d.block_number || null, d.lot_number || null, d.parcel_id || null,
        d.has_mortgage, d.mortgage_lender || null, d.mortgage_account || null, d.mortgage_payment || null, d.mortgage_due_day || null,
        d.notes || null, d.status
      ]
    )

    revalidatePath("/properties")
    return { success: true, data: property! }
  } catch (error) {
    console.error("Failed to create property:", error)
    return { success: false, error: "Failed to create property" }
  }
}

export async function updateProperty(id: string, formData: unknown): Promise<ActionResult<Property>> {
  const parsed = propertySchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        d.name, d.address, d.city, d.state ?? null, d.country, d.postal_code ?? null,
        d.property_type, d.square_feet ?? null, d.purchase_date ?? null, d.purchase_price ?? null, d.current_value ?? null,
        d.span_number ?? null, d.block_number ?? null, d.lot_number ?? null, d.parcel_id ?? null,
        d.has_mortgage, d.mortgage_lender ?? null, d.mortgage_account ?? null, d.mortgage_payment ?? null, d.mortgage_due_day ?? null,
        d.notes ?? null, d.status
      ]
    )

    if (!property) {
      return { success: false, error: "Property not found" }
    }

    revalidatePath("/properties")
    revalidatePath(`/properties/${id}`)
    return { success: true, data: property }
  } catch (error) {
    console.error("Failed to update property:", error)
    return { success: false, error: "Failed to update property" }
  }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM properties WHERE id = $1", [id])
    revalidatePath("/properties")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete property:", error)
    return { success: false, error: "Failed to delete property" }
  }
}

// ============================================
// Vendors
// ============================================

export async function createVendor(formData: unknown): Promise<ActionResult<Vendor>> {
  const parsed = vendorSchema.safeParse(formData)
  if (!parsed.success) {
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
        d.name, d.company || null, d.specialty, d.phone || null, d.email || null, d.address || null, d.website || null,
        d.emergency_phone || null, d.account_number || null, d.payment_method || null, d.login_info || null,
        d.notes || null, d.rating || null, d.is_active
      ]
    )

    revalidatePath("/vendors")
    return { success: true, data: vendor! }
  } catch (error) {
    console.error("Failed to create vendor:", error)
    return { success: false, error: "Failed to create vendor" }
  }
}

export async function updateVendor(id: string, formData: unknown): Promise<ActionResult<Vendor>> {
  const parsed = vendorSchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        d.name, d.company ?? null, d.specialty, d.phone ?? null, d.email ?? null, d.address ?? null, d.website ?? null,
        d.emergency_phone ?? null, d.account_number ?? null, d.payment_method ?? null, d.login_info ?? null,
        d.notes ?? null, d.rating ?? null, d.is_active
      ]
    )

    if (!vendor) {
      return { success: false, error: "Vendor not found" }
    }

    revalidatePath("/vendors")
    revalidatePath(`/vendors/${id}`)
    return { success: true, data: vendor }
  } catch (error) {
    console.error("Failed to update vendor:", error)
    return { success: false, error: "Failed to update vendor" }
  }
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM vendors WHERE id = $1", [id])
    revalidatePath("/vendors")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete vendor:", error)
    return { success: false, error: "Failed to delete vendor" }
  }
}

// ============================================
// Vehicles
// ============================================

export async function createVehicle(formData: unknown): Promise<ActionResult<Vehicle>> {
  const parsed = vehicleSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const vehicle = await queryOne<Vehicle>(
      `INSERT INTO vehicles (
        year, make, model, color, vin, license_plate,
        registration_state, registration_expires, inspection_expires,
        garage_location, notes, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        d.year, d.make, d.model, d.color || null, d.vin || null, d.license_plate || null,
        d.registration_state, d.registration_expires || null, d.inspection_expires || null,
        d.garage_location || null, d.notes || null, d.is_active
      ]
    )

    revalidatePath("/vehicles")
    return { success: true, data: vehicle! }
  } catch (error) {
    console.error("Failed to create vehicle:", error)
    return { success: false, error: "Failed to create vehicle" }
  }
}

export async function updateVehicle(id: string, formData: unknown): Promise<ActionResult<Vehicle>> {
  const parsed = vehicleSchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        notes = $12,
        is_active = COALESCE($13, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        d.year, d.make, d.model, d.color ?? null, d.vin ?? null, d.license_plate ?? null,
        d.registration_state, d.registration_expires ?? null, d.inspection_expires ?? null,
        d.garage_location ?? null, d.notes ?? null, d.is_active
      ]
    )

    if (!vehicle) {
      return { success: false, error: "Vehicle not found" }
    }

    revalidatePath("/vehicles")
    revalidatePath(`/vehicles/${id}`)
    return { success: true, data: vehicle }
  } catch (error) {
    console.error("Failed to update vehicle:", error)
    return { success: false, error: "Failed to update vehicle" }
  }
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM vehicles WHERE id = $1", [id])
    revalidatePath("/vehicles")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete vehicle:", error)
    return { success: false, error: "Failed to delete vehicle" }
  }
}

// ============================================
// Bills
// ============================================

export async function createBill(formData: unknown): Promise<ActionResult<Bill>> {
  const parsed = billSchema.safeParse(formData)
  if (!parsed.success) {
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
        d.property_id || null, d.vehicle_id || null, d.vendor_id || null, d.bill_type, d.description || null,
        d.amount, d.currency, d.due_date, d.recurrence, d.status,
        d.payment_method || null, d.payment_date || null, d.payment_reference || null,
        d.confirmation_date || null, d.confirmation_notes || null, d.days_to_confirm,
        d.document_url || null, d.notes || null
      ]
    )

    revalidatePath("/payments")
    return { success: true, data: bill! }
  } catch (error) {
    console.error("Failed to create bill:", error)
    return { success: false, error: "Failed to create bill" }
  }
}

export async function updateBill(id: string, formData: unknown): Promise<ActionResult<Bill>> {
  const parsed = billSchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        d.property_id ?? null, d.vehicle_id ?? null, d.vendor_id ?? null, d.bill_type, d.description ?? null,
        d.amount, d.currency, d.due_date, d.recurrence, d.status,
        d.payment_method ?? null, d.payment_date ?? null, d.payment_reference ?? null,
        d.confirmation_date ?? null, d.confirmation_notes ?? null, d.days_to_confirm,
        d.document_url ?? null, d.notes ?? null
      ]
    )

    if (!bill) {
      return { success: false, error: "Bill not found" }
    }

    revalidatePath("/payments")
    return { success: true, data: bill }
  } catch (error) {
    console.error("Failed to update bill:", error)
    return { success: false, error: "Failed to update bill" }
  }
}

export async function markBillPaid(id: string, paymentDate: string, paymentMethod?: string): Promise<ActionResult<Bill>> {
  try {
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
      return { success: false, error: "Bill not found" }
    }

    revalidatePath("/payments")
    return { success: true, data: bill }
  } catch (error) {
    console.error("Failed to mark bill paid:", error)
    return { success: false, error: "Failed to mark bill paid" }
  }
}

export async function confirmBillPayment(id: string, notes?: string): Promise<ActionResult<Bill>> {
  try {
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
      return { success: false, error: "Bill not found" }
    }

    revalidatePath("/payments")
    return { success: true, data: bill }
  } catch (error) {
    console.error("Failed to confirm payment:", error)
    return { success: false, error: "Failed to confirm payment" }
  }
}

export async function deleteBill(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM bills WHERE id = $1", [id])
    revalidatePath("/payments")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete bill:", error)
    return { success: false, error: "Failed to delete bill" }
  }
}

// ============================================
// Property Taxes
// ============================================

export async function createPropertyTax(formData: unknown): Promise<ActionResult<PropertyTax>> {
  const parsed = propertyTaxSchema.safeParse(formData)
  if (!parsed.success) {
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
        d.due_date, d.payment_url || null, d.status, d.payment_date || null, d.confirmation_date || null, d.notes || null
      ]
    )

    revalidatePath("/payments")
    revalidatePath(`/properties/${d.property_id}`)
    return { success: true, data: tax! }
  } catch (error) {
    console.error("Failed to create property tax:", error)
    return { success: false, error: "Failed to create property tax record" }
  }
}

export async function updatePropertyTax(id: string, formData: unknown): Promise<ActionResult<PropertyTax>> {
  const parsed = propertyTaxSchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        d.due_date, d.payment_url ?? null, d.status, d.payment_date ?? null, d.confirmation_date ?? null, d.notes ?? null
      ]
    )

    if (!tax) {
      return { success: false, error: "Property tax not found" }
    }

    revalidatePath("/payments")
    if (d.property_id) revalidatePath(`/properties/${d.property_id}`)
    return { success: true, data: tax }
  } catch (error) {
    console.error("Failed to update property tax:", error)
    return { success: false, error: "Failed to update property tax" }
  }
}

export async function deletePropertyTax(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM property_taxes WHERE id = $1", [id])
    revalidatePath("/payments")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete property tax:", error)
    return { success: false, error: "Failed to delete property tax" }
  }
}

// ============================================
// Insurance Policies
// ============================================

export async function createInsurancePolicy(formData: unknown): Promise<ActionResult<InsurancePolicy>> {
  const parsed = insurancePolicySchema.safeParse(formData)
  if (!parsed.success) {
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
        d.property_id || null, d.vehicle_id || null, d.policy_type, d.carrier_name, d.policy_number || null,
        d.agent_name || null, d.agent_phone || null, d.agent_email || null, d.premium_amount || null, d.premium_frequency,
        d.coverage_amount || null, d.deductible || null, d.effective_date || null, d.expiration_date || null,
        d.auto_renew, d.payment_method || null, d.document_url || null, d.notes || null
      ]
    )

    revalidatePath("/insurance")
    return { success: true, data: policy! }
  } catch (error) {
    console.error("Failed to create insurance policy:", error)
    return { success: false, error: "Failed to create insurance policy" }
  }
}

export async function updateInsurancePolicy(id: string, formData: unknown): Promise<ActionResult<InsurancePolicy>> {
  const parsed = insurancePolicySchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        d.property_id ?? null, d.vehicle_id ?? null, d.policy_type, d.carrier_name, d.policy_number ?? null,
        d.agent_name ?? null, d.agent_phone ?? null, d.agent_email ?? null, d.premium_amount ?? null, d.premium_frequency,
        d.coverage_amount ?? null, d.deductible ?? null, d.effective_date ?? null, d.expiration_date ?? null,
        d.auto_renew, d.payment_method ?? null, d.document_url ?? null, d.notes ?? null
      ]
    )

    if (!policy) {
      return { success: false, error: "Insurance policy not found" }
    }

    revalidatePath("/insurance")
    return { success: true, data: policy }
  } catch (error) {
    console.error("Failed to update insurance policy:", error)
    return { success: false, error: "Failed to update insurance policy" }
  }
}

export async function deleteInsurancePolicy(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM insurance_policies WHERE id = $1", [id])
    revalidatePath("/insurance")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete insurance policy:", error)
    return { success: false, error: "Failed to delete insurance policy" }
  }
}

// ============================================
// Maintenance Tasks
// ============================================

export async function createMaintenanceTask(formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const parsed = maintenanceTaskSchema.safeParse(formData)
  if (!parsed.success) {
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
        d.property_id || null, d.vehicle_id || null, d.equipment_id || null, d.vendor_id || null, d.title, d.description || null,
        d.priority, d.due_date || null, d.completed_date || null, d.recurrence, d.status,
        d.estimated_cost || null, d.actual_cost || null, d.notes || null
      ]
    )

    revalidatePath("/maintenance")
    return { success: true, data: task! }
  } catch (error) {
    console.error("Failed to create maintenance task:", error)
    return { success: false, error: "Failed to create maintenance task" }
  }
}

export async function updateMaintenanceTask(id: string, formData: unknown): Promise<ActionResult<MaintenanceTask>> {
  const parsed = maintenanceTaskSchema.partial().safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
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
        d.property_id ?? null, d.vehicle_id ?? null, d.equipment_id ?? null, d.vendor_id ?? null, d.title, d.description ?? null,
        d.priority, d.due_date ?? null, d.completed_date ?? null, d.recurrence, d.status,
        d.estimated_cost ?? null, d.actual_cost ?? null, d.notes ?? null
      ]
    )

    if (!task) {
      return { success: false, error: "Task not found" }
    }

    revalidatePath("/maintenance")
    return { success: true, data: task }
  } catch (error) {
    console.error("Failed to update maintenance task:", error)
    return { success: false, error: "Failed to update maintenance task" }
  }
}

export async function completeMaintenanceTask(id: string, actualCost?: number): Promise<ActionResult<MaintenanceTask>> {
  try {
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
      return { success: false, error: "Task not found" }
    }

    revalidatePath("/maintenance")
    return { success: true, data: task }
  } catch (error) {
    console.error("Failed to complete task:", error)
    return { success: false, error: "Failed to complete task" }
  }
}

export async function deleteMaintenanceTask(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM maintenance_tasks WHERE id = $1", [id])
    revalidatePath("/maintenance")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete maintenance task:", error)
    return { success: false, error: "Failed to delete maintenance task" }
  }
}

// ============================================
// Shared Task Lists
// ============================================

export async function createSharedTaskList(formData: unknown): Promise<ActionResult<SharedTaskList>> {
  const parsed = sharedTaskListSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const list = await queryOne<SharedTaskList>(
      `INSERT INTO shared_task_lists (property_id, title, assigned_to, assigned_contact, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [d.property_id, d.title, d.assigned_to || null, d.assigned_contact || null, d.is_active]
    )

    revalidatePath("/maintenance")
    revalidatePath(`/properties/${d.property_id}`)
    return { success: true, data: list! }
  } catch (error) {
    console.error("Failed to create shared task list:", error)
    return { success: false, error: "Failed to create task list" }
  }
}

export async function updateSharedTaskList(id: string, formData: unknown): Promise<ActionResult<SharedTaskList>> {
  const parsed = sharedTaskListSchema.partial().safeParse(formData)
  if (!parsed.success) {
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
      [id, d.title, d.assigned_to ?? null, d.assigned_contact ?? null, d.is_active]
    )

    if (!list) {
      return { success: false, error: "Task list not found" }
    }

    revalidatePath("/maintenance")
    return { success: true, data: list }
  } catch (error) {
    console.error("Failed to update shared task list:", error)
    return { success: false, error: "Failed to update task list" }
  }
}

export async function deleteSharedTaskList(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM shared_task_lists WHERE id = $1", [id])
    revalidatePath("/maintenance")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete shared task list:", error)
    return { success: false, error: "Failed to delete task list" }
  }
}

// Shared Task Items
export async function createSharedTaskItem(formData: unknown): Promise<ActionResult<SharedTaskItem>> {
  const parsed = sharedTaskItemSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    const d = parsed.data
    const item = await queryOne<SharedTaskItem>(
      `INSERT INTO shared_task_items (list_id, task, is_completed, completed_date, priority, notes, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [d.list_id, d.task, d.is_completed, d.completed_date || null, d.priority, d.notes || null, d.sort_order]
    )

    revalidatePath("/maintenance")
    return { success: true, data: item! }
  } catch (error) {
    console.error("Failed to create task item:", error)
    return { success: false, error: "Failed to create task item" }
  }
}

export async function toggleSharedTaskItem(id: string): Promise<ActionResult<SharedTaskItem>> {
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
      return { success: false, error: "Task item not found" }
    }

    revalidatePath("/maintenance")
    return { success: true, data: item }
  } catch (error) {
    console.error("Failed to toggle task item:", error)
    return { success: false, error: "Failed to toggle task item" }
  }
}

export async function deleteSharedTaskItem(id: string): Promise<ActionResult> {
  try {
    await query("DELETE FROM shared_task_items WHERE id = $1", [id])
    revalidatePath("/maintenance")
    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete task item:", error)
    return { success: false, error: "Failed to delete task item" }
  }
}
