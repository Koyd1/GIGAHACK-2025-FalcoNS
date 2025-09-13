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

if command -v psql >/dev/null 2>&1; then
  PSQL_CMD=(psql ${DATABASE_URL:+"$DATABASE_URL"})
else
  # Fallback to running psql inside the db container
  DBU=${POSTGRES_USER:-parking}
  DBD=${POSTGRES_DB:-parking}
  PSQL_CMD=(docker compose exec -T db psql -U "$DBU" -d "$DBD")
fi

echo "[1/4] Ensuring AI schema exists (run migrations if needed)"
echo "Hint: run 'make migrate' beforehand if this fails."

echo "[2/4] Cleaning ai.* tables"
cat "$TRUNCATE_AI" | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 || true

echo "[3/4] Loading SQLite data into staging_sqlite.*"

dump_and_filter_sql() {
  # Normalize SQLite SQL to be acceptable by Postgres in staging
  # - Drop PRAGMA and BEGIN/COMMIT lines (case-insensitive)
  # - Replace DATETIME -> TIMESTAMP (portable, case-insensitive)
  # - Keep quoted identifiers
  sed \
    -e 's/\r$//' \
    -e '/[Pp][Rr][Aa][Gg][Mm][Aa]/d' \
    -e '/^[Bb][Ee][Gg][Ii][Nn][[:space:]][[:space:]]*[Tt][Rr][Aa][Nn][Ss][Aa][Cc][Tt][Ii][Oo][Nn];/d' \
    -e '/^[Cc][Oo][Mm][Mm][Ii][Tt];/d' \
    -e 's/[Bb][Ee][Gg][Ii][Nn][[:space:]][Tt][Rr][Aa][Nn][Ss][Aa][Cc][Tt][Ii][Oo][Nn];//g' \
    -e 's/[Cc][Oo][Mm][Mm][Ii][Tt];//g' \
    -e 's/[Dd][Aa][Tt][Ee][Tt][Ii][Mm][Ee]/TIMESTAMP/g' \
    -e '/FOREIGN KEY/d' \
    -e 's/[[:space:]]REFERENCES[^,)]*)//g' \
    -e 's/[[:space:]]ON[[:space:]]DELETE[^,)]*//g' \
    -e 's/[[:space:]]ON[[:space:]]UPDATE[^,)]*//g' \
    -e 's/,[[:space:]]*)/)/g' \
    -e '/CONSTRAINT[[:space:]].*PRIMARY KEY/s/,[[:space:]]*$//'
}

if [[ "$INPUT_TYPE" == "sql" ]]; then
  cat "$PREAMBLE" "$INPUT_PATH" | dump_and_filter_sql | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1
else
  if command -v sqlite3 >/dev/null 2>&1; then
    {
      cat "$PREAMBLE";
      sqlite3 "$INPUT_PATH" .dump;
    } | dump_and_filter_sql | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1
  else
    echo "sqlite3 not found; trying dockerized sqlite3..."
    {
      cat "$PREAMBLE";
      docker run --rm -i -v "$(pwd)":"/work" nouchka/sqlite3 sqlite3 "/work/$INPUT_PATH" .dump;
    } | dump_and_filter_sql | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1
  fi
fi

echo "[4/4] Importing into ai.* schema"
cat "$IMPORTER" | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1

echo "Done. Verify with: curl http://localhost:8080/api/admin/sessions/open"
