import { NextRequest, NextResponse } from "next/server"
import { query, queryOne, transaction } from "@/lib/db"
import { parseBoACSV, validateBoACSV, getMatchableTransactions, generateTransactionHash } from "@/lib/banking/csv-parser"
import { matchTransactionsToBills, categorizeMatchResults } from "@/lib/banking/matcher"
import { withLogging } from "@/lib/logger/api-wrapper"
import { getLogger } from "@/lib/logger/contextual"
import { audit } from "@/lib/logger/audit"
import type { PoolClient } from "pg"

interface ImportBatch {
  id: string
  filename: string
  account_type: string | null
  date_range_start: string | null
  date_range_end: string | null
  transaction_count: number
  matched_count: number
}

/**
 * POST /api/banking/import
 * Import bank transactions from CSV file.
 *
 * Body: { csvContent: string, filename: string }
 */
export const POST = withLogging(async (request: NextRequest) => {
  const log = getLogger("api.banking.import")

  const body = await request.json()
  const { csvContent, filename } = body

  if (!csvContent) {
    log.warn("Missing csvContent in request")
    return NextResponse.json(
      { error: "csvContent is required" },
      { status: 400 }
    )
  }

  // Validate CSV format
  const validation = validateBoACSV(csvContent)
  if (!validation.valid) {
    log.warn({ error: validation.error }, "Invalid CSV format")
    return NextResponse.json(
      { error: validation.error || "Invalid CSV format" },
      { status: 400 }
    )
  }

  // Parse CSV
  const parseResult = parseBoACSV(csvContent)
  if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
    log.warn({ errors: parseResult.errors }, "Failed to parse CSV")
    return NextResponse.json(
      { error: "Failed to parse CSV", details: parseResult.errors },
      { status: 400 }
    )
  }

  log.info({
    filename: filename || 'upload',
    transactionCount: parseResult.transactions.length,
    stats: parseResult.stats
  }, "Parsed bank transactions")

  // Get matchable transactions (debits that could be bills)
  const matchableTransactions = getMatchableTransactions(parseResult.transactions)
  log.debug({ count: matchableTransactions.length }, "Matchable transactions identified")

  // Match to bills
  const matchResults = await matchTransactionsToBills(matchableTransactions)
  const categorized = categorizeMatchResults(matchResults)

  log.info({
    autoConfirmed: categorized.autoConfirmed.length,
    needsReview: categorized.needsReview.length,
    noMatch: categorized.noMatch.length
  }, "Match results")

  // Store import batch and transactions
  const importResult = await transaction(async (client: PoolClient) => {
    // Create import batch
    const batchResult = await client.query<ImportBatch>(`
      INSERT INTO bank_import_batches (
        filename, account_type, date_range_start, date_range_end,
        transaction_count, matched_count
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      filename || 'upload.csv',
      parseResult.accountType,
      parseResult.dateRangeStart?.toISOString().split('T')[0] || null,
      parseResult.dateRangeEnd?.toISOString().split('T')[0] || null,
      matchableTransactions.length,
      categorized.autoConfirmed.length
    ])

    const batch = batchResult.rows[0]

    // Store matchable transactions with their match results
    let storedCount = 0
    for (const result of matchResults) {
      const txn = result.transaction
      const hash = generateTransactionHash(txn)

      // Check for duplicate (same transaction in same batch)
      const existing = await client.query(
        `SELECT id FROM bank_transactions WHERE import_batch_id = $1 AND transaction_date = $2 AND amount = $3 AND description = $4`,
        [batch.id, txn.date.toISOString().split('T')[0], txn.amount, txn.description]
      )

      if (existing.rows.length > 0) {
        continue // Skip duplicate
      }

      await client.query(`
        INSERT INTO bank_transactions (
          import_batch_id, transaction_date, description, amount,
          check_number, matched_bill_id, matched_at, match_confidence, match_method,
          is_confirmed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        batch.id,
        txn.date.toISOString().split('T')[0],
        txn.description,
        txn.amount,
        txn.checkNumber,
        result.bestMatch?.bill.id || null,
        result.bestMatch ? new Date().toISOString() : null,
        result.bestMatch?.confidence || null,
        result.bestMatch?.matchMethod || null,
        result.autoConfirm
      ])

      storedCount++

      // Auto-confirm matched bills (confidence >= 0.90)
      if (result.autoConfirm && result.bestMatch) {
        await client.query(`
          UPDATE bills
          SET confirmation_date = $1, confirmation_notes = $2, status = 'confirmed'
          WHERE id = $3 AND status = 'sent'
        `, [
          txn.date.toISOString().split('T')[0],
          `Auto-confirmed via bank import: ${txn.description}`,
          result.bestMatch.bill.id
        ])
      }
    }

    return {
      batchId: batch.id,
      transactionsStored: storedCount,
      autoConfirmed: categorized.autoConfirmed.length,
      needsReview: categorized.needsReview.length,
      noMatch: categorized.noMatch.length
    }
  })

  // Audit log the import
  await audit({
    action: "import",
    entityType: "bank_import",
    entityId: importResult.batchId,
    entityName: filename || 'upload.csv',
    metadata: {
      transactionsStored: importResult.transactionsStored,
      autoConfirmed: importResult.autoConfirmed,
      needsReview: importResult.needsReview,
      noMatch: importResult.noMatch
    }
  })

  log.info({
    batchId: importResult.batchId,
    transactionsStored: importResult.transactionsStored,
    autoConfirmed: importResult.autoConfirmed
  }, "Bank import completed")

  // Return detailed results for UI
  return NextResponse.json({
    success: true,
    message: `Imported ${importResult.transactionsStored} transactions, ${importResult.autoConfirmed} auto-confirmed`,
    batchId: importResult.batchId,
    stats: parseResult.stats,
    dateRange: {
      start: parseResult.dateRangeStart?.toISOString().split('T')[0],
      end: parseResult.dateRangeEnd?.toISOString().split('T')[0]
    },
    matches: {
      autoConfirmed: categorized.autoConfirmed.map(r => ({
        date: r.transaction.date.toISOString().split('T')[0],
        description: r.transaction.description,
        amount: r.transaction.amount,
        checkNumber: r.transaction.checkNumber,
        matchedBill: r.bestMatch?.bill.description,
        confidence: r.bestMatch?.confidence,
        reason: r.bestMatch?.matchReason
      })),
      needsReview: categorized.needsReview.map(r => ({
        date: r.transaction.date.toISOString().split('T')[0],
        description: r.transaction.description,
        amount: r.transaction.amount,
        checkNumber: r.transaction.checkNumber,
        suggestedMatch: r.bestMatch ? {
          billId: r.bestMatch.bill.id,
          description: r.bestMatch.bill.description,
          confidence: r.bestMatch.confidence,
          reason: r.bestMatch.matchReason
        } : null,
        alternatives: r.matches.slice(1, 4).map(m => ({
          billId: m.bill.id,
          description: m.bill.description,
          confidence: m.confidence
        }))
      })),
      noMatch: categorized.noMatch.map(r => ({
        date: r.transaction.date.toISOString().split('T')[0],
        description: r.transaction.description,
        amount: r.transaction.amount,
        checkNumber: r.transaction.checkNumber,
        extractedVendor: r.transaction.extractedVendorName
      }))
    }
  })
})

/**
 * GET /api/banking/import
 * Get recent import history.
 */
export const GET = withLogging(async () => {
  const log = getLogger("api.banking.import")

  const batches = await query<ImportBatch>(`
    SELECT * FROM bank_import_batches
    ORDER BY imported_at DESC
    LIMIT 10
  `)

  log.debug({ batchCount: batches.length }, "Retrieved import history")

  return NextResponse.json({
    success: true,
    batches: batches.map(b => ({
      id: b.id,
      filename: b.filename,
      accountType: b.account_type,
      dateRange: b.date_range_start && b.date_range_end
        ? `${b.date_range_start} to ${b.date_range_end}`
        : null,
      transactionCount: b.transaction_count,
      matchedCount: b.matched_count
    }))
  })
})

export const maxDuration = 60 // 1 minute max
