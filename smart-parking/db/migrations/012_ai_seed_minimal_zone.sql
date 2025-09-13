-- Ensure minimal AI entities exist so client can open sessions

-- Parking 'Main'
INSERT INTO ai.parking (name)
SELECT 'Main'
WHERE NOT EXISTS (SELECT 1 FROM ai.parking WHERE name = 'Main');

-- One default zone if none exist
DO $$
DECLARE p_id INT;
BEGIN
  SELECT id INTO p_id FROM ai.parking WHERE name='Main' ORDER BY id LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM ai.zone) AND p_id IS NOT NULL THEN
    INSERT INTO ai.zone (parking_id, name) VALUES (p_id, 'Z1');
  END IF;
END $$;

