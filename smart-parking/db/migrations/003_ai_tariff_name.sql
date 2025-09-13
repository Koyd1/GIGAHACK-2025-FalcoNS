-- Add human-readable name to ai.tariff and basic constraints

-- 1) Add column if missing
ALTER TABLE IF EXISTS ai.tariff
  ADD COLUMN IF NOT EXISTS name TEXT;

-- 2) Backfill a default name for existing rows (id-ordered deterministic naming)
WITH t AS (
  SELECT id,
         CASE WHEN id = (SELECT MIN(id) FROM ai.tariff)
              THEN 'Standard Tariff'
              ELSE 'Tariff #' || id::text
         END AS new_name
  FROM ai.tariff
)
UPDATE ai.tariff x
SET name = t.new_name
FROM t
WHERE x.id = t.id AND (x.name IS NULL OR x.name = '');

-- 3) Enforce NOT NULL once populated
ALTER TABLE IF EXISTS ai.tariff
  ALTER COLUMN name SET NOT NULL;

-- 4) Ensure uniqueness by case-insensitive name
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_tariff_name_ci
  ON ai.tariff (UPPER(name));

-- 5) Guardrails: non-negative integers
ALTER TABLE IF EXISTS ai.tariff
  ADD CONSTRAINT IF NOT EXISTS chk_ai_tariff_free_minutes_nonneg
    CHECK (free_minutes >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_ai_tariff_rate_nonneg
    CHECK (rate_cents_per_hour >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_ai_tariff_dailycap_nonneg
    CHECK (max_daily_cents IS NULL OR max_daily_cents >= 0);

