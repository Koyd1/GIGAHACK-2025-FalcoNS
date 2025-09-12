#!/usr/bin/env bash
set -euo pipefail

# Config
GATEWAY_URL=${GATEWAY_URL:-http://localhost:8080}
CENTRAL_URL=${CENTRAL_URL:-http://localhost:4000}
PAYMENT_URL=${PAYMENT_URL:-http://localhost:5002}
ASSIST_URL=${ASSIST_URL:-$GATEWAY_URL/api/assistant/message}
DB_CONTAINER=${DB_CONTAINER:-smart-parking-db-1}
DB_USER=${POSTGRES_USER:-parking}
DB_NAME=${POSTGRES_DB:-parking}

# Helpers
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GRN}✔${NC} $*"; }
fail() { echo -e "${RED}✘${NC} $*"; exit 1; }
step() { echo -e "${YLW}▶${NC} $*"; }

req_json() { curl -sS -H 'Content-Type: application/json' "$@"; }
req() { curl -sS "$@"; }

assert_contains() {
  local haystack="$1" needle="$2"; echo "$haystack" | grep -q "$needle" || fail "EXPECTED to contain: $needle\nGOT: $haystack"
}

assert_json_field() {
  local json="$1" jqpath="$2"; local val
  val=$(printf '%s' "$json" | jq -er "$jqpath") || fail "MISSING json path $jqpath in $json"
}

set_sandbox_success() {
  step "Set payment sandbox always_success";
  req_json -X POST "$PAYMENT_URL/__sandbox/config" -d '{"mode":"always_success","delayMs":50,"failureRate":0}' >/dev/null
}

test_health() {
  step "Health checks";
  assert_contains "$(req "$GATEWAY_URL/api/health")" '"ok":true'
  assert_contains "$(req "$CENTRAL_URL")" '"name":"central"'
}

test_fronts_up() {
  step "Frontends up";
  req http://localhost:5173 >/dev/null || fail "frontend-user not up"
  req http://localhost:5174 >/dev/null || fail "frontend-admin not up"
}

test_parking_flow() {
  step "Parking lifecycle"
  local zones tid close pay
  zones=$(req "$GATEWAY_URL/api/zones")
  assert_contains "$zones" '"name":"A"'
  tid=$(req_json -X POST "$GATEWAY_URL/api/tickets" -d '{"vehicle":"E2E123","zoneId":1}' | jq -er .id)
  [ -n "$tid" ] || fail "no ticket id"
  close=$(req_json -X POST "$GATEWAY_URL/api/tickets/$tid/close")
  assert_json_field "$close" .amount
  pay=$(req_json -X POST "$GATEWAY_URL/api/payments/$tid/pay")
  assert_contains "$pay" '"status":"success"'
  pass "parking flow ok (tid=$tid)"
}

test_rates_crud() {
  step "Admin rates CRUD"
  local add id upd del
  add=$(req_json -X POST "$GATEWAY_URL/api/admin/rates" -d '{"zoneId":3,"pricePerHour":77,"currency":"RUB"}')
  id=$(echo "$add" | jq -er .id)
  upd=$(req_json -X PUT "$GATEWAY_URL/api/admin/rates/$id" -d '{"pricePerHour":99}')
  assert_contains "$upd" '"price_per_hour":"99.00"'
  del=$(req_json -X DELETE "$GATEWAY_URL/api/admin/rates/$id")
  assert_contains "$del" '"ok":true'
  pass "rates CRUD ok"
}

test_incidents() {
  step "Incidents de-dup and resolve"
  local new ded list iid res
  new=$(req_json -X POST "$CENTRAL_URL/incidents" -d '{"type":"device_alert","deviceId":"gate-A","zoneId":1,"note":"test"}')
  assert_contains "$new" '"status":"open"'
  ded=$(req_json -X POST "$CENTRAL_URL/incidents" -d '{"type":"device_alert","deviceId":"gate-A","zoneId":1,"note":"dup"}')
  assert_contains "$ded" '"deduped":true'
  list=$(req "$GATEWAY_URL/api/admin/incidents")
  iid=$(echo "$list" | jq -er '.[0].id')
  res=$(req_json -X POST "$GATEWAY_URL/api/admin/incidents/$iid/resolve" -d '{"status":"resolved","note":"e2e"}')
  assert_contains "$res" '"status":"resolved"'
  pass "incidents ok"
}

test_assistant_slots() {
  step "Assistant slot-filling RU"
  local s1 s2 s3 sid
  sid="sess$RANDOM"
  s1=$(req_json -X POST "$ASSIST_URL" -d "{\"text\":\"начать парковку\",\"lang\":\"ru-RU\",\"sessionId\":\"$sid\"}")
  assert_contains "$s1" 'Уточните номер авто'
  s2=$(req_json -X POST "$ASSIST_URL" -d "{\"text\":\"машина B123\",\"lang\":\"ru-RU\",\"sessionId\":\"$sid\"}")
  assert_contains "$s2" 'Уточните зону парковки'
  s3=$(req_json -X POST "$ASSIST_URL" -d "{\"text\":\"зона A\",\"lang\":\"ru-RU\",\"sessionId\":\"$sid\"}")
  assert_contains "$s3" 'Открыта парковка'
  pass "assistant slot-filling ok"
}

test_rates_answer() {
  step "Assistant rates answer"
  local r
  r=$(req_json -X POST "$ASSIST_URL" -d '{"text":"В чём разница тарифов?","lang":"ru-RU"}')
  echo "$r" | jq -er .reply | grep -q 'Тарифы' || fail "assistant did not explain rates"
  pass "assistant rates ok"
}

main() {
  set_sandbox_success
  test_health
  test_fronts_up
  test_parking_flow
  test_rates_crud
  test_incidents
  test_assistant_slots
  test_rates_answer
  pass "All E2E scenarios passed"
}

main "$@"

