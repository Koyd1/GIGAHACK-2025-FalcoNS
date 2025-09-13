-- Ensure ai.tariff has modern columns and seed defaults if needed (for existing DBs)

-- Add columns if missing
ALTER TABLE IF EXISTS ai.tariff
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS applies_on TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN;

-- Defaults and constraints
DO $$
BEGIN
  -- backfill name
  UPDATE ai.tariff SET name = COALESCE(NULLIF(name, ''), 'Tariff #' || id::text);
  -- set NOT NULL and default values
  ALTER TABLE ai.tariff ALTER COLUMN name SET NOT NULL;
  ALTER TABLE ai.tariff ALTER COLUMN applies_on SET DEFAULT 'always';
  UPDATE ai.tariff SET applies_on = COALESCE(applies_on, 'always');
  ALTER TABLE ai.tariff ALTER COLUMN applies_on SET NOT NULL;
  ALTER TABLE ai.tariff ALTER COLUMN active SET DEFAULT TRUE;
  UPDATE ai.tariff SET active = COALESCE(active, TRUE);
  ALTER TABLE ai.tariff ALTER COLUMN active SET NOT NULL;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Constrain applies_on values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ai_tariff_applies_on') THEN
    ALTER TABLE ai.tariff ADD CONSTRAINT chk_ai_tariff_applies_on CHECK (applies_on IN ('always','weekday','weekend','custom'));
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Indexes/uniques
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_tariff_name_ci ON ai.tariff (UPPER(name));
CREATE INDEX IF NOT EXISTS ix_ai_tariff_applies_on ON ai.tariff (applies_on);
CREATE INDEX IF NOT EXISTS ix_ai_tariff_active ON ai.tariff (active);

-- If there are no tariffs at all, seed a sensible default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ai.tariff) THEN
    INSERT INTO ai.tariff (name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on, active)
    VALUES ('Standard', 15, 1000, 5000, 'always', TRUE);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

