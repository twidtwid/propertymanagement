"use server"

import { query, queryOne } from "./db"
import type { RecurringTemplate, Bill, Recurrence } from "@/types/database"
import { addMonths, addDays, startOfMonth, setDate, isWithinInterval } from "date-fns"

interface GenerationResult {
  generated: number
  skipped: number
  errors: string[]
}

interface RecurringTemplateWithDetails extends RecurringTemplate {
  property_name?: string
  vehicle_name?: string
  vendor_name?: string
}

// Get all active recurring templates
export async function getActiveRecurringTemplates(): Promise<RecurringTemplateWithDetails[]> {
  return query<RecurringTemplateWithDetails>(`
    SELECT
      rt.*,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      vn.name as vendor_name
    FROM recurring_templates rt
    LEFT JOIN properties p ON rt.property_id = p.id
    LEFT JOIN vehicles v ON rt.vehicle_id = v.id
    LEFT JOIN vendors vn ON rt.vendor_id = vn.id
    WHERE rt.is_active = TRUE
    ORDER BY rt.template_name
  `)
}

// Get a single recurring template
export async function getRecurringTemplate(id: string): Promise<RecurringTemplateWithDetails | null> {
  return queryOne<RecurringTemplateWithDetails>(`
    SELECT
      rt.*,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      vn.name as vendor_name
    FROM recurring_templates rt
    LEFT JOIN properties p ON rt.property_id = p.id
    LEFT JOIN vehicles v ON rt.vehicle_id = v.id
    LEFT JOIN vendors vn ON rt.vendor_id = vn.id
    WHERE rt.id = $1
  `, [id])
}

// Calculate next due dates for a recurring template
function calculateNextDueDates(
  template: RecurringTemplate,
  fromDate: Date,
  daysAhead: number
): Date[] {
  const dueDates: Date[] = []
  const endDate = addDays(fromDate, daysAhead)

  const dayOfMonth = template.day_of_month || 1
  const monthOfYear = template.month_of_year || 1 // January = 1

  switch (template.recurrence) {
    case 'monthly': {
      // Generate for each month within the range
      let currentMonth = startOfMonth(fromDate)
      while (currentMonth <= endDate) {
        const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
        if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
          dueDates.push(dueDate)
        }
        currentMonth = addMonths(currentMonth, 1)
      }
      break
    }

    case 'quarterly': {
      // Generate for months 1, 4, 7, 10 (or based on monthOfYear as start)
      const quarterStartMonths = [0, 3, 6, 9] // January, April, July, October (0-indexed)
      let currentMonth = startOfMonth(fromDate)
      for (let i = 0; i < 6; i++) { // Check next 6 months
        const monthIndex = currentMonth.getMonth()
        if (quarterStartMonths.includes(monthIndex)) {
          const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
          if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
            dueDates.push(dueDate)
          }
        }
        currentMonth = addMonths(currentMonth, 1)
      }
      break
    }

    case 'semi_annual': {
      // Generate for month and month+6
      const firstMonth = monthOfYear - 1 // Convert to 0-indexed
      const secondMonth = (firstMonth + 6) % 12
      let currentMonth = startOfMonth(fromDate)
      for (let i = 0; i < 12; i++) {
        const monthIndex = currentMonth.getMonth()
        if (monthIndex === firstMonth || monthIndex === secondMonth) {
          const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
          if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
            dueDates.push(dueDate)
          }
        }
        currentMonth = addMonths(currentMonth, 1)
      }
      break
    }

    case 'annual': {
      // Generate once per year in the specified month
      let currentMonth = startOfMonth(fromDate)
      for (let i = 0; i < 24; i++) { // Check next 24 months
        const monthIndex = currentMonth.getMonth()
        if (monthIndex === monthOfYear - 1) { // monthOfYear is 1-indexed
          const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
          if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
            dueDates.push(dueDate)
          }
        }
        currentMonth = addMonths(currentMonth, 1)
      }
      break
    }

    default:
      // one_time doesn't generate recurring bills
      break
  }

  return dueDates
}

