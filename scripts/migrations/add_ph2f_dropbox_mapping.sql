-- Add Dropbox folder mapping for Brooklyn Condo PH2F
-- PH2E and PH2F share the same physical building folder in Dropbox

-- Get the property ID for PH2F
DO $$
DECLARE
  ph2f_id UUID;
BEGIN
  -- Find PH2F property ID
  SELECT id INTO ph2f_id
  FROM properties
  WHERE name = 'Brooklyn Condo PH2F';

  -- Only insert if PH2F exists and doesn't already have a mapping
  IF ph2f_id IS NOT NULL THEN
    INSERT INTO dropbox_folder_mappings
      (dropbox_folder_path, entity_type, entity_id, entity_name, document_count)
    VALUES
      ('/34 N 7th St - Brooklyn', 'property', ph2f_id, 'Brooklyn Condo PH2F', 34)
    ON CONFLICT (dropbox_folder_path, entity_id) DO NOTHING;

    RAISE NOTICE 'Added Dropbox mapping for Brooklyn Condo PH2F';
  ELSE
    RAISE NOTICE 'Brooklyn Condo PH2F not found';
  END IF;
END $$;
