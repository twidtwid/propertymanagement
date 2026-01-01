/**
 * Property Tax Lookup System Types
 */

export type TaxLookupProvider =
  | 'santa_clara_county'  // San Jose, CA
  | 'nyc_finance'         // Brooklyn, NY
  | 'nyc_open_data'       // Brooklyn, NY (Open Data API)
  | 'city_hall_systems'   // Providence, RI
  | 'vermont_span'        // Vermont properties
  | 'vermont_nemrc'       // Vermont NEMRC system
  | 'manual'              // Manual entry (no automated lookup)

export interface TaxLookupConfig {
  id: string
  property_id: string
  provider: TaxLookupProvider
  // Provider-specific lookup keys
  lookup_key: string       // e.g., parcel ID, BBL, address
  lookup_params: Record<string, string>  // Additional params
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: 'success' | 'error' | 'no_change' | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface TaxLookupResult {
  id: string
  config_id: string
  property_id: string
  provider: TaxLookupProvider
  tax_year: number
  // Scraped data
  assessed_value: number | null
  tax_amount: number | null
  installments: TaxInstallment[]
  raw_data: Record<string, unknown>  // Full scraped data for debugging
  // Sync info
  synced_at: string
  source_url: string | null
  screenshot_url: string | null  // For debugging
}

export interface TaxInstallment {
  installment_number: number
  amount: number
  due_date: string
  status: 'unpaid' | 'paid' | 'delinquent' | 'unknown'
  penalty_amount?: number
}

export interface TaxSyncLog {
  id: string
  config_id: string
  property_id: string
  started_at: string
  completed_at: string | null
  status: 'running' | 'success' | 'error'
  error_message: string | null
  changes_detected: boolean
  details: Record<string, unknown>
}

// Provider-specific configurations
export interface SantaClaraLookupParams {
  parcel_number: string  // e.g., "274-15-034"
  address?: string       // Fallback search
}

export interface NYCLookupParams {
  borough: '1' | '2' | '3' | '4' | '5'  // 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island
  block: string
  lot: string
}

export interface CityHallSystemsParams {
  municipality: string   // e.g., "Providence"
  state: string         // e.g., "RI"
  address: string       // e.g., "88 Williams St"
}

export interface VermontSPANParams {
  span: string          // e.g., "186-059-10695"
  town?: string         // e.g., "Dummerston"
}

// API response types
export interface TaxLookupResponse {
  success: boolean
  property_id: string
  provider: TaxLookupProvider
  data?: TaxLookupResult
  error?: string
  synced_at: string
}
