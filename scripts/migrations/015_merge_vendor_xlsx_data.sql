-- Migration 015: Merge vendor data from vendors.xlsx
-- Carefully merging all fields, adding missing data to notes where no direct field exists
-- Source: /Users/toddhome/Desktop/vendors.xlsx

BEGIN;

-- ============================================================================
-- VERMONT VENDORS - Updates and new entries
-- ============================================================================

-- Update Cocoplum with address
UPDATE vendors SET
  address = '1300 Putney Rd, Brattleboro, VT'
WHERE name = 'Cocoplum' AND specialty = 'appliance';

-- Update Chris Lojun - add "Lives nearby" note
UPDATE vendors SET
  notes = 'Electrician. Lives nearby.'
WHERE name = 'Chris Lojun';

-- Update Dead River with account info
UPDATE vendors SET
  notes = 'Propane + Oil. Acct: 3022329 for both houses. 1 Putney Road, Brattleboro, VT 05301. Autopay. Login: Email, R!!!'
WHERE name = 'Dead River';

-- Update Green Mountain Power with full account details
UPDATE vendors SET
  notes = '2001 Sunset: 74303300003 (Under Michael''s name, primary acct for everything but 1910). 1910 Sunset: 80417229533 (annespalterstudios@gmail). 2055 W Dummerston: 8041722953. 22 Kelly Rd Farm: 3642667187. Auto-pay 0346. Login: Email, R!!'
WHERE name = 'Green Mountain Power';

-- Update Powers Generators with full details
UPDATE vendors SET
  notes = 'Generator maintenance and service. Powers Generator Service LLC, PO Box 10005, Swanzey, NH 03446. Back on autopay Feb 2025.'
WHERE name LIKE '%Powers Generators%' OR company LIKE '%Powers%';

-- Update Allen Pools & Spas with autopay info
UPDATE vendors SET
  notes = 'Hot tub maintenance. Chris (sales), Michele (billing), Jared (maintenance). Autopay.'
WHERE company = 'Allen Pools & Spas';

-- Update Starlink with autopay
UPDATE vendors SET
  notes = 'Internet service. Autopay (Anne).'
WHERE name = 'Starlink';

-- Update Dennis Moore with porch note
UPDATE vendors SET
  notes = 'Handyman. 88 Fisch Rd, Dummerston, VT 05301. Built 2001 porch 2024.'
WHERE name = 'Dennis Moore';

-- Update Steve Gassett HVAC
UPDATE vendors SET
  notes = 'HVAC service. Wife Kim Gassett also works there.'
WHERE name = 'Steve Gassett';

-- Update Abatam with detailed notes
UPDATE vendors SET
  notes = 'Pest control. Amanda new secretary. Gave new CC sky miles March 21, 2025 - was 5 visits behind. $195 each property for walk treatment/prevention. $195 carpenter ants. April 1 for each property.'
WHERE name LIKE '%Abatam%' OR name LIKE '%Abetam%';

-- Update Tim Bow with detailed notes
UPDATE vendors SET
  notes = 'Kohler specialist only. Jan 21, 2025: Waiting forever for upstairs toilet to get fixed. Controller out on Michael''s. Needs 3rd part - brass check valve. Located 2 hours drive away.'
WHERE name = 'Tim Bow';

-- Update Consolidated Communications
UPDATE vendors SET
  notes = 'Landline phone service. Autopay.'
WHERE name = 'Consolidated Communications';

-- ============================================================================
-- NYC VENDORS - Updates and new entries
-- ============================================================================

-- Update Con Ed with account numbers
UPDATE vendors SET
  notes = 'Electric utility for Brooklyn condos. Acct PH2F: 79321-21000-1. Acct PH2E: 36195-50000-8. Zip 11211.'
WHERE name = 'Con Ed';

-- Update FlueTech with bank info
UPDATE vendors SET
  notes = 'Fireplace service. Owner is Jay. Text: 201-905-3085. Other emails: kristen@, andrea@, stephanie@fluetechinc.com. Through Kat at Staghorn. Bank: TD Bank, Account: 4362512092, Routing: 031201360.'
WHERE name = 'Matt' AND company = 'FlueTech';

