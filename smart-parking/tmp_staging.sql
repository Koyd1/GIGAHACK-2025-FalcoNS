CREATE TABLE ticket (
  id            INTEGER PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  issued_at     TIMESTAMP NOT NULL,
  entry_station INTEGER,
  status        TEXT NOT NULL DEFAULT 'ACTIVE'  -- ACTIVE | PAID | LOST | CLOSED
);
INSERT INTO ticket VALUES(1,'TCK-001','2025-09-12 08:00:00',1,'ACTIVE');
INSERT INTO ticket VALUES(2,'TCK-002','2025-09-12 09:30:00',1,'ACTIVE');
INSERT INTO ticket VALUES(3,'TCK-003','2025-09-12 10:00:00',1,'ACTIVE');
INSERT INTO ticket VALUES(4,'TCK-004','2025-09-12 10:45:00',1,'LOST');
INSERT INTO ticket VALUES(5,'TCK-005','2025-09-12 08:00:00',1,'ACTIVE');
CREATE TABLE event (
  id            INTEGER PRIMARY KEY,
  session_id    INTEGER,
  station_id    INTEGER,
  type          TEXT NOT NULL CHECK (type IN (
                  'ENTRY','PAYMENT_STARTED','PAYMENT_OK','PAYMENT_FAILED',
                  'DISCOUNT_APPLIED','EXIT','BARRIER_RAISE','BARRIER_LOWER','INFO'
                 )),
  occurred_at   TIMESTAMP NOT NULL,
  payload_json  TEXT            -- free-form: plate read, reason, amounts, acquirer msg, etc.
);
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
CREATE TABLE tariff (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  free_minutes  INTEGER NOT NULL DEFAULT 0,
  rate_cents_per_hour INTEGER NOT NULL,
  max_daily_cents     INTEGER
);
INSERT INTO tariff VALUES(1,'Standard',15,500,6000);
INSERT INTO tariff VALUES(2,'Weekend',30,300,4000);
CREATE TABLE discount_rule (
  id            INTEGER PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,         -- QR / promo / merchant code
  kind          TEXT NOT NULL CHECK (kind IN ('PERCENT','FIXED')),
  value         INTEGER NOT NULL,             -- percent or cents
  valid_from    TIMESTAMP,
  valid_to      TIMESTAMP
);
INSERT INTO discount_rule VALUES(1,'WEEKEND10','PERCENT',10,'2025-09-12 00:00:00','2025-09-15 00:00:00');
INSERT INTO discount_rule VALUES(2,'LOYALTY500','FIXED',500,NULL,NULL);
CREATE TABLE voucher (
  id            INTEGER PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  balance_cents INTEGER NOT NULL,
  expires_at    TIMESTAMP
);
INSERT INTO voucher VALUES(1,'GIFT-50MDL',5000,NULL);
INSERT INTO voucher VALUES(2,'EVENTPASS123',2000,'2025-12-31 23:59:59');
CREATE TABLE payment_discount (
  payment_id       INTEGER NOT NULL,
  discount_id      INTEGER NOT NULL,
  PRIMARY KEY (payment_id, discount_id)
);
INSERT INTO payment_discount VALUES(2,1);
CREATE TABLE payment_voucher (
  payment_id       INTEGER NOT NULL,
  voucher_id       INTEGER NOT NULL,
  amount_cents     INTEGER NOT NULL,
  PRIMARY KEY (payment_id, voucher_id)
);
INSERT INTO payment_voucher VALUES(2,2,500);
CREATE TABLE IF NOT EXISTS "session" (
	id INTEGER,
	ticket_id INTEGER,
	entry_time TIMESTAMP NOT NULL,
	entry_station INTEGER,
	exit_time TIMESTAMP,
	exit_station INTEGER,
	status TEXT DEFAULT ('OPEN') NOT NULL,
	amount_due_cents INTEGER DEFAULT (0) NOT NULL,
	amount_paid_cents INTEGER DEFAULT (0) NOT NULL,
	paid_until TIMESTAMP,
	licence_plate_entry TEXT,
	licence_plate_exit TEXT,
	CONSTRAINT SESSION_PK PRIMARY KEY (id),
);
INSERT INTO session VALUES(1,1,'2025-09-12 08:00:00',1,'2025-09-12 10:00:00',2,'PAID',1000,1000,'2025-09-12 10:15:00','ABC123','ABC123');
INSERT INTO session VALUES(2,2,'2025-09-12 09:30:00',1,'2025-09-12 11:00:00',2,'PAID',1350,1350,'2025-09-12 11:15:00','XYZ999','XYZ999');
INSERT INTO session VALUES(3,3,'2025-09-12 10:00:00',1,'2025-09-12 11:10:00',2,'EXITED',500,500,'2025-09-12 11:20:00','DEF777','DEF777');
INSERT INTO session VALUES(4,4,'2025-09-12 10:45:00',1,NULL,NULL,'OPEN',0,0,NULL,'A8C123',NULL);
INSERT INTO session VALUES(5,5,'2025-09-12 10:48:00',1,NULL,NULL,'ACTIVE',300,300,NULL,'B8C123','BBC123');
CREATE TABLE payment (
	id INTEGER,
	session_id INTEGER NOT NULL,
	station_id INTEGER,
	"method" TEXT NOT NULL,
	amount_cents INTEGER NOT NULL,
	approved INTEGER NOT NULL,
	processor_ref TEXT,
	created_at TIMESTAMP NOT NULL,
	CONSTRAINT PAYMENT_PK PRIMARY KEY (id),
);
INSERT INTO payment VALUES(1,1,3,'card',1000,1,'TXN-0001','2025-09-12 09:45:10');
INSERT INTO payment VALUES(2,2,3,'card',850,1,'TXN-0002','2025-09-12 10:50:02');
INSERT INTO payment VALUES(3,3,3,'card',500,1,'TXN-0003','2025-09-12 11:05:00');
CREATE TABLE station (
	id INTEGER,
	zone_id INTEGER NOT NULL,
	kind TEXT NOT NULL,
	label TEXT NOT NULL,
	CONSTRAINT STATION_PK PRIMARY KEY (id)
);
INSERT INTO station VALUES(1,1,'entry_terminal','Entry Lane A');
INSERT INTO station VALUES(2,1,'exit_terminal','Exit Lane A');
INSERT INTO station VALUES(3,1,'pof','POF-01');
CREATE INDEX idx_event_session_time ON event(session_id, occurred_at);
