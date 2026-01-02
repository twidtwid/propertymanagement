import { z } from "zod"

// ============================================
// Property Schema
// ============================================

export const propertySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  address: z.string().min(1, "Address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().max(50).nullable().optional(),
  country: z.string().default("USA"),
  postal_code: z.string().max(20).nullable().optional(),
  property_type: z.enum(["house", "condo", "land", "other"]).default("house"),
  square_feet: z.coerce.number().positive().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  purchase_price: z.coerce.number().positive().nullable().optional(),
  current_value: z.coerce.number().positive().nullable().optional(),
  span_number: z.string().max(50).nullable().optional(),
  block_number: z.string().max(50).nullable().optional(),
  lot_number: z.string().max(50).nullable().optional(),
  parcel_id: z.string().max(50).nullable().optional(),
  tax_lookup_url: z.string().url("Invalid URL").or(z.literal("")).nullable().optional(),
  has_mortgage: z.boolean().default(false),
  mortgage_lender: z.string().max(100).nullable().optional(),
  mortgage_account: z.string().max(50).nullable().optional(),
  mortgage_payment: z.coerce.number().positive().nullable().optional(),
  mortgage_due_day: z.coerce.number().min(1).max(31).nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "sold"]).default("active"),
})

export type PropertyFormData = z.infer<typeof propertySchema>

// ============================================
// Vendor Schema
// ============================================

const vendorSpecialties = [
  "hvac", "plumbing", "electrical", "roofing", "general_contractor",
  "landscaping", "cleaning", "pest_control", "pool_spa", "appliance",
  "locksmith", "alarm_security", "snow_removal", "fuel_oil",
  "property_management", "architect", "movers", "trash", "internet",
  "phone", "water", "septic", "forester", "fireplace", "insurance",
  "auto", "elevator", "flooring", "parking", "masonry", "audiovisual", "other"
] as const

export const vendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  company: z.string().max(100).nullable().optional(),
  specialty: z.enum(vendorSpecialties).default("other"),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  website: z.string().url("Invalid URL").or(z.literal("")).nullable().optional(),
  emergency_phone: z.string().max(30).nullable().optional(),
  account_number: z.string().max(50).nullable().optional(),
  payment_method: z.enum(["check", "auto_pay", "online", "wire", "cash", "other"]).nullable().optional(),
  login_info: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.coerce.number().min(1).max(5).nullable().optional(),
  is_active: z.boolean().default(true),
})

export type VendorFormData = z.infer<typeof vendorSchema>

// ============================================
// Vehicle Schema
// ============================================

export const vehicleSchema = z.object({
  year: z.coerce.number().min(1900).max(2100),
  make: z.string().min(1, "Make is required").max(50),
  model: z.string().min(1, "Model is required").max(50),
  color: z.string().max(30).nullable().optional(),
  vin: z.string().max(20).nullable().optional(),
  license_plate: z.string().max(15).nullable().optional(),
  registration_state: z.string().max(10).default("RI"),
  registration_expires: z.string().nullable().optional(),
  inspection_expires: z.string().nullable().optional(),
  garage_location: z.string().max(100).nullable().optional(),
  property_id: z.string().uuid().nullable().optional(), // Home property for visibility inheritance
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
})

export type VehicleFormData = z.infer<typeof vehicleSchema>

// ============================================
// Bill Schema
// ============================================

