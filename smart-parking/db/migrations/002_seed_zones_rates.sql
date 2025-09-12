-- Seed demo data: parking, zones, rates, ai basics

-- Zones A/B/C
INSERT INTO zones (name) VALUES ('A') ON CONFLICT DO NOTHING;
INSERT INTO zones (name) VALUES ('B') ON CONFLICT DO NOTHING;
INSERT INTO zones (name) VALUES ('C') ON CONFLICT DO NOTHING;

-- Base rates (MDL)
INSERT INTO rates (zone_id, price_per_hour, currency)
SELECT id, CASE name WHEN 'A' THEN 20 WHEN 'B' THEN 15 ELSE 10 END, 'MDL'
FROM zones z
ON CONFLICT (zone_id, currency) DO UPDATE SET price_per_hour = EXCLUDED.price_per_hour;

-- AI seed
INSERT INTO ai.parking (name) VALUES ('Main') ON CONFLICT DO NOTHING;
-- Ensure one tariff row
INSERT INTO ai.tariff (free_minutes, rate_cents_per_hour, max_daily_cents)
SELECT 15, 1000, 5000 WHERE NOT EXISTS (SELECT 1 FROM ai.tariff);

-- AI zones mapped to public zones
DO $$
DECLARE p INTEGER;
BEGIN
  SELECT id INTO p FROM ai.parking WHERE name='Main' LIMIT 1;
  IF p IS NOT NULL THEN
    INSERT INTO ai.zone (parking_id, name)
    SELECT p, name FROM zones z
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

