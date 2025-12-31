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
  | 'phone' | 'water' | 'septic' | 'forester' | 'other'
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
  other: 'Other',
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
