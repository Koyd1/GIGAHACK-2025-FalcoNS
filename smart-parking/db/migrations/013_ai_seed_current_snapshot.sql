-- Seed AI schema with the current SQLite snapshot via staging schema
-- This migration recreates staging_sqlite.*, loads the snapshot, then imports into ai.*

-- 1) Prepare staging schema and load SQLite-equivalent tables/data
DROP SCHEMA IF EXISTS staging_sqlite CASCADE;
CREATE SCHEMA staging_sqlite;
SET search_path TO staging_sqlite;

-- Tables (Postgres types; no FKs to keep staging simple)
CREATE TABLE ticket (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMP NOT NULL,
  entry_station INTEGER,
  status TEXT NOT NULL
);

CREATE TABLE event (
  id INTEGER PRIMARY KEY,
  session_id INTEGER,
  station_id INTEGER,
  type TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  payload_json TEXT
);

CREATE TABLE tariff (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  free_minutes INTEGER NOT NULL DEFAULT 0,
  rate_cents_per_hour INTEGER NOT NULL,
  max_daily_cents INTEGER
);

CREATE TABLE discount_rule (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  valid_from TIMESTAMP,
  valid_to TIMESTAMP
);

CREATE TABLE voucher (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  balance_cents INTEGER NOT NULL,
  expires_at TIMESTAMP
);

CREATE TABLE payment_discount (
  payment_id INTEGER NOT NULL,
  discount_id INTEGER NOT NULL,
  PRIMARY KEY (payment_id, discount_id)
);

CREATE TABLE payment_voucher (
  payment_id INTEGER NOT NULL,
  voucher_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  PRIMARY KEY (payment_id, voucher_id)
);

CREATE TABLE "session" (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER,
  entry_time TIMESTAMP NOT NULL,
  entry_station INTEGER,
  exit_time TIMESTAMP,
  exit_station INTEGER,
  status TEXT NOT NULL,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  paid_until TIMESTAMP,
  licence_plate_entry TEXT,
  licence_plate_exit TEXT
);

