DOCKER_COMPOSE=docker compose

.PHONY: up down logs migrate seed reset import-sqlite load-data reload-data

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down -v

logs:
	$(DOCKER_COMPOSE) logs -f --tail=200

migrate:
	bash scripts/migrate.sh

seed:
	$(DOCKER_COMPOSE) exec -T db psql -U $$POSTGRES_USER -d $$POSTGRES_DB -f /app/db/seed.sql

reset:
	bash scripts/dev-reset.sh

# Import current dataset (SQLite dump or db) into Postgres ai.* schema
import-sqlite:
	$(DOCKER_COMPOSE) up -d db
	$(MAKE) migrate
	@INPUT_SQL=""; INPUT_DB=""; \
	if [ -f parking_sqlite.sql ]; then INPUT_SQL=parking_sqlite.sql; fi; \
	if [ -z "$$INPUT_SQL" ] && [ -f ../parking_sqlite.sql ]; then INPUT_SQL=../parking_sqlite.sql; fi; \
	if [ -f Parking.db ]; then INPUT_DB=Parking.db; fi; \
	if [ -z "$$INPUT_DB" ] && [ -f ../Parking.db ]; then INPUT_DB=../Parking.db; fi; \
	if [ -n "$$INPUT_SQL" ]; then \
		echo "Importing from $$INPUT_SQL"; \
		bash scripts/migrate_sqlite.sh --sql "$$INPUT_SQL"; \
	elif [ -n "$$INPUT_DB" ]; then \
		echo "Importing from $$INPUT_DB"; \
		bash scripts/migrate_sqlite.sh --db "$$INPUT_DB"; \
	else \
		echo "No input found: provide parking_sqlite.sql or Parking.db" && exit 1; \
	fi

# Load data + restart app services so UIs see fresh data
load-data: import-sqlite
	$(DOCKER_COMPOSE) restart central api-gateway frontend-user frontend-admin
	@echo "Data loaded. Verify: curl http://localhost:8080/api/admin/sessions/open"

# Full reload helper: reset containers, import, restart
reload-data:
	$(MAKE) reset
	$(MAKE) import-sqlite
	$(DOCKER_COMPOSE) restart central api-gateway frontend-user frontend-admin
	@echo "Reload complete."
