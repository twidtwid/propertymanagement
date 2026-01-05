"use server"

import Anthropic from "@anthropic-ai/sdk"
import { query, queryOne } from "./db"
import type { Vendor, Property } from "@/types/database"
import type { VendorCommunication } from "./actions"

interface PropertyMatch {
  propertyId: string
  propertyName: string
  confidence: "high" | "medium" | "low"
  reason: string
}

interface VendorPropertyAnalysis {
  vendorId: string
  vendorName: string
  emailCount: number
  suggestedProperties: PropertyMatch[]
  rawAnalysis: string
}

// Get vendors with their email communications
async function getVendorsWithEmails(): Promise<Array<Vendor & { emails: VendorCommunication[] }>> {
  const vendors = await query<Vendor>("SELECT * FROM vendors WHERE is_active = TRUE ORDER BY name")

  const vendorsWithEmails = await Promise.all(
    vendors.map(async (vendor) => {
      const emails = await query<VendorCommunication>(
        `SELECT * FROM vendor_communications
         WHERE vendor_id = $1
         ORDER BY received_at DESC
         LIMIT 20`,
        [vendor.id]
      )
      return { ...vendor, emails }
    })
  )

  // Only return vendors that have emails
  return vendorsWithEmails.filter((v) => v.emails.length > 0)
}

// Get all properties for matching
async function getPropertiesForMatching(): Promise<Property[]> {
  return query<Property>(
    "SELECT * FROM properties WHERE status = 'active' ORDER BY name"
  )
}

// Check existing property-vendor associations
async function getExistingAssociations(vendorId: string): Promise<string[]> {
  const associations = await query<{ property_id: string }>(
    "SELECT property_id FROM property_vendors WHERE vendor_id = $1",
    [vendorId]
  )
  return associations.map((a) => a.property_id)
}

// Use Claude to analyze emails and suggest property matches
async function analyzeVendorEmails(
  vendor: Vendor & { emails: VendorCommunication[] },
  properties: Property[]
): Promise<VendorPropertyAnalysis> {
  const client = new Anthropic()

  // Build property context
  const propertyInfo = properties
    .map(
      (p) =>
        `- ${p.name} (ID: ${p.id}): ${p.address}, ${p.city}, ${p.state || p.country}`
    )
    .join("\n")

  // Build email context - include snippets and subjects
  const emailContext = vendor.emails
    .map(
      (e) =>
        `Subject: ${e.subject || "(no subject)"}\nFrom: ${e.from_email}\nTo: ${e.to_email}\nSnippet: ${e.body_snippet || "(no body)"}`
    )
    .join("\n---\n")

  const prompt = `Analyze the following email communications for vendor "${vendor.name}" (${vendor.company || "no company"}, specialties: ${vendor.specialties.join(", ")}) and determine which properties they likely service.

PROPERTIES:
${propertyInfo}

VENDOR EMAILS:
${emailContext}

Based on the email content, locations mentioned, addresses, and context clues, identify which properties this vendor likely services.

Respond in JSON format:
{
  "matches": [
    {
      "propertyId": "uuid-here",
      "propertyName": "Property Name",
      "confidence": "high|medium|low",
      "reason": "Brief explanation of why this match was made"
    }
  ],
  "analysis": "Brief overall analysis of what you found"
}

Only include properties you're reasonably confident about. If no clear matches are found, return an empty matches array.`

  try {
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== "text") {
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        emailCount: vendor.emails.length,
        suggestedProperties: [],
        rawAnalysis: "No text response from AI",
      }
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        emailCount: vendor.emails.length,
        suggestedProperties: [],
        rawAnalysis: content.text,
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      emailCount: vendor.emails.length,
      suggestedProperties: parsed.matches || [],
      rawAnalysis: parsed.analysis || "",
    }
  } catch (error) {
    console.error(`Error analyzing vendor ${vendor.name}:`, error)
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      emailCount: vendor.emails.length,
      suggestedProperties: [],
      rawAnalysis: `Error: ${error}`,
    }
  }
}

// Create property-vendor association
async function createPropertyVendorLink(
  propertyId: string,
  vendorId: string,
  notes: string
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO property_vendors (property_id, vendor_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (property_id, vendor_id, specialty_override)
       DO UPDATE SET notes = EXCLUDED.notes`,
      [propertyId, vendorId, notes]
    )
    return true
  } catch (error) {
    console.error(`Error linking property ${propertyId} to vendor ${vendorId}:`, error)
    return false
  }
}

// Main function: analyze all vendors and create associations
export async function analyzeAndLinkVendorProperties(
  autoLink: boolean = false
): Promise<{
  analyzed: number
  newLinks: number
  analyses: VendorPropertyAnalysis[]
}> {
  const vendors = await getVendorsWithEmails()
  const properties = await getPropertiesForMatching()

  const results: VendorPropertyAnalysis[] = []
  let newLinksCreated = 0

  for (const vendor of vendors) {
    const existingAssociations = await getExistingAssociations(vendor.id)
    const analysis = await analyzeVendorEmails(vendor, properties)
    results.push(analysis)

    if (autoLink) {
      for (const match of analysis.suggestedProperties) {
        // Only create link if it doesn't already exist and confidence is high
        if (
          match.confidence === "high" &&
          !existingAssociations.includes(match.propertyId)
        ) {
          const success = await createPropertyVendorLink(
            match.propertyId,
            vendor.id,
            `Auto-linked based on email analysis: ${match.reason}`
          )
          if (success) {
            newLinksCreated++
          }
        }
      }
    }
  }

  return {
    analyzed: vendors.length,
    newLinks: newLinksCreated,
    analyses: results,
  }
}

// Get vendors that haven't been linked to any property yet
export async function getUnlinkedVendors(): Promise<Vendor[]> {
  return query<Vendor>(`
    SELECT v.*
    FROM vendors v
    LEFT JOIN property_vendors pv ON v.id = pv.vendor_id
    WHERE v.is_active = TRUE AND pv.id IS NULL
    ORDER BY v.name
  `)
}
