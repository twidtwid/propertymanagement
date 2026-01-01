-- Add tax_lookup_url column to properties table
-- This stores the URL to the official tax lookup portal for each property

ALTER TABLE properties ADD COLUMN IF NOT EXISTS tax_lookup_url TEXT;

-- Set known tax lookup URLs for existing properties
-- NYC properties use the PTS Access portal
UPDATE properties SET tax_lookup_url =
    'https://a836-pts-access.nyc.gov/care/datalets/datalet.aspx?mode=soa_docs&UseSearch=no&pin=3' ||
    LPAD(block_number, 5, '0') || LPAD(lot_number, 4, '0') ||
    '&jur=65&taxyr=2026&LMparent=20'
WHERE state = 'NY' AND block_number IS NOT NULL AND lot_number IS NOT NULL;

-- Providence RI uses City Hall Systems
UPDATE properties SET tax_lookup_url = 'https://www.providenceri.gov/finance/property-tax/'
WHERE city = 'Providence' AND state = 'RI';

-- Santa Clara County CA uses their tax collector site
UPDATE properties SET tax_lookup_url = 'https://payments.sccgov.org/propertytax'
WHERE state = 'CA';

-- Vermont uses the town listers / grand list system
-- Dummerston
UPDATE properties SET tax_lookup_url = 'https://www.dummerston.org/departments/listers'
WHERE city = 'Dummerston' AND state = 'VT';

-- Brattleboro
UPDATE properties SET tax_lookup_url = 'https://www.brattleboro.org/departments/assessor'
WHERE city = 'Brattleboro' AND state = 'VT';

-- Verify the updates
SELECT name, city, state, tax_lookup_url
FROM properties
WHERE tax_lookup_url IS NOT NULL
ORDER BY name;
