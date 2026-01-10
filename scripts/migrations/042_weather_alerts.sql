-- Migration: 042_weather_alerts.sql
-- Weather alerting system: zone configuration and alert tracking

-- Add weather_alert to pinned_entity_type enum
ALTER TYPE pinned_entity_type ADD VALUE IF NOT EXISTS 'weather_alert';

-- Weather zone configuration per property
-- Links properties to NWS zones (US) or Météo-France departments (France)
CREATE TABLE IF NOT EXISTS weather_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('nws', 'meteo_france')),
  zone_code TEXT NOT NULL,  -- NWS: 'VTZ007', Météo-France: '75'
  zone_name TEXT,           -- Human-readable: 'Windham County, VT'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id)
);

-- Weather alerts fetched from APIs
CREATE TABLE IF NOT EXISTS weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,  -- NWS alert ID or Météo-France ID
  provider TEXT NOT NULL CHECK (provider IN ('nws', 'meteo_france')),
  zone_code TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- 'Winter Storm Warning', 'Flood Watch', etc.
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe', 'extreme')),
  urgency TEXT,                      -- 'immediate', 'expected', 'future'
  headline TEXT NOT NULL,
  description TEXT,
  instruction TEXT,                  -- Safety instructions
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ,           -- When Pushover notification was sent
  status_change_notified_at TIMESTAMPTZ,  -- When upgrade/downgrade notified
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link properties to alerts (many properties can share same zone)
CREATE TABLE IF NOT EXISTS property_weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  weather_alert_id UUID NOT NULL REFERENCES weather_alerts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, weather_alert_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weather_alerts_zone ON weather_alerts(zone_code);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_expires ON weather_alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_active ON weather_alerts(expires_at) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_property_weather_alerts_property ON property_weather_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_weather_zones_property ON weather_zones(property_id);

-- Seed weather zone configuration for properties
-- VT properties: Western Windham zone (VTZ014) - covers Brattleboro/Dummerston
INSERT INTO weather_zones (property_id, provider, zone_code, zone_name)
SELECT id, 'nws', 'VTZ014', 'Western Windham, VT'
FROM properties
WHERE (city ILIKE '%dummerston%' OR city ILIKE '%brattleboro%')
  AND country = 'USA'
ON CONFLICT (property_id) DO NOTHING;

-- Brooklyn condos: Kings County zone (NYZ075) - covers 11249 Williamsburg
INSERT INTO weather_zones (property_id, provider, zone_code, zone_name)
SELECT id, 'nws', 'NYZ075', 'Kings (Brooklyn), NY'
FROM properties
WHERE city ILIKE '%brooklyn%' AND state = 'NY'
ON CONFLICT (property_id) DO NOTHING;

-- Rhode Island: Providence County zone
INSERT INTO weather_zones (property_id, provider, zone_code, zone_name)
SELECT id, 'nws', 'RIZ002', 'Providence County, RI'
FROM properties
WHERE state = 'RI' OR city ILIKE '%providence%'
ON CONFLICT (property_id) DO NOTHING;

-- Paris: Department 75
INSERT INTO weather_zones (property_id, provider, zone_code, zone_name)
SELECT id, 'meteo_france', '75', 'Paris, France'
FROM properties
WHERE city ILIKE '%paris%' AND country IN ('France', 'FRA')
ON CONFLICT (property_id) DO NOTHING;

-- Martinique: Department 972
INSERT INTO weather_zones (property_id, provider, zone_code, zone_name)
SELECT id, 'meteo_france', '972', 'Martinique'
FROM properties
WHERE name ILIKE '%martinique%' OR city ILIKE '%fort-de-france%'
ON CONFLICT (property_id) DO NOTHING;
