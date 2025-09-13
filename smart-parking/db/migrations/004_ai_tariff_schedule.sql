-- Add schedule selector for tariffs: weekday/weekend/always/custom

ALTER TABLE IF EXISTS ai.tariff
  ADD COLUMN IF NOT EXISTS applies_on TEXT NOT NULL DEFAULT 'always';

-- Constrain values
ALTER TABLE IF EXISTS ai.tariff
  ADD CONSTRAINT IF NOT EXISTS chk_ai_tariff_applies_on
    CHECK (applies_on IN ('always','weekday','weekend','custom'));

-- Helpful index for lookups
CREATE INDEX IF NOT EXISTS ix_ai_tariff_applies_on
  ON ai.tariff (applies_on);

-- Seed weekday/weekend tariffs if missing by cloning the first available row
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ai.tariff WHERE applies_on = 'weekday') THEN
    INSERT INTO ai.tariff (name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on)
    SELECT COALESCE((SELECT name FROM ai.tariff ORDER BY id LIMIT 1), 'Weekday Tariff') || ' (Weekday)',
           COALESCE((SELECT free_minutes FROM ai.tariff ORDER BY id LIMIT 1), 0),
           COALESCE((SELECT rate_cents_per_hour FROM ai.tariff ORDER BY id LIMIT 1), 1000),
           (SELECT max_daily_cents FROM ai.tariff ORDER BY id LIMIT 1),
           'weekday';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ai.tariff WHERE applies_on = 'weekend') THEN
    INSERT INTO ai.tariff (name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on)
    SELECT COALESCE((SELECT name FROM ai.tariff ORDER BY id LIMIT 1), 'Weekend Tariff') || ' (Weekend)',
           COALESCE((SELECT free_minutes FROM ai.tariff ORDER BY id LIMIT 1), 0),
           COALESCE((SELECT rate_cents_per_hour FROM ai.tariff ORDER BY id LIMIT 1), 1000),
           (SELECT max_daily_cents FROM ai.tariff ORDER BY id LIMIT 1),
           'weekend';
  END IF;
END $$;

