/**
 * Extract vendor data from Excel file
 */

import * as XLSX from "xlsx"

const filePath = process.argv[2] || "/Users/toddhome/Desktop/vendors.xlsx"

const workbook = XLSX.readFile(filePath)

// Output all sheet names
console.log("Sheets:", workbook.SheetNames)
console.log("\n")

// Process each sheet
for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===\n`)
  const sheet = workbook.Sheets[sheetName]

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

  // Output as JSON for parsing
  console.log(JSON.stringify(data, null, 2))
}
