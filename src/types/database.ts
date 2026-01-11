// Database types for Property Management System

import type { VendorCommunication } from './gmail'

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
  | 'auto' | 'elevator' | 'flooring' | 'parking' | 'masonry' | 'audiovisual'
  | 'shoveling' | 'plowing' | 'mowing' | 'attorney' | 'window_washing' | 'other'
export type Season = 'winter' | 'spring' | 'summer' | 'fall' | 'annual'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type PinnedEntityType = 'vendor' | 'bill' | 'insurance_policy' | 'ticket' | 'buildinglink_message' | 'property_tax' | 'insurance_premium' | 'document' | 'weather_alert'

// Weather alert types
export type WeatherProvider = 'nws' | 'meteo_france'
export type WeatherSeverity = 'minor' | 'moderate' | 'severe' | 'extreme'
export type PaymentSuggestionStatus = 'pending_review' | 'imported' | 'dismissed'
export type PaymentSuggestionConfidence = 'high' | 'medium' | 'low'

// Property access types
export type AccessType =
  | 'garage_code' | 'alarm_code' | 'house_key' | 'gate_code' | 'front_door_code'
  | 'lockbox' | 'wifi_password' | 'building_fob' | 'mailbox_key'
  | 'storage_key' | 'safe_combination' | 'other'

// Property renewal types
export type RenewalType =
  | 'elevator_cert' | 'fire_alarm' | 'fire_suppression' | 'generator_service'
  | 'septic' | 'chimney' | 'boiler_cert' | 'backflow_test' | 'pest_control'
  | 'hvac_service' | 'pool_inspection' | 'uva_renewal' | 'rental_license'
  | 'building_permit' | 'other'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  created_at: string
  updated_at: string
}

// Property visibility restrictions (whitelist model)
// If a property has rows in property_visibility, only those users can see it
// If no rows exist for a property, all owners can see it (default)
export interface PropertyVisibility {
  id: string
  property_id: string
  user_id: string
  created_at: string
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
  tax_lookup_url: string | null  // URL to official tax lookup portal
  has_mortgage: boolean
  mortgage_lender: string | null
  mortgage_account: string | null
  mortgage_payment: number | null
  mortgage_due_day: number | null
  hoa_monthly_amount: number | null  // Monthly HOA/condo fee
  hoa_management_company: string | null  // HOA/condo management company name
  ownership_entity: string | null  // Legal entity that owns property (e.g., SCI for Paris)
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
  property_id: string | null  // Home property for visibility inheritance
  agreed_value: number | null  // Insurance agreed value
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
}

export interface Vendor {
  id: string
  name: string
  company: string | null
  specialties: VendorSpecialty[]
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
  // Joined fields
  contacts?: VendorContact[]
  primary_contact?: VendorContact | null
}

