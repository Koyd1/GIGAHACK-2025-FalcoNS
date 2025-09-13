-- Basic schema for Smart Parking (public + minimal ai schema)

-- Public tables
CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rates (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  price_per_hour NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MDL',
  UNIQUE(zone_id, currency)
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  vehicle TEXT NOT NULL,
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'open',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP NULL,
  amount NUMERIC(10,2) NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MDL',
  status TEXT NOT NULL,
  provider_payment_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gates (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'closed',
  ticket_id INTEGER NULL REFERENCES tickets(id) ON DELETE SET NULL,
  opened_at TIMESTAMP NULL,
  last_passed_at TIMESTAMP NULL
);

-- Seed a default gate if missing
INSERT INTO gates (id, state)
VALUES ('gate-A', 'closed')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  ticket_id INTEGER NULL REFERENCES tickets(id) ON DELETE SET NULL,
  device_id TEXT NULL,
  zone_id INTEGER NULL REFERENCES zones(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Minimal AI schema to satisfy /ai/* endpoints
CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE IF NOT EXISTS ai.parking (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ai.zone (
  id SERIAL PRIMARY KEY,
  parking_id INTEGER NOT NULL REFERENCES ai.parking(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai.station (
  id SERIAL PRIMARY KEY,
  parking_id INTEGER NOT NULL REFERENCES ai.parking(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai.vehicle (
  id SERIAL PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ai.ticket (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP,
  entry_station INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS ai.session (
  id SERIAL PRIMARY KEY,
  parking_id INTEGER NOT NULL REFERENCES ai.parking(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES ai.zone(id) ON DELETE CASCADE,
  vehicle_id INTEGER NULL REFERENCES ai.vehicle(id) ON DELETE SET NULL,
  ticket_id INTEGER NULL REFERENCES ai.ticket(id) ON DELETE SET NULL,
  entry_time TIMESTAMP NULL,
  exit_time TIMESTAMP NULL,
  entry_station INTEGER NULL,
  exit_station INTEGER NULL REFERENCES ai.station(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  amount_due_cents INTEGER NULL,
  amount_paid_cents INTEGER NULL,
  paid_until TIMESTAMP NULL,
  licence_plate_entry TEXT NULL,
  licence_plate_exit TEXT NULL
);

CREATE TABLE IF NOT EXISTS ai.event (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai.session(id) ON DELETE CASCADE,
  station_id INTEGER NULL,
  type TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  payload_json JSONB
);

CREATE TABLE IF NOT EXISTS ai.tariff (
  id SERIAL PRIMARY KEY,
  free_minutes INTEGER NOT NULL DEFAULT 0,
  rate_cents_per_hour INTEGER NOT NULL DEFAULT 100,
  max_daily_cents INTEGER NULL
);

CREATE TABLE IF NOT EXISTS ai.discount_rule (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  valid_from TIMESTAMP NULL,
  valid_to TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS ai.voucher (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS ai.payment (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai.session(id) ON DELETE CASCADE,
  station_id INTEGER NULL,
  method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  approved BOOLEAN NOT NULL,
  processor_ref TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
