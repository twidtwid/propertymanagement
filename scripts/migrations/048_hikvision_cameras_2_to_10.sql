-- Migration 048: Add HikVision Cameras 2-10 for Rhode Island House
-- Cameras 1 was added in migration 047 as a test
-- Now adding the remaining 9 cameras from the Hik-Connect app

-- Camera 2: Driveway
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '2', 'Driveway', 'Driveway Area', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 3: Kitchen Door
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '3', 'Kitchen Door', 'Kitchen Entrance', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 4: Patio
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '4', 'Patio', 'Back Patio', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 5: Driveway 2
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '5', 'Driveway 2', 'Driveway (Secondary)', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 6: Side of House
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '6', 'Side of House', 'Side Exterior', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 7: Water Treatment
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '7', 'Water Treatment', 'Water Treatment Area', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 8: Laundry Room
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '8', 'Laundry Room', 'Interior Laundry', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 9: Rear Gate
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '9', 'Rear Gate', 'Back Gate Entrance', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';

-- Camera 10: Side Alley
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT p.id, 'hikvision', '10', 'Side Alley', 'Side Alley Access', 'unknown'
FROM properties p WHERE p.name = 'Rhode Island House';
