-- Migration: 040_vendor_audit_sync.sql
-- Sync vendors with Anne's CSV (January 2026 audit)
-- Adds missing vendors and normalizes phone formats

-- Add missing vendors (only if they don't exist)
INSERT INTO vendors (id, name, phone, email, specialties, notes, created_at, updated_at)
SELECT gen_random_uuid(), 'Eva Laskowski', '469-396-6400', 'evalaskows@gmail.com', '{other}', 'Web developer. Referred by Kris Braithwaite (trainer)', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Eva Laskowski');

INSERT INTO vendors (id, name, phone, email, specialties, notes, created_at, updated_at)
SELECT gen_random_uuid(), 'Jennifer Tammel', '401-225-9754', NULL, '{cleaning}', 'Deep cleaner. Recommended by Brady Parker', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Jennifer Tammel');

-- Normalize phone formats to xxx-xxx-xxxx
UPDATE vendors SET phone = '802-775-5952', updated_at = NOW() WHERE name = 'Chris/Michele/Jared' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '802-282-9205', updated_at = NOW() WHERE name = 'Dennis Moore' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '802-451-8362', updated_at = NOW() WHERE name = 'Gracie' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '802-380-4548', updated_at = NOW() WHERE name = 'Castine' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '802-344-0147', updated_at = NOW() WHERE name = 'Family Movers' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '603-848-6523', updated_at = NOW() WHERE name = 'Tim Bow' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '413-478-8949', updated_at = NOW() WHERE name = 'Clarence' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '802-258-8890', updated_at = NOW() WHERE name = 'Conner Hamilton' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '347-682-8192', updated_at = NOW() WHERE name = 'Carlos' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '347-990-0180', updated_at = NOW() WHERE name = 'Clenio Borba' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '718-578-7048', updated_at = NOW() WHERE name = 'Public Parking' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '401-941-0128', updated_at = NOW() WHERE name = 'Richard Cragin' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '415-612-5030', updated_at = NOW() WHERE name = 'Sublime Maid Pro' AND phone NOT LIKE '___-___-____';
UPDATE vendors SET phone = '401-435-3600', updated_at = NOW() WHERE name = 'Thomas DiCarlo' AND phone NOT LIKE '___-___-____';