CREATE TABLE payment (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  station_id INTEGER,
  "method" TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  approved INTEGER NOT NULL,
  processor_ref TEXT,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE station (
  id INTEGER PRIMARY KEY,
  zone_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL
);

-- Data (from parking_sqlite.sql)
INSERT INTO ticket VALUES(1,'TCK-001','2025-09-12 08:00:00',1,'ACTIVE');
INSERT INTO ticket VALUES(2,'TCK-002','2025-09-12 09:30:00',1,'ACTIVE');
INSERT INTO ticket VALUES(3,'TCK-003','2025-09-12 10:00:00',1,'ACTIVE');
INSERT INTO ticket VALUES(4,'TCK-004','2025-09-12 10:45:00',1,'LOST');
INSERT INTO ticket VALUES(5,'TCK-005','2025-09-12 08:00:00',1,'ACTIVE');

INSERT INTO event VALUES(1,1,1,'ENTRY','2025-09-12 08:00:00','{"ticket_code":"TCK-001","plate":"ABC123"}');
INSERT INTO event VALUES(2,1,3,'PAYMENT_STARTED','2025-09-12 09:45:00','{"amount_cents":1000,"method":"card"}');
INSERT INTO event VALUES(3,1,3,'PAYMENT_OK','2025-09-12 09:45:10','{"amount_cents":1000,"processor_ref":"TXN-0001"}');
INSERT INTO event VALUES(4,1,2,'BARRIER_RAISE','2025-09-12 10:00:00','{"trigger":"session_paid"}');
INSERT INTO event VALUES(5,1,2,'EXIT','2025-09-12 10:00:10','{}');
INSERT INTO event VALUES(6,2,1,'ENTRY','2025-09-12 09:30:00','{"ticket_code":"TCK-002","plate":"XYZ999"}');
INSERT INTO event VALUES(7,2,3,'PAYMENT_STARTED','2025-09-12 10:50:00','{"amount_cents":1350,"method":"split"}');
INSERT INTO event VALUES(8,2,3,'DISCOUNT_APPLIED','2025-09-12 10:50:01','{"code":"WEEKEND10","kind":"PERCENT","value":10}');
INSERT INTO event VALUES(9,2,3,'PAYMENT_OK','2025-09-12 10:50:02','{"amount_cents":850,"method":"card","processor_ref":"TXN-0002"}');
INSERT INTO event VALUES(10,2,3,'INFO','2025-09-12 10:50:03','{"voucher_code":"EVENTPASS123","redeemed_cents":500}');
INSERT INTO event VALUES(11,2,2,'BARRIER_RAISE','2025-09-12 11:00:00','{"trigger":"session_paid"}');
INSERT INTO event VALUES(12,2,2,'EXIT','2025-09-12 11:00:05','{}');
INSERT INTO event VALUES(13,3,1,'ENTRY','2025-09-12 10:00:00','{"ticket_code":"TCK-003","plate":"DEF777"}');
INSERT INTO event VALUES(14,3,3,'PAYMENT_FAILED','2025-09-12 11:05:00','{"amount_cents":500,"processor_ref":"TXN-0003"}');
INSERT INTO event VALUES(15,3,2,'INFO','2025-09-12 11:10:00','{"note":"payment_not_registered_at_exit_camera"}');
INSERT INTO event VALUES(16,3,2,'BARRIER_RAISE','2025-09-12 11:10:10','{"trigger":"operator_triggered"}');
INSERT INTO event VALUES(17,3,2,'EXIT','2025-09-12 11:10:12','{"note":"exit_without_payment"}');
INSERT INTO event VALUES(18,4,1,'ENTRY','2025-09-12 10:45:00','{"ticket_code":"TCK-004","plate":"A8C123"}');
INSERT INTO event VALUES(19,4,1,'INFO','2025-09-12 10:55:00','{"status":"ticket_lost"}');
INSERT INTO event VALUES(20,5,1,'ENTRY','2025-09-12 08:00:00','{"ticket_code":"TCK-005","plate":"B8C123"}');
INSERT INTO event VALUES(21,5,3,'PAYMENT_STARTED','2025-09-12 09:45:00','{"amount_cents":300,"method":"card"}');
INSERT INTO event VALUES(22,5,3,'PAYMENT_OK','2025-09-12 09:45:10','{"amount_cents":300,"processor_ref":"TXN-0001"}');
INSERT INTO event VALUES(23,NULL,2,'INFO','2025-09-12 10:00:00','{"note":"plate_is_not_recognized", "plate":"BBC123"}');

INSERT INTO tariff VALUES(1,'Standard',15,500,6000);
INSERT INTO tariff VALUES(2,'Weekend',30,300,4000);

INSERT INTO discount_rule VALUES(1,'WEEKEND10','PERCENT',10,'2025-09-12 00:00:00','2025-09-15 00:00:00');
INSERT INTO discount_rule VALUES(2,'LOYALTY500','FIXED',500,NULL,NULL);

INSERT INTO voucher VALUES(1,'GIFT-50MDL',5000,NULL);
INSERT INTO voucher VALUES(2,'EVENTPASS123',2000,'2025-12-31 23:59:59');

INSERT INTO payment_discount VALUES(2,1);

INSERT INTO payment_voucher VALUES(2,2,500);

INSERT INTO "session" VALUES(1,1,'2025-09-12 08:00:00',1,'2025-09-12 10:00:00',2,'PAID',1000,1000,'2025-09-12 10:15:00','ABC123','ABC123');
INSERT INTO "session" VALUES(2,2,'2025-09-12 09:30:00',1,'2025-09-12 11:00:00',2,'PAID',1350,1350,'2025-09-12 11:15:00','XYZ999','XYZ999');
INSERT INTO "session" VALUES(3,3,'2025-09-12 10:00:00',1,'2025-09-12 11:10:00',2,'EXITED',500,500,'2025-09-12 11:20:00','DEF777','DEF777');
INSERT INTO "session" VALUES(4,4,'2025-09-12 10:45:00',1,NULL,NULL,'OPEN',0,0,NULL,'A8C123',NULL);
INSERT INTO "session" VALUES(5,5,'2025-09-12 10:48:00',1,NULL,NULL,'ACTIVE',300,300,NULL,'B8C123','BBC123');

INSERT INTO payment VALUES(1,1,3,'card',1000,1,'TXN-0001','2025-09-12 09:45:10');
INSERT INTO payment VALUES(2,2,3,'card',850,1,'TXN-0002','2025-09-12 10:50:02');
INSERT INTO payment VALUES(3,3,3,'card',500,1,'TXN-0003','2025-09-12 11:05:00');

INSERT INTO station VALUES(1,1,'entry_terminal','Entry Lane A');
INSERT INTO station VALUES(2,1,'exit_terminal','Exit Lane A');
INSERT INTO station VALUES(3,1,'pof','POF-01');

CREATE INDEX idx_event_session_time ON event(session_id, occurred_at);

-- 2) Import into ai.* schema

