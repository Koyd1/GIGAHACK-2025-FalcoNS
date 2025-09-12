#!/usr/bin/env bash
set -euo pipefail

export $(grep -v '^#' .env 2>/dev/null | xargs -I{} echo {}) >/dev/null 2>&1 || true

DC="docker compose"
SERVICE=db
USER=${POSTGRES_USER:-parking}
DB=${POSTGRES_DB:-parking}

echo "Applying migrations to $DB as $USER..."

for f in $(ls db/migrations/*.sql | sort); do
  base=$(basename "$f")
  echo "--> $base"
  $DC exec -T $SERVICE psql -U $USER -d $DB -f /docker-entrypoint-initdb.d/${base}
done

echo "Migrations complete"