export const billSchema = z.object({
  property_id: z.string().uuid().nullable().optional(),
  vehicle_id: z.string().uuid().nullable().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  bill_type: z.enum(["property_tax", "insurance", "utility", "maintenance", "mortgage", "hoa", "other"]),
  description: z.string().max(200).nullable().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  due_date: z.string().min(1, "Due date is required"),
  recurrence: z.enum(["one_time", "monthly", "quarterly", "semi_annual", "annual"]).default("one_time"),
  status: z.enum(["pending", "sent", "confirmed", "overdue", "cancelled"]).default("pending"),
  payment_method: z.enum(["check", "auto_pay", "online", "wire", "cash", "other"]).nullable().optional(),
  payment_date: z.string().nullable().optional(),
  payment_reference: z.string().max(100).nullable().optional(),
  confirmation_date: z.string().nullable().optional(),
  confirmation_notes: z.string().nullable().optional(),
  days_to_confirm: z.coerce.number().min(1).max(90).default(14),
  document_url: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type BillFormData = z.infer<typeof billSchema>

// ============================================
// Property Tax Schema
// ============================================

export const propertyTaxSchema = z.object({
  property_id: z.string().uuid("Property is required"),
  tax_year: z.coerce.number().min(2000).max(2100),
  jurisdiction: z.string().min(1, "Jurisdiction is required").max(100),
  installment: z.coerce.number().min(1).max(4).default(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  due_date: z.string().min(1, "Due date is required"),
  payment_url: z.string().url().or(z.literal("")).nullable().optional(),
  status: z.enum(["pending", "sent", "confirmed", "overdue", "cancelled"]).default("pending"),
  payment_date: z.string().nullable().optional(),
  confirmation_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type PropertyTaxFormData = z.infer<typeof propertyTaxSchema>

// ============================================
// Maintenance Task Schema
// ============================================

export const maintenanceTaskSchema = z.object({
  property_id: z.string().uuid().nullable().optional(),
  vehicle_id: z.string().uuid().nullable().optional(),
  equipment_id: z.string().uuid().nullable().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().nullable().optional(),
  completed_date: z.string().nullable().optional(),
  recurrence: z.enum(["one_time", "monthly", "quarterly", "semi_annual", "annual"]).default("one_time"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  estimated_cost: z.coerce.number().positive().nullable().optional(),
  actual_cost: z.coerce.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type MaintenanceTaskFormData = z.infer<typeof maintenanceTaskSchema>

// ============================================
// Insurance Policy Schema
// ============================================

export const insurancePolicySchema = z.object({
  property_id: z.string().uuid().nullable().optional(),
  vehicle_id: z.string().uuid().nullable().optional(),
  policy_type: z.enum(["homeowners", "auto", "umbrella", "flood", "earthquake", "liability", "health", "travel", "other"]),
  carrier_name: z.string().min(1, "Carrier name is required").max(100),
  policy_number: z.string().max(50).nullable().optional(),
  agent_name: z.string().max(100).nullable().optional(),
  agent_phone: z.string().max(30).nullable().optional(),
  agent_email: z.string().email("Invalid email").or(z.literal("")).nullable().optional(),
  premium_amount: z.coerce.number().positive().nullable().optional(),
  premium_frequency: z.enum(["one_time", "monthly", "quarterly", "semi_annual", "annual"]).default("annual"),
  coverage_amount: z.coerce.number().positive().nullable().optional(),
  deductible: z.coerce.number().positive().nullable().optional(),
  effective_date: z.string().nullable().optional(),
  expiration_date: z.string().nullable().optional(),
  auto_renew: z.boolean().default(true),
  payment_method: z.enum(["check", "auto_pay", "online", "wire", "cash", "other"]).nullable().optional(),
  document_url: z.string().url().or(z.literal("")).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type InsurancePolicyFormData = z.infer<typeof insurancePolicySchema>

// ============================================
// Shared Task List Schema
// ============================================

export const sharedTaskListSchema = z.object({
  property_id: z.string().uuid("Property is required"),
  title: z.string().min(1, "Title is required").max(200),
  assigned_to: z.string().max(100).nullable().optional(),
  assigned_contact: z.string().max(100).nullable().optional(),
  is_active: z.boolean().default(true),
})

export type SharedTaskListFormData = z.infer<typeof sharedTaskListSchema>

export const sharedTaskItemSchema = z.object({
  list_id: z.string().uuid("List is required"),
  task: z.string().min(1, "Task is required").max(500),
  is_completed: z.boolean().default(false),
  completed_date: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  notes: z.string().nullable().optional(),
  sort_order: z.coerce.number().default(0),
})

export type SharedTaskItemFormData = z.infer<typeof sharedTaskItemSchema>

// ============================================
// Action Result Type
// ============================================

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