export interface VendorContact {
  id: string
  vendor_id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
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

// Coverage details structure for insurance policies
export interface CoverageDetails {
  dwelling?: number
  other_structures?: number
  contents?: number
  personal_liability?: number
  medical_payments?: number
  loss_of_use?: number
  collision?: number
  comprehensive?: number
  bodily_injury?: number
  property_damage?: number
  uninsured_motorist?: number
  [key: string]: number | undefined  // Allow additional coverage types
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
  coverage_details: CoverageDetails | null  // Detailed coverage breakdown
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
  vendor_contact_id: string | null  // Specific contact at vendor for this ticket
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  completed_date: string | null
  recurrence: Recurrence
  status: TaskStatus
  estimated_cost: number | null
  actual_cost: number | null
  resolution: string | null  // How the issue was resolved (required when closing)
  resolved_at: string | null  // When ticket was closed
  resolved_by: string | null  // User ID who closed the ticket
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  vehicle?: Vehicle
  equipment?: Equipment
  vendor?: Vendor
  vendor_contact?: VendorContact
}

// Ticket activity types for audit trail
export type TicketActivityAction = 'created' | 'status_changed' | 'assigned' | 'updated' | 'closed'

export interface TicketActivity {
  id: string
  ticket_id: string
  user_id: string | null
  user_name: string
  action: TicketActivityAction
  details: {
    from?: string
    to?: string
    field?: string
    value?: string
    resolution?: string
    vendor?: string
    contact?: string
  } | null
  created_at: string
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

// Weather zone configuration
export interface WeatherZone {
  id: string
  property_id: string
  provider: WeatherProvider
  zone_code: string
  zone_name: string | null
  is_active: boolean
  created_at: string
  // Joined fields
  property?: Property
}

// Weather alert from NWS or Météo-France
export interface WeatherAlert {
  id: string
  external_id: string
  provider: WeatherProvider
  zone_code: string
  event_type: string
  severity: WeatherSeverity
  urgency: string | null
  headline: string
  description: string | null
  instruction: string | null
  effective_at: string
  expires_at: string
  notified_at: string | null
  status_change_notified_at: string | null
  created_at: string
}

// Link between property and weather alert
export interface PropertyWeatherAlert {
  id: string
  property_id: string
  weather_alert_id: string
  created_at: string
  // Joined fields
  property?: Property
  weather_alert?: WeatherAlert
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
  audiovisual: 'Audiovisual',
  shoveling: 'Shoveling',
  plowing: 'Plowing',
  mowing: 'Mowing',
  attorney: 'Attorney',
  window_washing: 'Window Washing',
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

// Ticket status labels (user-friendly names for task statuses in ticket context)
export const TICKET_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Open',
  in_progress: 'In Progress',
  completed: 'Closed',
  cancelled: 'Closed',
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

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  homeowners: 'Homeowners',
  auto: 'Auto',
  umbrella: 'Umbrella',
  flood: 'Flood',
  earthquake: 'Earthquake',
  liability: 'Liability',
  health: 'Health',
  travel: 'Travel',
  other: 'Other',
}

// Short labels for mobile/compact views
export const INSURANCE_TYPE_SHORT_LABELS: Record<InsuranceType, string> = {
  homeowners: 'Home',
  auto: 'Auto',
  umbrella: 'Umbrella',
  flood: 'Flood',
  earthquake: 'Quake',
  liability: 'Liab.',
  health: 'Health',
  travel: 'Travel',
  other: 'Other',
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  one_time: 'One-Time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
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

// Pinned items (shared across all users)
export interface PinnedItem {
  id: string
  entity_type: PinnedEntityType
  entity_id: string
  metadata: Record<string, any> | null
  pinned_at: string
  pinned_by: string | null
  pinned_by_name: string | null
  is_system_pin: boolean  // True for smart pins (system-generated), false for user pins
  dismissed_at: string | null  // When user dismissed this smart pin (NULL = active)
}

export interface PinNote {
  id: string
  entity_type: PinnedEntityType
  entity_id: string
  user_id: string
  user_name: string
  note: string
  due_date: string | null
  created_at: string
  updated_at: string
}

// Dashboard redesign types
export type DashboardPinStatus = 'overdue' | 'urgent' | 'upcoming' | 'normal'

export interface DashboardPinnedItem {
  id: string
  entityType: PinnedEntityType
  entityId: string
  pinType: 'smart' | 'user'
  title: string
  subtitle: string | null
  amount: number | null
  dueDate: string | null
  daysUntilOrOverdue: number | null
  status: DashboardPinStatus
  href: string
  icon: 'bill' | 'tax' | 'insurance' | 'ticket' | 'vendor' | 'document' | 'building' | 'buildinglink'
  notes: PinNote[]
  metadata: Record<string, any> | null
}

export interface UpcomingItem {
  id: string
  type: 'bill' | 'tax' | 'insurance' | 'registration' | 'inspection' | 'task'
  title: string
  subtitle: string | null
  amount: number | null
  dueDate: string
  daysUntil: number
  href: string
  icon: 'bill' | 'tax' | 'insurance' | 'car' | 'ticket'
}

export interface DashboardStats {
  properties: number
  vehicles: number
  due30Days: number  // Total amount due in 30 days
}

// Payment email link types
export type PaymentEmailLinkType = 'invoice' | 'confirmation' | 'reminder'
export type PaymentSourceType = 'bill' | 'property_tax' | 'insurance_premium'

// Link between payments and emails
export interface PaymentEmailLink {
  id: string
  payment_type: PaymentSourceType
  payment_id: string
  email_id: string
  link_type: PaymentEmailLinkType
  confidence: number
  auto_matched: boolean
  created_at: string
  created_by: string | null
  // Joined fields
  email?: VendorCommunication
}

// Payment suggestion from email analysis
export interface PaymentSuggestion {
  id: string
  email_id: string | null
  gmail_message_id: string | null
  vendor_id: string | null
  vendor_name_extracted: string | null
  amount_extracted: number | null
  due_date_extracted: string | null
  property_id: string | null
  confidence: PaymentSuggestionConfidence
  signals: string[]
  email_subject: string | null
  email_snippet: string | null
  email_received_at: string | null
  status: PaymentSuggestionStatus
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  imported_bill_id: string | null
  // Joined fields
  vendor?: Vendor
  property?: Property
}

// Property access codes and keys
export interface PropertyAccess {
  id: string
  property_id: string
  access_type: AccessType
  description: string
  code_value: string | null
  holder_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Trusted neighbors for property emergencies
export interface TrustedNeighbor {
  id: string
  property_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  relationship: string | null
  has_keys: boolean
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Property renewals (annual inspections, certifications)
export interface PropertyRenewal {
  id: string
  property_id: string
  name: string
  renewal_type: RenewalType
  recurrence: Recurrence
  due_date: string
  last_renewed: string | null
  vendor_id: string | null
  cost: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  vendor?: Vendor
  property?: Property
}

// Access type labels
export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  garage_code: 'Garage Code',
  alarm_code: 'Alarm Code',
  house_key: 'House Key',
  gate_code: 'Gate Code',
  front_door_code: 'Front Door Code',
  lockbox: 'Lockbox',
  wifi_password: 'WiFi Password',
  building_fob: 'Building Fob',
  mailbox_key: 'Mailbox Key',
  storage_key: 'Storage Key',
  safe_combination: 'Safe Combination',
  other: 'Other',
}

// Renewal type labels
export const RENEWAL_TYPE_LABELS: Record<RenewalType, string> = {
  elevator_cert: 'Elevator Certification',
  fire_alarm: 'Fire Alarm Inspection',
  fire_suppression: 'Fire Suppression',
  generator_service: 'Generator Service',
  septic: 'Septic Inspection',
  chimney: 'Chimney Inspection',
  boiler_cert: 'Boiler Certification',
  backflow_test: 'Backflow Test',
  pest_control: 'Pest Control',
  hvac_service: 'HVAC Service',
  pool_inspection: 'Pool Inspection',
  uva_renewal: 'UVA Renewal',
  rental_license: 'Rental License',
  building_permit: 'Building Permit',
  other: 'Other',
}

// Health monitoring
export type HealthCheckStatus = 'ok' | 'warning' | 'critical'

export interface HealthCheckState {
  check_name: string
  status: HealthCheckStatus
  last_checked_at: string
  last_alerted_at: string | null
  last_recovered_at: string | null
  failure_count: number
  first_failure_at: string | null
  details: Record<string, unknown> | null
}
