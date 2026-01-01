-- Property Tax Lookup System Tables
-- Migration 002

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE tax_lookup_provider AS ENUM (
  'santa_clara_county',  -- San Jose, CA - uses Playwright
  'nyc_open_data',       -- NYC - uses Open Data API
  'city_hall_systems',   -- Providence, RI
  'vermont_nemrc',       -- Vermont SPAN lookup
  'manual'               -- No automated lookup
);

CREATE TYPE tax_sync_status AS ENUM (
  'pending',
  'running',
  'success',
  'error',
  'no_change'
);

-- ============================================
-- TAX LOOKUP CONFIG
-- ============================================

-- Configuration for each property's tax lookup
CREATE TABLE tax_lookup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider tax_lookup_provider NOT NULL,
  -- Provider-specific lookup keys stored as JSON
  lookup_params JSONB NOT NULL DEFAULT '{}',
  -- e.g., {"parcel_number": "274-15-034"} for Santa Clara
  -- e.g., {"boro": "3", "block": "2324", "lot": "1305"} for NYC
  -- e.g., {"municipality": "Providence", "address": "88 Williams St"} for City Hall Systems
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_sync_status tax_sync_status,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, provider)
);

-- ============================================
-- TAX LOOKUP RESULTS
-- ============================================

-- Stores the actual scraped/fetched tax data
CREATE TABLE tax_lookup_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES tax_lookup_configs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider tax_lookup_provider NOT NULL,
  tax_year INTEGER NOT NULL,
  -- Scraped data
  assessed_value DECIMAL(12,2),
  market_value DECIMAL(12,2),
  tax_rate DECIMAL(8,6),
  annual_tax_amount DECIMAL(10,2),
  -- Installment breakdown stored as JSON
  installments JSONB DEFAULT '[]',
  -- e.g., [{"number": 1, "amount": 1495.83, "due_date": "2025-01-24", "status": "unpaid"}]
  -- Raw response for debugging
  raw_data JSONB DEFAULT '{}',
  source_url TEXT,
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(config_id, tax_year)
);

-- ============================================
-- TAX SYNC LOG
-- ============================================

-- Audit log of all sync attempts
CREATE TABLE tax_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES tax_lookup_configs(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  provider tax_lookup_provider NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status tax_sync_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  changes_detected BOOLEAN DEFAULT FALSE,
  -- Details of what was found/changed
  details JSONB DEFAULT '{}',
  -- HTTP/scraping metadata
  request_url TEXT,
  response_status INTEGER,
  duration_ms INTEGER
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_tax_lookup_configs_property ON tax_lookup_configs(property_id);
CREATE INDEX idx_tax_lookup_configs_active ON tax_lookup_configs(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tax_lookup_results_property ON tax_lookup_results(property_id);
CREATE INDEX idx_tax_lookup_results_year ON tax_lookup_results(tax_year DESC);
CREATE INDEX idx_tax_sync_log_config ON tax_sync_log(config_id);
CREATE INDEX idx_tax_sync_log_status ON tax_sync_log(status);
CREATE INDEX idx_tax_sync_log_started ON tax_sync_log(started_at DESC);