-- Ensure base AI entities
BEGIN;
INSERT INTO ai.parking (name) VALUES ('Main') ON CONFLICT DO NOTHING;

-- Zones from staging station.zone_id
WITH p AS (
  SELECT id FROM ai.parking WHERE name='Main' LIMIT 1
), zsrc AS (
  SELECT DISTINCT zone_id FROM staging_sqlite.station WHERE zone_id IS NOT NULL
)
INSERT INTO ai.zone (parking_id, name)
SELECT (SELECT id FROM p), 'Z' || zone_id::text
FROM zsrc
WHERE NOT EXISTS (
  SELECT 1 FROM ai.zone z
  WHERE z.parking_id = (SELECT id FROM p)
    AND z.name = 'Z' || zone_id::text
);

-- Stations from staging
WITH p AS (
  SELECT id FROM ai.parking WHERE name='Main' LIMIT 1
)
INSERT INTO ai.station (id, parking_id, name)
SELECT s.id, (SELECT id FROM p), s.label
FROM staging_sqlite.station s
ON CONFLICT (id) DO NOTHING;

-- Tariffs
INSERT INTO ai.tariff (name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on)
SELECT t.name,
       COALESCE(t.free_minutes, 0),
       COALESCE(t.rate_cents_per_hour, 0),
       t.max_daily_cents,
       CASE
         WHEN LOWER(t.name) LIKE '%weekend%' THEN 'weekend'
         WHEN LOWER(t.name) LIKE '%weekday%' THEN 'weekday'
         ELSE 'always'
       END AS applies_on
FROM staging_sqlite.tariff t
ON CONFLICT DO NOTHING;

-- Tickets
INSERT INTO ai.ticket (id, code, issued_at, entry_station, status)
SELECT id, code, issued_at, entry_station, LOWER(status)
FROM staging_sqlite.ticket
ON CONFLICT (id) DO NOTHING;

-- Vehicles
INSERT INTO ai.vehicle (plate)
SELECT DISTINCT UPPER(s.licence_plate_entry)
FROM staging_sqlite."session" s
WHERE s.licence_plate_entry IS NOT NULL AND s.licence_plate_entry <> ''
ON CONFLICT (plate) DO NOTHING;

