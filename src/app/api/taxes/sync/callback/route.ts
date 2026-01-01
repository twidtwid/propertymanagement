import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { syncTaxToPayments, getJurisdictionFromProvider } from '@/lib/taxes/sync-to-payments'

export const dynamic = 'force-dynamic'

/**
 * Callback endpoint for external Playwright tax scrapers
 *
 * External scripts (Python/Playwright) post their results here after scraping.
 * This allows serverless-incompatible scrapers to still sync data to the app.
 *
 * Usage:
 *   python3 scripts/lookup_scc_tax.py --callback http://localhost:3000/api/taxes/sync/callback
 *   python3 scripts/lookup_providence_tax.py --callback http://localhost:3000/api/taxes/sync/callback
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const {
      provider,
      property_id,
      parcel_number,
      address,
      // Tax data
      tax_year,
      assessed_value,
      annual_tax,
      quarterly_amount,
      installments,
      owner,
      // Metadata
      scraped_at,
      success,
      error,
      raw_data
    } = data

    if (!provider) {
      return NextResponse.json({ error: 'Missing provider' }, { status: 400 })
    }

    // Find the config for this property
    let config = null

    if (property_id) {
      config = await queryOne<{ id: string; property_id: string }>(`
        SELECT id, property_id FROM tax_lookup_configs
        WHERE property_id = $1 AND provider = $2 AND is_active = TRUE
      `, [property_id, provider])
    }

    if (!config && parcel_number) {
      // Try to match by parcel number in lookup_params
      config = await queryOne<{ id: string; property_id: string }>(`
        SELECT id, property_id FROM tax_lookup_configs
        WHERE provider = $1
        AND is_active = TRUE
        AND (
          lookup_params->>'parcel_number' = $2
          OR lookup_params->>'span' = $2
        )
      `, [provider, parcel_number])
    }

    if (!config && address) {
      // Try to match by address
      config = await queryOne<{ id: string; property_id: string }>(`
        SELECT id, property_id FROM tax_lookup_configs
        WHERE provider = $1
        AND is_active = TRUE
        AND lookup_params->>'address' ILIKE $2
      `, [provider, `%${address}%`])
    }

    if (!config) {
      return NextResponse.json({
        error: 'No matching tax config found',
        hint: 'Ensure property has active tax_lookup_config for this provider'
      }, { status: 404 })
    }

    // Log the sync
    await query(`
      INSERT INTO tax_sync_log (config_id, property_id, provider, status, details, completed_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      config.id,
      config.property_id,
      provider,
      success ? 'success' : 'error',
      JSON.stringify({ source: 'callback', error, scraped_at })
    ])

    if (!success) {
      // Update config with error
      await query(`
        UPDATE tax_lookup_configs
        SET last_sync_at = NOW(), last_sync_status = 'error', last_error = $1
        WHERE id = $2
      `, [error, config.id])

      return NextResponse.json({
        success: false,
        message: 'Sync error logged',
        error
      })
    }

    // Store or update the tax result
    const existingResult = await queryOne<{ id: string }>(`
      SELECT id FROM tax_lookup_results
      WHERE config_id = $1 AND tax_year = $2
    `, [config.id, tax_year || new Date().getFullYear()])

    const installmentsJson = JSON.stringify(installments || [])
    const rawDataJson = JSON.stringify(raw_data || data)

    if (existingResult) {
      await query(`
        UPDATE tax_lookup_results
        SET
          assessed_value = COALESCE($1, assessed_value),
          annual_tax_amount = COALESCE($2, annual_tax_amount),
          installments = $3,
          raw_data = $4,
          synced_at = NOW()
        WHERE id = $5
      `, [
        assessed_value,
        annual_tax || (quarterly_amount ? quarterly_amount * 4 : null),
        installmentsJson,
        rawDataJson,
        existingResult.id
      ])
    } else {
      await query(`
        INSERT INTO tax_lookup_results (
          config_id, property_id, provider, tax_year,
          assessed_value, annual_tax_amount, installments, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        config.id,
        config.property_id,
        provider,
        tax_year || new Date().getFullYear(),
        assessed_value,
        annual_tax || (quarterly_amount ? quarterly_amount * 4 : null),
        installmentsJson,
        rawDataJson
      ])
    }

    // Update config sync status
    await query(`
      UPDATE tax_lookup_configs
      SET last_sync_at = NOW(), last_sync_status = 'success', last_error = NULL
      WHERE id = $1
    `, [config.id])

    // Also sync to property_taxes table for calendar/payments display
    const jurisdiction = getJurisdictionFromProvider(provider)
    const syncResult = await syncTaxToPayments({
      property_id: config.property_id,
      provider,
      tax_year: tax_year || new Date().getFullYear(),
      jurisdiction,
      annual_tax: annual_tax || (quarterly_amount ? quarterly_amount * 4 : undefined),
      quarterly_amount,
      installments: installments?.map((inst: { installment_number?: number; number?: number; amount: number; due_date: string; status?: string }) => ({
        installment_number: inst.installment_number || inst.number || 0,
        amount: inst.amount,
        due_date: inst.due_date,
        status: inst.status as 'paid' | 'unpaid' | 'unknown' | undefined
      }))
    })

    return NextResponse.json({
      success: true,
      message: 'Tax data synced successfully',
      config_id: config.id,
      property_id: config.property_id,
      payments_sync: syncResult
    })

  } catch (error) {
    console.error('[Tax Callback] Error:', error)
    return NextResponse.json({
      error: 'Failed to process callback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