// Check if a bill already exists for a template and due date
async function billExistsForTemplate(
  templateId: string,
  dueDate: Date
): Promise<boolean> {
  const result = await queryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM bills
    WHERE notes LIKE $1
      AND due_date = $2
      AND status != 'cancelled'
  `, [`%recurring_template_id:${templateId}%`, dueDate.toISOString().split('T')[0]])

  return (result?.count || 0) > 0
}

// Generate a bill from a recurring template
async function generateBillFromTemplate(
  template: RecurringTemplate,
  dueDate: Date
): Promise<string | null> {
  const description = template.template_name
  const notes = `Auto-generated from recurring template.\nrecurring_template_id:${template.id}`

  const result = await queryOne<{ id: string }>(`
    INSERT INTO bills (
      property_id,
      vehicle_id,
      vendor_id,
      bill_type,
      description,
      amount,
      currency,
      due_date,
      recurrence,
      status,
      payment_method,
      days_to_confirm,
      notes
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    RETURNING id
  `, [
    template.property_id,
    template.vehicle_id,
    template.vendor_id,
    template.bill_type,
    description,
    template.amount,
    template.currency,
    dueDate.toISOString().split('T')[0],
    template.recurrence,
    template.auto_pay ? 'sent' : 'pending',
    template.payment_method,
    template.days_to_confirm,
    notes
  ])

  return result?.id || null
}

// Update the last_generated_date for a template
async function updateTemplateLastGenerated(
  templateId: string,
  date: Date
): Promise<void> {
  await query(`
    UPDATE recurring_templates
    SET last_generated_date = $1, updated_at = NOW()
    WHERE id = $2
  `, [date.toISOString().split('T')[0], templateId])
}

// Main function: Generate upcoming bills from all active templates
export async function generateUpcomingBills(
  daysAhead: number = 30
): Promise<GenerationResult> {
  const result: GenerationResult = {
    generated: 0,
    skipped: 0,
    errors: []
  }

  const templates = await getActiveRecurringTemplates()
  const today = new Date()

  for (const template of templates) {
    try {
      const dueDates = calculateNextDueDates(template, today, daysAhead)

      for (const dueDate of dueDates) {
        // Skip if bill already exists
        const exists = await billExistsForTemplate(template.id, dueDate)
        if (exists) {
          result.skipped++
          continue
        }

        // Generate the bill
        const billId = await generateBillFromTemplate(template, dueDate)
        if (billId) {
          result.generated++
          await updateTemplateLastGenerated(template.id, dueDate)
        } else {
          result.errors.push(`Failed to generate bill for template ${template.template_name}`)
        }
      }
    } catch (error) {
      result.errors.push(`Error processing template ${template.template_name}: ${error}`)
    }
  }

  return result
}

// Generate insurance premium bills from insurance policies
export async function generateInsurancePremiumBills(
  daysAhead: number = 60
): Promise<GenerationResult> {
  const result: GenerationResult = {
    generated: 0,
    skipped: 0,
    errors: []
  }

  const today = new Date()
  const endDate = addDays(today, daysAhead)

  // Find policies expiring within the range that don't have pending renewal bills
  const policies = await query<{
    id: string
    property_id: string | null
    vehicle_id: string | null
    carrier_name: string
    policy_type: string
    premium_amount: number
    expiration_date: string
  }>(`
    SELECT
      ip.id,
      ip.property_id,
      ip.vehicle_id,
      ip.carrier_name,
      ip.policy_type,
      ip.premium_amount,
      ip.expiration_date
    FROM insurance_policies ip
    WHERE ip.expiration_date BETWEEN $1 AND $2
      AND ip.auto_renew = TRUE
      AND ip.premium_amount IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM bills b
        WHERE b.notes LIKE '%insurance_policy_id:' || ip.id::text || '%'
          AND b.status != 'cancelled'
          AND b.due_date >= $1
      )
  `, [today.toISOString().split('T')[0], endDate.toISOString().split('T')[0]])

  for (const policy of policies) {
    try {
      // Due date is 30 days before expiration
      const expirationDate = new Date(policy.expiration_date)
      const dueDate = addDays(expirationDate, -30)

      if (dueDate < today) {
        continue // Skip if due date is in the past
      }

      const description = `${policy.carrier_name} - ${policy.policy_type} renewal`
      const notes = `Insurance premium renewal.\ninsurance_policy_id:${policy.id}`

      const billResult = await queryOne<{ id: string }>(`
        INSERT INTO bills (
          property_id,
          vehicle_id,
          bill_type,
          description,
          amount,
          due_date,
          recurrence,
          status,
          notes
        ) VALUES (
          $1, $2, 'insurance', $3, $4, $5, 'annual', 'pending', $6
        )
        RETURNING id
      `, [
        policy.property_id,
        policy.vehicle_id,
        description,
        policy.premium_amount,
        dueDate.toISOString().split('T')[0],
        notes
      ])

      if (billResult?.id) {
        result.generated++
      }
    } catch (error) {
      result.errors.push(`Error generating insurance bill for policy ${policy.id}: ${error}`)
    }
  }

  return result
}

// Generate mortgage payment bills from properties with mortgages
export async function generateMortgageBills(
  daysAhead: number = 45
): Promise<GenerationResult> {
  const result: GenerationResult = {
    generated: 0,
    skipped: 0,
    errors: []
  }

  const today = new Date()
  const endDate = addDays(today, daysAhead)

  // Find properties with mortgages
  const mortgageProperties = await query<{
    id: string
    name: string
    mortgage_lender: string | null
    mortgage_payment: number
    mortgage_due_day: number
  }>(`
    SELECT
      id,
      name,
      mortgage_lender,
      mortgage_payment,
      mortgage_due_day
    FROM properties
    WHERE has_mortgage = TRUE
      AND mortgage_payment IS NOT NULL
      AND mortgage_due_day IS NOT NULL
  `)

  for (const property of mortgageProperties) {
    try {
      // Calculate the next due date based on mortgage_due_day
      let dueDate = setDate(startOfMonth(today), property.mortgage_due_day)
      if (dueDate < today) {
        dueDate = setDate(addMonths(startOfMonth(today), 1), property.mortgage_due_day)
      }

      // Skip if due date is beyond our range
      if (dueDate > endDate) {
        continue
      }

      // Check if bill already exists
      const existingBill = await queryOne<{ id: string }>(`
        SELECT id FROM bills
        WHERE property_id = $1
          AND bill_type = 'mortgage'
          AND due_date = $2
          AND status != 'cancelled'
      `, [property.id, dueDate.toISOString().split('T')[0]])

      if (existingBill) {
        result.skipped++
        continue
      }

      const description = property.mortgage_lender
        ? `${property.mortgage_lender} mortgage - ${property.name}`
        : `Mortgage payment - ${property.name}`

      const billResult = await queryOne<{ id: string }>(`
        INSERT INTO bills (
          property_id,
          bill_type,
          description,
          amount,
          due_date,
          recurrence,
          status,
          notes
        ) VALUES (
          $1, 'mortgage', $2, $3, $4, 'monthly', 'pending', 'Auto-generated mortgage payment'
        )
        RETURNING id
      `, [
        property.id,
        description,
        property.mortgage_payment,
        dueDate.toISOString().split('T')[0]
      ])

      if (billResult?.id) {
        result.generated++
      }
    } catch (error) {
      result.errors.push(`Error generating mortgage bill for ${property.name}: ${error}`)
    }
  }

  return result
}

// Run all bill generation tasks
export async function runAllBillGeneration(): Promise<{
  recurring: GenerationResult
  insurance: GenerationResult
  mortgage: GenerationResult
}> {
  const [recurring, insurance, mortgage] = await Promise.all([
    generateUpcomingBills(30),
    generateInsurancePremiumBills(60),
    generateMortgageBills(45)
  ])

  return { recurring, insurance, mortgage }
}
