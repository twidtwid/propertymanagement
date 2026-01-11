"use server"

import { query } from "../db"

// ============================================================================
// Type Definitions
// ============================================================================

export type CalendarEventType =
  | 'bill'
  | 'property_tax'
  | 'insurance_renewal'
  | 'insurance_expiration'
  | 'vehicle_registration'
  | 'vehicle_inspection'
  | 'maintenance'
  | 'pin_note'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  description: string | null
  date: string
  amount: number | null
  status: string | null
  propertyName: string | null
  vehicleName: string | null
  vendorName: string | null
  isOverdue: boolean
  isUrgent: boolean
  href: string | null
}

// ============================================================================
// Public Query Functions
// ============================================================================

export async function getCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []

  // Bills
  const bills = await query<{
    id: string
    description: string | null
    bill_type: string
    amount: number
    due_date: string
    status: string
    property_name: string | null
    vehicle_name: string | null
    vendor_name: string | null
  }>(`
    SELECT
      b.id,
      b.description,
      b.bill_type,
      b.amount,
      b.due_date::text,
      b.status,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      vn.name as vendor_name
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN vendors vn ON b.vendor_id = vn.id
    WHERE b.due_date BETWEEN $1 AND $2
    ORDER BY b.due_date
  `, [startDate, endDate])

  for (const bill of bills) {
    const isOverdue = bill.status === 'pending' && new Date(bill.due_date) < new Date()
    events.push({
      id: `bill-${bill.id}`,
      type: 'bill',
      title: bill.description || bill.bill_type,
      description: bill.vendor_name,
      date: bill.due_date,
      amount: bill.amount,
      status: bill.status,
      propertyName: bill.property_name,
      vehicleName: bill.vehicle_name,
      vendorName: bill.vendor_name,
      isOverdue,
      isUrgent: isOverdue,
      href: `/payments`,
    })
  }

  // Property Taxes
  const taxes = await query<{
    id: string
    jurisdiction: string
    tax_year: number
    installment: number
    amount: number
    due_date: string
    status: string
    property_name: string
  }>(`
    SELECT
      pt.id,
      pt.jurisdiction,
      pt.tax_year,
      pt.installment,
      pt.amount,
      pt.due_date::text,
      pt.status,
      p.name as property_name
    FROM property_taxes pt
    JOIN properties p ON pt.property_id = p.id
    WHERE pt.due_date BETWEEN $1 AND $2
    ORDER BY pt.due_date
  `, [startDate, endDate])

  for (const tax of taxes) {
    const isOverdue = tax.status === 'pending' && new Date(tax.due_date) < new Date()
    events.push({
      id: `tax-${tax.id}`,
      type: 'property_tax',
      title: `${tax.jurisdiction} Q${tax.installment} Tax`,
      description: tax.property_name,
      date: tax.due_date,
      amount: tax.amount,
      status: tax.status,
      propertyName: tax.property_name,
      vehicleName: null,
      vendorName: null,
      isOverdue,
      isUrgent: isOverdue,
      href: `/payments/taxes/${tax.id}`,
    })
  }

  // Insurance Expirations
  const policies = await query<{
    id: string
    carrier_name: string
    policy_type: string
    expiration_date: string
    premium_amount: number | null
    property_name: string | null
    vehicle_name: string | null
  }>(`
    SELECT
      ip.id,
      ip.carrier_name,
      ip.policy_type,
      ip.expiration_date::text,
      ip.premium_amount,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
    FROM insurance_policies ip
    LEFT JOIN properties p ON ip.property_id = p.id
    LEFT JOIN vehicles v ON ip.vehicle_id = v.id
    WHERE ip.expiration_date BETWEEN $1 AND $2
    ORDER BY ip.expiration_date
  `, [startDate, endDate])

  for (const policy of policies) {
    const daysUntil = Math.ceil((new Date(policy.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    events.push({
      id: `insurance-exp-${policy.id}`,
      type: 'insurance_expiration',
      title: `${policy.carrier_name} ${policy.policy_type} Expires`,
      description: policy.property_name || policy.vehicle_name,
      date: policy.expiration_date,
      amount: policy.premium_amount,
      status: daysUntil < 0 ? 'expired' : 'active',
      propertyName: policy.property_name,
      vehicleName: policy.vehicle_name,
      vendorName: null,
      isOverdue: daysUntil < 0,
      isUrgent: daysUntil <= 30,
      href: `/insurance/${policy.id}`,
    })
  }

  // Vehicle Registrations
  const registrations = await query<{
    id: string
    year: number
    make: string
    model: string
    registration_expires: string | null
  }>(`
    SELECT id, year, make, model, registration_expires::text
    FROM vehicles
    WHERE registration_expires BETWEEN $1 AND $2
      AND is_active = TRUE
    ORDER BY registration_expires
  `, [startDate, endDate])

  for (const vehicle of registrations) {
    if (vehicle.registration_expires) {
      const daysUntil = Math.ceil((new Date(vehicle.registration_expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      events.push({
        id: `reg-${vehicle.id}`,
        type: 'vehicle_registration',
        title: `Registration Expires`,
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        date: vehicle.registration_expires,
        amount: null,
        status: daysUntil < 0 ? 'expired' : 'active',
        propertyName: null,
        vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        vendorName: null,
        isOverdue: daysUntil < 0,
        isUrgent: daysUntil <= 30,
        href: `/vehicles/${vehicle.id}`,
      })
    }
  }

  // Vehicle Inspections
  const inspections = await query<{
    id: string
    year: number
    make: string
    model: string
    inspection_expires: string | null
  }>(`
    SELECT id, year, make, model, inspection_expires::text
    FROM vehicles
    WHERE inspection_expires BETWEEN $1 AND $2
      AND is_active = TRUE
    ORDER BY inspection_expires
  `, [startDate, endDate])

  for (const vehicle of inspections) {
    if (vehicle.inspection_expires) {
      const daysUntil = Math.ceil((new Date(vehicle.inspection_expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      events.push({
        id: `insp-${vehicle.id}`,
        type: 'vehicle_inspection',
        title: `Inspection Due`,
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        date: vehicle.inspection_expires,
        amount: null,
        status: daysUntil < 0 ? 'overdue' : 'active',
        propertyName: null,
        vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        vendorName: null,
        isOverdue: daysUntil < 0,
        isUrgent: daysUntil <= 14,
        href: `/vehicles/${vehicle.id}`,
      })
    }
  }

  // Maintenance Tasks with due dates
  const tasks = await query<{
    id: string
    title: string
    due_date: string
    priority: string
    status: string
    property_name: string | null
    vehicle_name: string | null
    vendor_name: string | null
    estimated_cost: number | null
  }>(`
    SELECT
      mt.id,
      mt.title,
      mt.due_date::text,
      mt.priority,
      mt.status,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      vn.name as vendor_name,
      mt.estimated_cost
    FROM maintenance_tasks mt
    LEFT JOIN properties p ON mt.property_id = p.id
    LEFT JOIN vehicles v ON mt.vehicle_id = v.id
    LEFT JOIN vendors vn ON mt.vendor_id = vn.id
    WHERE mt.due_date BETWEEN $1 AND $2
      AND mt.status IN ('pending', 'in_progress')
    ORDER BY mt.due_date
  `, [startDate, endDate])

  for (const task of tasks) {
    const isOverdue = new Date(task.due_date) < new Date()
    events.push({
      id: `task-${task.id}`,
      type: 'maintenance',
      title: task.title,
      description: task.property_name || task.vehicle_name,
      date: task.due_date,
      amount: task.estimated_cost,
      status: task.status,
      propertyName: task.property_name,
      vehicleName: task.vehicle_name,
      vendorName: task.vendor_name,
      isOverdue,
      isUrgent: isOverdue || task.priority === 'urgent' || task.priority === 'high',
      href: `/tickets/${task.id}`,
    })
  }

  // Pin Notes with due dates - fetch actual entity data for better context
  const pinNotes = await query<{
    id: string
    entity_type: string
    entity_id: string
    note: string
    user_name: string
    due_date: string
    // Actual entity data (one will be populated based on entity_type)
    bill_description: string | null
    bill_type: string | null
    vendor_name: string | null
    property_name: string | null
    ticket_title: string | null
    tax_jurisdiction: string | null
    insurance_carrier: string | null
    pin_metadata: any | null
  }>(`
    SELECT
      pn.id,
      pn.entity_type,
      pn.entity_id,
      pn.note,
      pn.user_name,
      pn.due_date::text,
      -- Bill data
      COALESCE(b.description, b.bill_type::text) as bill_description,
      b.bill_type,
      -- Vendor data
      v.company as vendor_name,
      -- Property data (from bill or tax)
      COALESCE(bp.name, pt_prop.name) as property_name,
      -- Ticket data
      mt.title as ticket_title,
      -- Property tax data
      pt.jurisdiction as tax_jurisdiction,
      -- Insurance data (via insurance_policies or direct carrier)
      ip.carrier_name as insurance_carrier,
      -- Get metadata from pinned_items for documents and other entities
      pi.metadata as pin_metadata
    FROM pin_notes pn
    LEFT JOIN bills b ON pn.entity_type = 'bill' AND pn.entity_id = b.id
    LEFT JOIN properties bp ON b.property_id = bp.id
    LEFT JOIN vendors v ON pn.entity_type = 'vendor' AND pn.entity_id = v.id
    LEFT JOIN maintenance_tasks mt ON pn.entity_type = 'ticket' AND pn.entity_id = mt.id
    LEFT JOIN property_taxes pt ON pn.entity_type = 'property_tax' AND pn.entity_id = pt.id
    LEFT JOIN properties pt_prop ON pt.property_id = pt_prop.id
    LEFT JOIN insurance_policies ip ON pn.entity_type = 'insurance_premium' AND pn.entity_id = ip.id
    LEFT JOIN pinned_items pi ON pn.entity_type = pi.entity_type AND pn.entity_id = pi.entity_id
    WHERE pn.due_date BETWEEN $1 AND $2
    ORDER BY pn.due_date
  `, [startDate, endDate])

  for (const note of pinNotes) {
    const isOverdue = new Date(note.due_date) < new Date()

    // Extract title from actual entity data
    let title = 'Pinned Item'
    let href = null

    switch (note.entity_type) {
      case 'vendor':
        title = note.vendor_name || 'Vendor'
        href = `/vendors/${note.entity_id}`
        break
      case 'bill':
        title = note.bill_description || 'Bill'
        href = '/payments'
        break
      case 'ticket':
        title = note.ticket_title || 'Ticket'
        href = `/tickets/${note.entity_id}`
        break
      case 'insurance_policy':
        title = note.insurance_carrier ? `${note.insurance_carrier} Policy` : 'Insurance Policy'
        href = `/insurance/${note.entity_id}`
        break
      case 'property_tax':
        title = note.tax_jurisdiction ? `${note.property_name || ''} ${note.tax_jurisdiction} Tax`.trim() : 'Property Tax'
        href = '/payments/taxes'
        break
      case 'insurance_premium':
        title = note.insurance_carrier ? `${note.insurance_carrier} Premium` : 'Insurance Premium'
        href = `/insurance/${note.entity_id}`
        break
      case 'buildinglink_message':
        title = 'BuildingLink Message'
        href = '/buildinglink'
        break
      case 'document':
        // Documents use pinned_items metadata
        title = note.pin_metadata?.title || 'Document'
        href = '/documents'
        break
    }

    events.push({
      id: `note-${note.id}`,
      type: 'pin_note',
      title: title,
      description: note.note || '',  // Full note text
      date: note.due_date,
      amount: null,
      status: null,
      propertyName: note.property_name,
      vehicleName: null,
      vendorName: note.user_name,  // Who created the note
      isOverdue,
      isUrgent: isOverdue,
      href,
    })
  }

  // Sort all events by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return events
}
