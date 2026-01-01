/**
 * Property Tax Sync Service
 *
 * Orchestrates tax lookups across all configured properties and providers.
 */

import { query, queryOne } from '../db'
import { lookupNYCProperty, estimateNYCTaxBill, generateNYCInstallments } from './providers/nyc-open-data'
import type { TaxLookupProvider, TaxLookupResult } from './types'

interface TaxLookupConfig {
  id: string
  property_id: string
  property_name: string
  provider: TaxLookupProvider
  lookup_params: Record<string, string>
  is_active: boolean
  last_sync_at: string | null
}

interface SyncResult {
  configId: string
  propertyId: string
  propertyName: string
  provider: TaxLookupProvider
  success: boolean
  changesDetected: boolean
  error?: string
  data?: Record<string, unknown>
}

/**
 * Get all active tax lookup configurations
 */
export async function getActiveTaxConfigs(): Promise<TaxLookupConfig[]> {
  return query<TaxLookupConfig>(`
    SELECT
      c.id,
      c.property_id,
      p.name as property_name,
      c.provider,
      c.lookup_params,
      c.is_active,
      c.last_sync_at
    FROM tax_lookup_configs c
    JOIN properties p ON c.property_id = p.id
    WHERE c.is_active = TRUE
    ORDER BY p.name
  `)
}

/**
 * Sync a single property's tax data
 */
export async function syncPropertyTax(config: TaxLookupConfig): Promise<SyncResult> {
  const startTime = Date.now()

  // Log sync start
  const logId = await logSyncStart(config)

  try {
    let result: SyncResult

    switch (config.provider) {
      case 'nyc_open_data':
        result = await syncNYCTax(config)
        break
      case 'santa_clara_county':
        result = await syncSCCTax(config)
        break
      case 'vermont_nemrc':
        result = await syncVermontTax(config)
        break
      case 'city_hall_systems':
        result = await syncCityHallTax(config)
        break
      default:
        result = {
          configId: config.id,
          propertyId: config.property_id,
          propertyName: config.property_name,
          provider: config.provider,
          success: false,
          changesDetected: false,
          error: `Unknown provider: ${config.provider}`
        }
    }

    // Log sync completion
    await logSyncComplete(logId, result, Date.now() - startTime)

    // Update config last sync info
    await updateConfigSyncStatus(config.id, result)

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    await logSyncComplete(logId, {
      configId: config.id,
      propertyId: config.property_id,
      propertyName: config.property_name,
      provider: config.provider,
      success: false,
      changesDetected: false,
      error: errorMsg
    }, Date.now() - startTime)

    return {
      configId: config.id,
      propertyId: config.property_id,
      propertyName: config.property_name,
      provider: config.provider,
      success: false,
      changesDetected: false,
      error: errorMsg
    }
  }
}

/**
 * Sync NYC property tax using Open Data API
 */
async function syncNYCTax(config: TaxLookupConfig): Promise<SyncResult> {
  const params = config.lookup_params
  const { boro, block, lot } = params

  if (!boro || !block || !lot) {
    return {
      configId: config.id,
      propertyId: config.property_id,
      propertyName: config.property_name,
      provider: config.provider,
      success: false,
      changesDetected: false,
      error: 'Missing NYC lookup params: boro, block, lot'
    }
  }

  const result = await lookupNYCProperty({
    borough: boro as '1' | '2' | '3' | '4' | '5',
    block,
    lot
  })

  if (!result.success || !result.data) {
    return {
      configId: config.id,
      propertyId: config.property_id,
      propertyName: config.property_name,
      provider: config.provider,
      success: false,
      changesDetected: false,
      error: result.error || 'No data returned'
    }
  }

  // Calculate estimated tax from assessed value
  const taxEstimate = estimateNYCTaxBill(result.data.assessedValue, result.data.taxClass)

  // Store result
  const changesDetected = await storeTaxResult(config, {
    taxYear: result.data.year,
    assessedValue: result.data.assessedValue,
    marketValue: result.data.marketValue,
    taxRate: taxEstimate.taxRate,
    annualTaxAmount: taxEstimate.annualTax,
    installments: generateNYCInstallments(result.data.year, taxEstimate.quarterlyTax),
    rawData: (result.rawData || {}) as Record<string, unknown>,
    sourceUrl: `https://data.cityofnewyork.us/resource/8y4t-faws.json?boro=${boro}&block=${block}&lot=${lot}`
  })

  return {
    configId: config.id,
    propertyId: config.property_id,
    propertyName: config.property_name,
    provider: config.provider,
    success: true,
    changesDetected,
    data: result.data
  }
}

/**
 * Sync Santa Clara County tax (placeholder - requires external Playwright script)
 */
async function syncSCCTax(config: TaxLookupConfig): Promise<SyncResult> {
  // SCC requires Playwright which doesn't work in serverless
  // The external script posts results to /api/taxes/sync/callback
  return {
    configId: config.id,
    propertyId: config.property_id,
    propertyName: config.property_name,
    provider: config.provider,
    success: false,
    changesDetected: false,
    error: 'SCC sync requires external Playwright script. Run: npm run tax:sync:scc'
  }
}

