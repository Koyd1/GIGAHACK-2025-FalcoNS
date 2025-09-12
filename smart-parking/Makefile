DOCKER_COMPOSE=docker compose

.PHONY: up down logs migrate seed reset

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
