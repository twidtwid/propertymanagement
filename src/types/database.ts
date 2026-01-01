// Database types for Property Management System

export type UserRole = 'owner' | 'bookkeeper'
export type PropertyType = 'house' | 'condo' | 'land' | 'other'
export type PropertyStatus = 'active' | 'inactive' | 'sold'
export type PaymentStatus = 'pending' | 'sent' | 'confirmed' | 'overdue' | 'cancelled'
export type PaymentMethod = 'check' | 'auto_pay' | 'online' | 'wire' | 'cash' | 'other'
export type BillType = 'property_tax' | 'insurance' | 'utility' | 'maintenance' | 'mortgage' | 'hoa' | 'other'
export type Recurrence = 'one_time' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type InsuranceType = 'homeowners' | 'auto' | 'umbrella' | 'flood' | 'earthquake' | 'liability' | 'health' | 'travel' | 'other'
export type ClaimStatus = 'filed' | 'in_progress' | 'approved' | 'denied' | 'settled'
export type VendorSpecialty =
  | 'hvac' | 'plumbing' | 'electrical' | 'roofing' | 'general_contractor'
  | 'landscaping' | 'cleaning' | 'pest_control' | 'pool_spa' | 'appliance'
  | 'locksmith' | 'alarm_security' | 'snow_removal' | 'fuel_oil'
  | 'property_management' | 'architect' | 'movers' | 'trash' | 'internet'
  | 'phone' | 'water' | 'septic' | 'forester' | 'fireplace' | 'insurance'
  | 'auto' | 'elevator' | 'flooring' | 'parking' | 'masonry' | 'other'
