-- Import from staging_sqlite.* (loaded from parking_sqlite.sql) into ai.* tables
-- Assumes migrations have been applied (ai.* exists).

BEGIN;

-- Ensure base AI entities
INSERT INTO ai.parking (name) VALUES ('Main') ON CONFLICT DO NOTHING;

-- Zones: create from distinct station.zone_id in staging
WITH p AS (
  SELECT id FROM ai.parking WHERE name='Main' LIMIT 1
), zsrc AS (
  SELECT DISTINCT zone_id FROM staging_sqlite.station WHERE zone_id IS NOT NULL
)
INSERT INTO ai.zone (parking_id, name)
SELECT (SELECT id FROM p), 'Z' || zone_id::text
FROM zsrc
ON CONFLICT DO NOTHING;

-- Tariffs: map names to applies_on heuristically
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

-- Vehicles from session plates
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

-- Reset sequences to avoid PK conflicts on inserts
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
