#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/migrate_sqlite.sh --db Parking.db
#   scripts/migrate_sqlite.sh --sql parking_sqlite.sql
#
# Requires: psql; sqlite3 (or docker with sqlite image) if using --db.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREAMBLE="$ROOT_DIR/db/tools/sqlite_stage_preamble.sql"
IMPORTER="$ROOT_DIR/db/tools/import_sqlite_to_ai.sql"
TRUNCATE_AI="$ROOT_DIR/db/tools/ai_truncate.sql"

INPUT_TYPE=""
INPUT_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)
      INPUT_TYPE="db"; INPUT_PATH="$2"; shift 2;;
    --sql)
      INPUT_TYPE="sql"; INPUT_PATH="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ -z "$INPUT_TYPE" || -z "$INPUT_PATH" ]]; then
  echo "Specify --db <file.sqlite> or --sql <dump.sql>" >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Input not found: $INPUT_PATH" >&2
  exit 1
fi

PSQL_CMD=(psql ${DATABASE_URL:+"$DATABASE_URL"})

echo "[1/4] Ensuring AI schema exists (run migrations if needed)"
echo "Hint: run 'make migrate' beforehand if this fails."

echo "[2/4] Cleaning ai.* tables"
"${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 -f "$TRUNCATE_AI" || true

echo "[3/4] Loading SQLite data into staging_sqlite.*"

dump_and_filter_sql() {
  # Normalize SQLite SQL to be acceptable by Postgres in staging
  # - Drop PRAGMA and BEGIN/COMMIT lines
  # - Replace DATETIME -> TIMESTAMP
  # - Keep quoted identifiers
  sed \
    -e '/^PRAGMA/d' \
    -e '/^BEGIN TRANSACTION;/d' \
    -e '/^COMMIT;/d' \
    -e 's/\bDATETIME\b/TIMESTAMP/gi'
}

if [[ "$INPUT_TYPE" == "sql" ]]; then
  cat "$PREAMBLE" - | dump_and_filter_sql | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 < "$INPUT_PATH"
else
  if command -v sqlite3 >/dev/null 2>&1; then
    cat "$PREAMBLE" - | dump_and_filter_sql | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 < <(sqlite3 "$INPUT_PATH" .dump)
  else
    echo "sqlite3 not found; trying dockerized sqlite3..."
    docker run --rm -i -v "$(pwd)":"/work" nouchka/sqlite3 sqlite3 "/work/$INPUT_PATH" .dump | \
      (cat "$PREAMBLE" - | dump_and_filter_sql | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1)
  fi
fi

echo "[4/4] Importing into ai.* schema"
"${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 -f "$IMPORTER"

echo "Done. Verify with: curl http://localhost:8080/api/admin/sessions/open"

