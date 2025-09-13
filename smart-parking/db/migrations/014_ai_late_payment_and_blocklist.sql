-- Add late payment tracking and block list
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS ai.block_list (
    id SERIAL PRIMARY KEY,
    vehicle_plate TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Ensure uniqueness to avoid duplicates
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_block_list_plate ON ai.block_list(UPPER(vehicle_plate));
EXCEPTION WHEN others THEN NULL; END $$;

-- Late payment deadline on session
ALTER TABLE IF EXISTS ai.session
  ADD COLUMN IF NOT EXISTS late_payment_due_at TIMESTAMP NULL;

