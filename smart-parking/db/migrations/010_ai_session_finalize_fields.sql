-- Finalize ai.session fields by adding commonly used columns to existing DBs

-- Exit station reference (optional)
ALTER TABLE IF EXISTS ai.session
  ADD COLUMN IF NOT EXISTS exit_station INTEGER NULL REFERENCES ai.station(id) ON DELETE SET NULL;

-- Paid until timestamp (optional, set when fully paid)
ALTER TABLE IF EXISTS ai.session
  ADD COLUMN IF NOT EXISTS paid_until TIMESTAMP NULL;

-- Licence plate snapshots (entry/exit)
ALTER TABLE IF EXISTS ai.session
  ADD COLUMN IF NOT EXISTS licence_plate_entry TEXT NULL,
  ADD COLUMN IF NOT EXISTS licence_plate_exit TEXT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS ix_ai_session_status ON ai.session(status);
CREATE INDEX IF NOT EXISTS ix_ai_session_ticket ON ai.session(ticket_id);