/**
 * Sync Vermont NEMRC tax (placeholder)
 */
async function syncVermontTax(config: TaxLookupConfig): Promise<SyncResult> {
  // TODO: Implement NEMRC lookup
  return {
    configId: config.id,
    propertyId: config.property_id,
    propertyName: config.property_name,
    provider: config.provider,
    success: false,
    changesDetected: false,
    error: 'Vermont NEMRC sync not yet implemented'
  }
}

/**
 * Sync City Hall Systems tax (Providence, RI)
 */
async function syncCityHallTax(config: TaxLookupConfig): Promise<SyncResult> {
  // TODO: Implement City Hall Systems lookup
  return {
    configId: config.id,
    propertyId: config.property_id,
    propertyName: config.property_name,
    provider: config.provider,
    success: false,
    changesDetected: false,
    error: 'City Hall Systems sync not yet implemented'
  }
}

/**
 * Run sync for all active configurations
 */
export async function syncAllTaxes(): Promise<{
  total: number
  successful: number
  failed: number
  results: SyncResult[]
}> {
  const configs = await getActiveTaxConfigs()

  const results: SyncResult[] = []

  for (const config of configs) {
    // Skip providers that require external scripts
    if (config.provider === 'santa_clara_county') {
      console.log(`[Tax Sync] Skipping ${config.property_name} - requires external script`)
      continue
    }

    console.log(`[Tax Sync] Syncing ${config.property_name} (${config.provider})...`)
    const result = await syncPropertyTax(config)
    results.push(result)

    // Small delay between requests to be nice to APIs
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  }
}

// Helper functions for database operations

async function logSyncStart(config: TaxLookupConfig): Promise<string> {
  const result = await queryOne<{ id: string }>(`
    INSERT INTO tax_sync_log (config_id, property_id, provider, status)
    VALUES ($1, $2, $3, 'running')
    RETURNING id
  `, [config.id, config.property_id, config.provider])

  return result?.id || ''
}

async function logSyncComplete(
  logId: string,
  result: SyncResult,
  durationMs: number
): Promise<void> {
  await query(`
    UPDATE tax_sync_log
    SET
      completed_at = NOW(),
      status = $1,
      error_message = $2,
      changes_detected = $3,
      details = $4,
      duration_ms = $5
    WHERE id = $6
  `, [
    result.success ? 'success' : 'error',
    result.error || null,
    result.changesDetected,
    JSON.stringify(result.data || {}),
    durationMs,
    logId
  ])
}

async function updateConfigSyncStatus(configId: string, result: SyncResult): Promise<void> {
  await query(`
    UPDATE tax_lookup_configs
    SET
      last_sync_at = NOW(),
      last_sync_status = $1,
      last_error = $2,
      updated_at = NOW()
    WHERE id = $3
  `, [
    result.success ? 'success' : 'error',
    result.error || null,
    configId
  ])
}

async function storeTaxResult(
  config: TaxLookupConfig,
  data: {
    taxYear: number
    assessedValue?: number
    marketValue?: number
    taxRate?: number
    annualTaxAmount?: number
    installments: unknown[]
    rawData: Record<string, unknown>
    sourceUrl?: string
  }
): Promise<boolean> {
  // Check if we already have a result for this year
  const existing = await queryOne<{ id: string; annual_tax_amount: number }>(`
    SELECT id, annual_tax_amount
    FROM tax_lookup_results
    WHERE config_id = $1 AND tax_year = $2
  `, [config.id, data.taxYear])

  if (existing) {
    // Update existing record
    await query(`
      UPDATE tax_lookup_results
      SET
        assessed_value = $1,
        market_value = $2,
        tax_rate = $3,
        annual_tax_amount = $4,
        installments = $5,
        raw_data = $6,
        source_url = $7,
        synced_at = NOW()
      WHERE id = $8
    `, [
      data.assessedValue || null,
      data.marketValue || null,
      data.taxRate || null,
      data.annualTaxAmount || null,
      JSON.stringify(data.installments),
      JSON.stringify(data.rawData),
      data.sourceUrl || null,
      existing.id
    ])

    // Return whether there was a change
    return existing.annual_tax_amount !== data.annualTaxAmount
  } else {
    // Insert new record
    await query(`
      INSERT INTO tax_lookup_results (
        config_id, property_id, provider, tax_year,
        assessed_value, market_value, tax_rate, annual_tax_amount,
        installments, raw_data, source_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      config.id,
      config.property_id,
      config.provider,
      data.taxYear,
      data.assessedValue || null,
      data.marketValue || null,
      data.taxRate || null,
      data.annualTaxAmount || null,
      JSON.stringify(data.installments),
      JSON.stringify(data.rawData),
      data.sourceUrl || null
    ])

    return true // New data is always a change
  }
}
