/**
 * Extract auto insurance coverage details from policy PDFs using Claude
 * Outputs JSON that can be used to update insurance_policies table
 */

import Anthropic from "@anthropic-ai/sdk"
import * as fs from "fs"
import * as path from "path"

const anthropic = new Anthropic()

// Path to Dropbox - can be mounted or direct local path
const DROPBOX_PATH = process.env.DROPBOX_PATH || "/Users/toddhome/AnneSpalterStudios Dropbox/Property Management"

interface VehicleCoverage {
  vin: string
  year: number
  make: string
  model: string
  coverages: {
    bodily_injury_per_person?: number
    bodily_injury_per_accident?: number
    property_damage?: number
    medical_payments?: number
    uninsured_motorist_per_person?: number
    uninsured_motorist_per_accident?: number
    underinsured_motorist_per_person?: number
    underinsured_motorist_per_accident?: number
    comprehensive_deductible?: number
    collision_deductible?: number
    rental_reimbursement_per_day?: number
    rental_reimbursement_max?: number
    roadside_assistance?: boolean
    glass_deductible?: number
    agreed_value?: number
    stated_amount?: number
  }
  premium?: number
  notes?: string[]
}

interface PolicyExtraction {
  policy_number: string
  effective_date: string
  expiration_date: string
  carrier: string
  agent?: string
  agent_phone?: string
  claims_phone?: string
  vehicles: VehicleCoverage[]
  total_premium?: number
  payment_schedule?: string
}

async function extractPdfWithClaude(pdfPath: string): Promise<PolicyExtraction> {
  const buffer = fs.readFileSync(pdfPath)
  const base64 = buffer.toString("base64")

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64
            }
          },
          {
            type: "text",
            text: `Extract all auto insurance coverage information from this policy document. Return a JSON object with this structure:

{
  "policy_number": "string",
  "effective_date": "YYYY-MM-DD",
  "expiration_date": "YYYY-MM-DD",
  "carrier": "string",
  "agent": "string or null",
  "agent_phone": "string or null",
  "claims_phone": "string or null",
  "total_premium": number or null,
  "payment_schedule": "string description or null",
  "vehicles": [
    {
      "vin": "string",
      "year": number,
      "make": "string",
      "model": "string",
      "coverages": {
        "bodily_injury_per_person": number or null (in dollars),
        "bodily_injury_per_accident": number or null,
        "property_damage": number or null,
        "medical_payments": number or null,
        "uninsured_motorist_per_person": number or null,
        "uninsured_motorist_per_accident": number or null,
        "underinsured_motorist_per_person": number or null,
        "underinsured_motorist_per_accident": number or null,
        "comprehensive_deductible": number or null,
        "collision_deductible": number or null,
        "rental_reimbursement_per_day": number or null,
        "rental_reimbursement_max": number or null,
        "roadside_assistance": boolean,
        "glass_deductible": number or null,
        "agreed_value": number or null,
        "stated_amount": number or null
      },
      "premium": number or null (annual premium for this vehicle),
      "notes": ["array of any special endorsements, restrictions, or notable items"]
    }
  ]
}

Convert coverage limits like "250/500" to separate per_person (250000) and per_accident (500000) values.
Include any special endorsements, riders, or coverage modifications in the notes array.
Return ONLY valid JSON, no markdown or explanation.`
          }
        ]
      }
    ]
  })

  const content = response.content[0]
  if (content.type !== "text") {
    throw new Error("Unexpected response type")
  }

  // Parse the JSON response
  const jsonStr = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(jsonStr)
}

async function main() {
  // Accept path from command line or use default
  const policyPath = process.argv[2] || path.join(DROPBOX_PATH, "Vehicles/Insurance/auto new-policy-documents.pdf")

  if (!fs.existsSync(policyPath)) {
    console.error(`File not found: ${policyPath}`)
    process.exit(1)
  }

  console.log("Extracting policy data from:", policyPath)
  console.log("This may take a moment...\n")

  try {
    const data = await extractPdfWithClaude(policyPath)

    // Output as formatted JSON
    console.log(JSON.stringify(data, null, 2))

    // Also write to a file for easier use
    const outputPath = path.join(__dirname, "extracted-auto-insurance.json")
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))
    console.log(`\nAlso saved to: ${outputPath}`)

  } catch (error) {
    console.error("Error extracting PDF:", error)
    process.exit(1)
  }
}

main()