-- Update Public Parking with car assignments
UPDATE vendors SET
  notes = 'Parking garage. 50 N 5th St/40 North 4th Street. Spot #43: 006-00153 (Black Equinox). Spot #40: 006-00018 (Black Explorer). Autopay.'
WHERE name = 'Public Parking';

-- Update Eagle Guard locksmith with full contact
UPDATE vendors SET
  phone = '212-860-2800',
  email = 'AlexG@EagleGuardSecurity.com',
  notes = 'Locksmith. Tel: (212) 260-2534. Mobile: (917) 939-2409.'
WHERE name = 'Alex' AND company LIKE '%Eagle Guard%';

-- Update Toto with sync instructions
UPDATE vendors SET
  notes = 'Toto toilets. Contact: Nicholas Richard nrichard@toto.com. To reset/sync remote: 1. Hold flush button (upper right of seat). 2. Keep holding until 2nd beep. 3. After lights start moving, press stop button on remote 5 times. 4. Wait for final beep - remote should be synced.'
WHERE name = 'John' AND company = 'Toto';

-- Update Major Air with BuildingLink note
UPDATE vendors SET
  notes = 'HVAC service for Brooklyn condos. Access through BuildingLink. Pricing: 1 unit $14.52/mo, 2 units $29.04/mo. Unit replacement quotes: $78,048-$84,975'
WHERE name = 'Major Air' AND specialty = 'hvac' AND notes NOT LIKE '%Cody%';

-- ============================================================================
-- RHODE ISLAND VENDORS - Updates and new entries
-- ============================================================================

-- Update Ocean State Security with full details
UPDATE vendors SET
  notes = 'Alarm system. Acct: 04-035D. Autopay quarterly. Matt Pepin: matt@osess.com. Central station: 401-781-8330. Someone''s mobile: 401-781-2854. Cragin: 401-741-2128.'
WHERE name = 'Richard Cragin';

-- Update Parker Construction with full details
UPDATE vendors SET
  notes = 'General contractor. Justin Dalton: jdalton@parkercci.com, +1 (774) 526-4417. 24 Hour Emergency Line: 401-427-7911.'
WHERE name = 'Brady Parker';

-- Update Rhode Island Energy with account details
UPDATE vendors SET
  notes = 'Electric and gas utility. Formerly National Grid. Electric (Anne): 63044-04006. Gas (Michael): 76107-04005. Autopay out of 0346. Login: Email R!!!'
WHERE name = 'Rhode Island Energy';

-- Update Driscoll Elevator with full details
UPDATE vendors SET
  notes = 'Elevator maintenance. $156/mo service contract includes semi-annual testing. Started March 7, 2025. Model: Elevette #97193. Paid $1,872.00 upfront for 1 year.'
WHERE name = 'Driscoll Elevator Services';

-- Update Tom Bennet/City & Estate Gardener
UPDATE vendors SET
  notes = 'Landscaper. 280 Irving Ave. Through Parker.'
WHERE name = 'Tom Bennet' OR (company LIKE '%City%Estate%' AND specialty = 'landscaping');

-- Update Griggs & Browne with account
UPDATE vendors SET
  notes = 'Pest control. Acct: 100248339. Autopay quarterly $105.'
WHERE name LIKE '%Griggs%';

-- Update Narragansett Bay Commission with account
UPDATE vendors SET
  notes = 'Water utility. Acct: 0154108-051640. Autopay out of 0346.'
WHERE name = 'Narragansett Bay Commission';

-- Update Jennifer Tammel
UPDATE vendors SET
  notes = 'Deep cleaner. Recommended by Brady Parker.'
WHERE name = 'Jennifer Tammel';

-- ============================================================================
-- MARTINIQUE VENDORS - Updates and new entries
-- ============================================================================

-- Update EDF with full account/login info
UPDATE vendors SET
  notes = 'Electric utility for Martinique. Contrat: 359252. Compte: 393594. Payment ref: 26200000256990 / 262 0 0000393594 0012757348. Address: Apt E11 ETG 1, ENT ESC E, 29 RUE DES ANTHURIUMS, LES TERRASSES DE LA PLAGE, 97229 LES TROIS ILETS. Login: spalter.m@yahoo.com / TI97229MSs'