export type Season = 'winter' | 'spring' | 'summer' | 'fall' | 'annual'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string | null
  country: string
  postal_code: string | null
  property_type: PropertyType
  square_feet: number | null
  purchase_date: string | null
  purchase_price: number | null
  current_value: number | null
  span_number: string | null
  block_number: string | null
  lot_number: string | null
  parcel_id: string | null
  has_mortgage: boolean
  mortgage_lender: string | null
  mortgage_account: string | null
  mortgage_payment: number | null
  mortgage_due_day: number | null
  notes: string | null
  status: PropertyStatus
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  year: number
  make: string
  model: string
  color: string | null
  vin: string | null
  license_plate: string | null
  registration_state: string
  registration_expires: string | null
  inspection_expires: string | null
  garage_location: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Vendor {
  id: string
  name: string
  company: string | null
  specialty: VendorSpecialty
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  emergency_phone: string | null
  account_number: string | null
  payment_method: PaymentMethod | null
  login_info: string | null
  notes: string | null
  rating: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PropertyVendor {
  id: string
  property_id: string
  vendor_id: string
  is_primary: boolean
  specialty_override: VendorSpecialty | null
  notes: string | null
  last_service_date: string | null
  created_at: string
  // Joined fields
  vendor?: Vendor
  property?: Property
}

export interface Equipment {
  id: string
  property_id: string
  name: string
  category: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  install_date: string | null
  expected_lifespan_years: number | null
  warranty_expires: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Bill {
  id: string
  property_id: string | null
  vehicle_id: string | null
  vendor_id: string | null
  bill_type: BillType
  description: string | null
  amount: number
  currency: string
  due_date: string
  recurrence: Recurrence
  status: PaymentStatus
  payment_method: PaymentMethod | null
  payment_date: string | null
  payment_reference: string | null
  confirmation_date: string | null
  confirmation_notes: string | null
  days_to_confirm: number
  document_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  vehicle?: Vehicle
  vendor?: Vendor
}

export interface PropertyTax {
  id: string
  property_id: string
  tax_year: number
  jurisdiction: string
  installment: number
  amount: number
  due_date: string
  payment_url: string | null
  status: PaymentStatus
  payment_date: string | null
  confirmation_date: string | null
  notes: string | null
  created_at: string
  // Joined fields
  property?: Property
}

export interface InsurancePolicy {
  id: string
  property_id: string | null
  vehicle_id: string | null
  policy_type: InsuranceType
  carrier_name: string
  policy_number: string | null
  agent_name: string | null
  agent_phone: string | null
  agent_email: string | null
  premium_amount: number | null
  premium_frequency: Recurrence
  coverage_amount: number | null
  deductible: number | null
  effective_date: string | null
  expiration_date: string | null
  auto_renew: boolean
  payment_method: PaymentMethod | null
  document_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  vehicle?: Vehicle
}

export interface InsuranceClaim {
  id: string
  policy_id: string
  claim_number: string | null
  claim_date: string
  incident_date: string | null
  incident_description: string | null
  claim_amount: number | null
  settlement_amount: number | null
  status: ClaimStatus
  adjuster_name: string | null
  adjuster_phone: string | null
  notes: string | null
  document_urls: string[]
  created_at: string
  updated_at: string
  // Joined fields
  policy?: InsurancePolicy
}

export interface MaintenanceTask {
  id: string
  property_id: string | null
  vehicle_id: string | null
  equipment_id: string | null
  vendor_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  completed_date: string | null
  recurrence: Recurrence
  status: TaskStatus
  estimated_cost: number | null
  actual_cost: number | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  vehicle?: Vehicle
  equipment?: Equipment
  vendor?: Vendor
}

export interface MaintenanceHistory {
  id: string
  property_id: string | null
  vehicle_id: string | null
  vendor_id: string | null
  work_date: string
  description: string
  done_by: string | null
  cost: number | null
  notes: string | null
  created_at: string
}

export interface Document {
  id: string
  property_id: string | null
  vehicle_id: string | null
  bill_id: string | null
  policy_id: string | null
  document_type: string | null
  filename: string
  storage_url: string
  file_size: number | null
  mime_type: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface SeasonalTask {
  id: string
  property_id: string | null
  season: Season
  task: string
  is_completed: boolean
  completed_date: string | null
  notes: string | null
  created_at: string
}

export interface Professional {
  id: string
  role: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Alert {
  id: string
  user_id: string | null
  alert_type: string
  title: string
  message: string | null
  severity: AlertSeverity
  related_table: string | null
  related_id: string | null
  is_read: boolean
  is_dismissed: boolean
  created_at: string
}

export interface SharedTaskList {
  id: string
  property_id: string
  title: string
  assigned_to: string | null
  assigned_contact: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  items?: SharedTaskItem[]
}

export interface SharedTaskItem {
  id: string
  list_id: string
  task: string
  is_completed: boolean
  completed_date: string | null
  priority: TaskPriority
  notes: string | null
  sort_order: number
  created_at: string
}

// Helper type for vendor specialty display names
export const VENDOR_SPECIALTY_LABELS: Record<VendorSpecialty, string> = {
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  roofing: 'Roofing',
  general_contractor: 'General Contractor',
  landscaping: 'Landscaping',
  cleaning: 'Cleaning',
  pest_control: 'Pest Control',
  pool_spa: 'Pool & Spa',
  appliance: 'Appliance',
  locksmith: 'Locksmith',
  alarm_security: 'Alarm & Security',
  snow_removal: 'Snow Removal',
  fuel_oil: 'Fuel Oil',
  property_management: 'Property Management',
  architect: 'Architect',
  movers: 'Movers',
  trash: 'Trash',
  internet: 'Internet',
  phone: 'Phone',
  water: 'Water',
  septic: 'Septic',
  forester: 'Forester',
  fireplace: 'Fireplace',
  insurance: 'Insurance',
  auto: 'Auto Service',
  elevator: 'Elevator',
  flooring: 'Flooring',
  parking: 'Parking',
  masonry: 'Masonry',
  other: 'Other',
}

// Get vendor specialties sorted alphabetically by label, with "Other" at the end
export function getVendorSpecialtyOptions(): Array<{ value: VendorSpecialty; label: string }> {
  return Object.entries(VENDOR_SPECIALTY_LABELS)
    .map(([value, label]) => ({ value: value as VendorSpecialty, label }))
    .sort((a, b) => {
      // "Other" always goes last
      if (a.value === 'other') return 1
      if (b.value === 'other') return -1
      return a.label.localeCompare(b.label)
    })
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: 'House',
  condo: 'Condo',
  land: 'Land',
  other: 'Other',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  confirmed: 'Confirmed',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  property_tax: 'Property Tax',
  insurance: 'Insurance',
  utility: 'Utility',
  maintenance: 'Maintenance',
  mortgage: 'Mortgage',
  hoa: 'HOA',
  other: 'Other',
}

// Unified Payment type for consolidated payment view
export type PaymentSource = 'bill' | 'property_tax' | 'insurance_premium'

export interface UnifiedPayment {
  id: string
  source: PaymentSource
  source_id: string  // Original record ID
  category: BillType
  description: string
  property_id: string | null
  property_name: string | null
  vehicle_id: string | null
  vehicle_name: string | null
  vendor_id: string | null
  vendor_name: string | null
  amount: number
  due_date: string
  status: PaymentStatus
  payment_method: PaymentMethod | null
  payment_date: string | null
  confirmation_date: string | null
  days_waiting: number | null  // Computed: days since payment_date if unconfirmed
  is_overdue: boolean  // Computed: due_date < today && status = pending
  recurrence: Recurrence
}

// Bank transaction types for CSV import
export interface BankTransaction {
  id: string
  import_batch_id: string
  transaction_date: string
  description: string
  amount: number
  check_number: string | null
  matched_bill_id: string | null
  matched_at: string | null
  match_confidence: number | null
  match_method: string | null
  is_confirmed: boolean
  created_at: string
}

export interface BankImportBatch {
  id: string
  filename: string
  account_type: string | null
  date_range_start: string | null
  date_range_end: string | null
  transaction_count: number
  matched_count: number
  imported_by: string | null
  imported_at: string
}

// Recurring template types
export interface RecurringTemplate {
  id: string
  property_id: string | null
  vehicle_id: string | null
  vendor_id: string | null
  template_name: string
  bill_type: BillType
  amount: number
  currency: string
  recurrence: Recurrence
  day_of_month: number | null
  month_of_year: number | null
  payment_method: PaymentMethod | null
  days_to_confirm: number
  auto_pay: boolean
  is_active: boolean
  last_generated_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  vehicle?: Vehicle
  vendor?: Vendor
}

// Payment audit log
export interface PaymentAuditLog {
  id: string
  bill_id: string
  action: 'created' | 'marked_paid' | 'confirmed' | 'deleted'
  old_status: PaymentStatus | null
  new_status: PaymentStatus | null
  performed_by: string | null
  performed_at: string
  notes: string | null
}