-- Sessions
WITH p AS (
  SELECT id FROM ai.parking WHERE name='Main' LIMIT 1
)
INSERT INTO ai.session (
  id, parking_id, zone_id, vehicle_id, ticket_id,
  entry_time, exit_time, entry_station, exit_station, status,
  amount_due_cents, amount_paid_cents, paid_until,
  licence_plate_entry, licence_plate_exit
)
SELECT s.id,
       (SELECT id FROM p) AS parking_id,
       z.id AS zone_id,
       v.id AS vehicle_id,
       s.ticket_id,
       s.entry_time,
       s.exit_time,
       s.entry_station,
       s.exit_station,
       CASE UPPER(s.status)
         WHEN 'OPEN' THEN 'active'
         WHEN 'ACTIVE' THEN 'active'
         WHEN 'PAID' THEN 'paid'
         ELSE 'closed'
       END AS status,
       s.amount_due_cents,
       s.amount_paid_cents,
       s.paid_until,
       UPPER(s.licence_plate_entry),
       UPPER(s.licence_plate_exit)
FROM staging_sqlite."session" s
LEFT JOIN staging_sqlite.station st ON st.id = s.entry_station
LEFT JOIN ai.zone z ON z.name = 'Z' || COALESCE(st.zone_id::text, '1')
LEFT JOIN ai.vehicle v ON v.plate = UPPER(s.licence_plate_entry)
ON CONFLICT (id) DO NOTHING;

-- Events
INSERT INTO ai.event (id, session_id, station_id, type, occurred_at, payload_json)
SELECT e.id, e.session_id, e.station_id, LOWER(e.type), e.occurred_at,
       CASE WHEN e.payload_json IS NOT NULL AND e.payload_json <> ''
            THEN e.payload_json::jsonb ELSE NULL END
FROM staging_sqlite.event e
WHERE e.session_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Payments
INSERT INTO ai.payment (id, session_id, station_id, method, amount_cents, approved, processor_ref, created_at)
SELECT p.id, p.session_id, p.station_id, LOWER(p."method"), p.amount_cents, (p.approved <> 0), p.processor_ref, p.created_at
FROM staging_sqlite.payment p
ON CONFLICT (id) DO NOTHING;

-- Discounts and vouchers
INSERT INTO ai.discount_rule (id, code, kind, value, valid_from, valid_to)
SELECT d.id, d.code, LOWER(d.kind), d.value, d.valid_from, d.valid_to
FROM staging_sqlite.discount_rule d
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai.voucher (id, code, balance_cents, expires_at)
SELECT v.id, v.code, v.balance_cents, v.expires_at
FROM staging_sqlite.voucher v
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Reset sequences
SELECT setval(pg_get_serial_sequence('ai.parking','id'), COALESCE((SELECT MAX(id) FROM ai.parking), 1), true);
SELECT setval(pg_get_serial_sequence('ai.zone','id'), COALESCE((SELECT MAX(id) FROM ai.zone), 1), true);
SELECT setval(pg_get_serial_sequence('ai.station','id'), COALESCE((SELECT MAX(id) FROM ai.station), 1), true);
SELECT setval(pg_get_serial_sequence('ai.vehicle','id'), COALESCE((SELECT MAX(id) FROM ai.vehicle), 1), true);
SELECT setval(pg_get_serial_sequence('ai.ticket','id'), COALESCE((SELECT MAX(id) FROM ai.ticket), 1), true);
SELECT setval(pg_get_serial_sequence('ai.session','id'), COALESCE((SELECT MAX(id) FROM ai.session), 1), true);
SELECT setval(pg_get_serial_sequence('ai.event','id'), COALESCE((SELECT MAX(id) FROM ai.event), 1), true);
SELECT setval(pg_get_serial_sequence('ai.tariff','id'), COALESCE((SELECT MAX(id) FROM ai.tariff), 1), true);
SELECT setval(pg_get_serial_sequence('ai.discount_rule','id'), COALESCE((SELECT MAX(id) FROM ai.discount_rule), 1), true);
SELECT setval(pg_get_serial_sequence('ai.voucher','id'), COALESCE((SELECT MAX(id) FROM ai.voucher), 1), true);
SELECT setval(pg_get_serial_sequence('ai.payment','id'), COALESCE((SELECT MAX(id) FROM ai.payment), 1), true);
