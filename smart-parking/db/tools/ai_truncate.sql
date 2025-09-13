-- Truncate AI schema data before re-import
BEGIN;
TRUNCATE TABLE
  ai.payment,
  ai.event,
  ai.session,
  ai.ticket,
  ai.vehicle,
  ai.station,
  ai.zone,
  ai.parking,
  ai.discount_rule,
  ai.voucher,
  ai.tariff
RESTART IDENTITY CASCADE;
COMMIT;

