#!/usr/bin/env bash
set -euo pipefail

docker compose down -v || true
docker compose up -d db
bash scripts/migrate.sh
docker compose up -d --build
echo "Reset complete"