WHERE name = 'EDF';

-- Update Orange internet with full details
UPDATE vendors SET
  notes = 'Internet for Martinique. Client: 004 754 5936. Internet: 759674189. Ligne livebox: 05 96 38 21 60. Login: spalter.michael@orange.fr / CB308QCc@972'
WHERE name = 'Orange';

-- Update Pauline Delbende
UPDATE vendors SET
  specialty = 'architect',
  notes = 'Designer for Martinique and Paris.'
WHERE name = 'Pauline Delbende';

-- Update Philippe Gotin
UPDATE vendors SET
  notes = 'Handyman. Concierge at next door hotel in Martinique.'
WHERE name = 'Philippe Gotin';

-- Update Mme Islourde Griffit with WhatsApp note
UPDATE vendors SET
  notes = 'Housecleaner for Martinique. Femme de menage. Contact via WhatsApp. Alt phone: +1 0 696 180-083'
WHERE name LIKE '%Islourde%' OR name LIKE '%Griffit%';

-- Update SME water with full details
UPDATE vendors SET
  notes = 'Water utility for Martinique. Acct: 02-00194599. Login: spalter.m@yahoo.com / Risd1877. Client: Monsieur SPALTER Michael, Appartement 11 Batiment E, 29 RUE DES ANTHURIUMS RES LES TERRASSES DE LA PLAGE ANSE MITAN, 97229 LES TROIS ILETS, France. Email: mspalter@risd.edu'
WHERE name = 'SME';

-- ============================================================================
-- NEW VENDORS TO INSERT
-- ============================================================================

-- Vermont: Gracie housecleaner (if not exists)
INSERT INTO vendors (name, specialty, phone, notes)
SELECT 'Gracie', 'cleaning', '802-451-8362', 'Housecleaner for Vermont properties.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Gracie' AND specialty = 'cleaning');

-- Vermont: Clarence shoveling
INSERT INTO vendors (name, specialty, phone, notes)
SELECT 'Clarence', 'snow_removal', '413-478-8949', 'Shoveling service for Vermont.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Clarence');

-- Vermont: Conner Hamilton shoveling
INSERT INTO vendors (name, specialty, phone, notes)
SELECT 'Conner Hamilton', 'snow_removal', '802-258-8890', 'Shoveling service for Vermont.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Conner Hamilton');

-- NYC: Nieves housecleaner
INSERT INTO vendors (name, specialty, phone, notes)
SELECT 'Nieves', 'cleaning', '718-419-8979', 'Housecleaner for Brooklyn condos.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Nieves');

-- RI: Lilian housecleaner
INSERT INTO vendors (name, specialty, phone, notes)
SELECT 'Lilian', 'cleaning', '401-864-6203', 'Housecleaner for Rhode Island house.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Lilian');

-- RI: Brian fish pond
INSERT INTO vendors (name, company, specialty, notes)
SELECT 'Brian', 'Tranquil Water Gardens 2', 'pool_spa', 'Fish pond maintenance for Rhode Island.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Brian' AND company LIKE '%Tranquil%');

-- Martinique: Mme Dupont housecleaner (Paris)
INSERT INTO vendors (name, specialty, notes)
SELECT 'Mme Dupont', 'cleaning', 'Housecleaner for Paris condo.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Mme Dupont');

-- San Jose: Joel Castro yard guy
INSERT INTO vendors (name, specialty, phone, notes)
SELECT 'Joel Castro', 'landscaping', '408-912-4942', 'Yard maintenance for San Jose / 125 Dana Avenue.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Joel Castro');

-- ============================================================================
-- HEALTH/DENTAL INSURANCE - Add as notes to existing or create
-- These aren't property vendors but useful reference data
-- ============================================================================

-- BCBS Health Insurance - add as vendor for reference
INSERT INTO vendors (name, company, specialty, phone, notes)
SELECT 'BCBS of RI', 'Blue Cross Blue Shield of Rhode Island', 'insurance', '401-495-5000',
       'Health Insurance: Vantage Blue 750/1500. Group: ZBO200664454 Group 1. Premium: $3,585.60/mo. Autopay out of 0346. Dental Insurance also through BCBS: $142.46/mo.'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'BCBS of RI');

COMMIT;
