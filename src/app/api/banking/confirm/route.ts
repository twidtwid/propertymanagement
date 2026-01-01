import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db"
import { withLogging } from "@/lib/logger/api-wrapper"
import { getLogger } from "@/lib/logger/contextual"
import { audit } from "@/lib/logger/audit"
import type { PoolClient } from "pg"

/**
 * POST /api/banking/confirm
 * Confirm a bank transaction match to a bill.
 *
 * Body: { transactionId: string, billId: string }
 */
export const POST = withLogging(async (request: NextRequest) => {
  const log = getLogger("api.banking.confirm")

  const body = await request.json()
  const { transactionId, billId } = body

  if (!transactionId || !billId) {
    log.warn("Missing required fields", { transactionId, billId })
    return NextResponse.json(
      { error: "transactionId and billId are required" },
      { status: 400 }
    )
  }

  try {
    const result = await transaction(async (client: PoolClient) => {
      // Get the bank transaction
      const txnResult = await client.query(
        `SELECT * FROM bank_transactions WHERE id = $1`,
        [transactionId]
      )

      if (txnResult.rows.length === 0) {
        throw new Error("Transaction not found")
      }

      const txn = txnResult.rows[0]

      // Get the bill
      const billResult = await client.query(
        `SELECT * FROM bills WHERE id = $1`,
        [billId]
      )

      if (billResult.rows.length === 0) {
        throw new Error("Bill not found")
      }

      const bill = billResult.rows[0]
      const oldStatus = bill.status

      // Update the bank transaction
      await client.query(`
        UPDATE bank_transactions
        SET matched_bill_id = $1, matched_at = NOW(), match_confidence = 1.0,
            match_method = 'manual', is_confirmed = TRUE
        WHERE id = $2
      `, [billId, transactionId])

      // Update the bill to confirmed
      await client.query(`
        UPDATE bills
        SET confirmation_date = $1, confirmation_notes = $2, status = 'confirmed'
        WHERE id = $3
      `, [
        txn.transaction_date,
        `Manually confirmed via bank import: ${txn.description}`,
        billId
      ])

      return {
        transactionId,
        billId,
        confirmed: true,
        oldStatus,
        txnDescription: txn.description,
        txnAmount: txn.amount,
        billDescription: bill.description,
      }
    })

    // Record audit log
    await audit({
      action: "confirm",
      entityType: "bill",
      entityId: billId,
      entityName: result.billDescription || `Bill ${billId}`,
      changes: {
        status: { old: result.oldStatus, new: "confirmed" },
      },
      metadata: {
        transactionId,
        matchMethod: "manual",
        bankDescription: result.txnDescription,
        bankAmount: result.txnAmount,
      },
    })

    log.info("Bank transaction confirmed", {
      transactionId,
      billId,
      billDescription: result.billDescription,
    })

    return NextResponse.json({
      success: true,
      message: "Transaction confirmed",
      transactionId: result.transactionId,
      billId: result.billId,
      confirmed: result.confirmed,
    })

  } catch (error) {
    log.error("Bank confirmation failed", {
      transactionId,
      billId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/banking/confirm
 * Mark a transaction as "not a bill" (dismiss it).
 *
 * Body: { transactionId: string }
 */
export const DELETE = withLogging(async (request: NextRequest) => {
  const log = getLogger("api.banking.confirm")

  const body = await request.json()
  const { transactionId } = body

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId is required" },
      { status: 400 }
    )
  }

  try {
    // Mark as confirmed without matching to a bill (dismissed)
    await query(`
      UPDATE bank_transactions
      SET is_confirmed = TRUE, matched_bill_id = NULL, match_confidence = NULL,
          match_method = NULL
      WHERE id = $1
    `, [transactionId])

    log.info("Bank transaction dismissed", { transactionId })

    return NextResponse.json({
      success: true,
      message: "Transaction dismissed"
    })

  } catch (error) {
    log.error("Failed to dismiss transaction", {
      transactionId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
})
