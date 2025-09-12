Smart Parking — Monorepo

What’s inside
- Postgres database with init SQL mounted from `db/migrations` and `db/seed.sql`.
- Services:
  - `central` (Node/Express + Postgres): zones, tickets, rates, payments, admin reports.
  - `api-gateway` (Node/Express): public API proxy for frontends.
  - `payment-simulator` (Node/Express): sandbox payments with configurable outcomes.
  - `ai-module` (FastAPI): dummy dynamic pricing multiplier per zone.
  - `iot-simulator` (Node): generates demo parking sessions.
- Frontends (Vite + React + Tailwind): `frontend-user` and `frontend-admin`.

AI schema (docs alignment)
- New schema `ai` mirrors the structure from docs (parking/zone/station/vehicle/ticket/session/event/tariff/discount_rule/voucher/payment/occupancy_log).
- Migrations:
  - `008_ai_schema.sql` — creates `ai.*` tables + view `ai.v_active_sessions`.
  - `009_ai_seed.sql` — seeds demo parking, zones A/B/C, stations, tariff, sample discounts/voucher.
  - `010_ai_schema_adjustments.sql` — relaxes enum checks to match docs (percent/amount/free_minutes; cash/card/online; status values, event types).
- Central exposes minimal REST for `ai` under `/ai/*`:
  - `GET /ai/discount-rules`, `POST /ai/discount-rules`
  - `GET /ai/vouchers`, `POST /ai/vouchers`
  - `GET /ai/sessions/active`
  - `POST /ai/sessions/start` — body: `{ zone_id? | zone_name?, vehicle_plate?, ticket_code?, entry_station_id? }`
  - `POST /ai/sessions/:id/close` — computes due by simple tariff and closes.
  - `POST /ai/sessions/:id/payments` — body: `{ method, amount_cents, approved, station_id?, processor_ref? }`
  
Note: existing services still use `public.*` tables; `ai.*` runs side‑by‑side without breaking anything.

Run locally
- Requirements: Docker + Docker Compose.
- Copy `.env.example` to `.env` (optional) and tune variables.
- Start: `docker compose up --build` from `smart-parking/`.

Инструкция по запуску (RU)
- Требования: установлен Docker Desktop (или Docker Engine) и Docker Compose v2.
- Подготовка:
  - Перейдите в каталог проекта: `cd smart-parking`.
  - Скопируйте `.env.example` в `.env` и при необходимости измените значения (в т.ч. ключи LLM для ассистента: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`).
- Запуск (dev):
  - Все сервисы: `docker compose up -d --build` (или `make up`).
  - Проверка статуса: `docker compose ps`.
  - Логи: `docker compose logs -f` (или `make logs`).
- Остановка и очистка:
  - Остановить и удалить тома: `docker compose down -v` (или `make down`).
  - Полный сброс окружения с пересозданием БД и миграциями: `make reset`.
  - Применить миграции вручную: `make migrate`. Повторный сид: `make seed`.
- Частичный запуск (по потребности):
  - Бэкенд и API: `docker compose up -d db central api-gateway`.
  - Симуляторы: `docker compose up -d payment-simulator ai-module iot-simulator`.
  - Фронтенды: `docker compose up -d frontend-user frontend-admin`.
- Прод-профиль (multi-stage):
  - `docker compose --profile prod up -d central-prod api-gateway-prod db payment-simulator ai-module`.
  - Фронтенды в compose идут в dev-режиме; для прод-использования собираются отдельно.

Key URLs
- Gateway API: `http://localhost:8080/api`
- User frontend: `http://localhost:5173`
- Admin frontend: `http://localhost:5174`
- Payment sandbox config: `http://localhost:5002/__sandbox/config`
- AI module: `http://localhost:8000/`

API docs and metrics
- Swagger UI: `http://localhost:8080/api/docs` (OpenAPI JSON: `/api/openapi.json`).
- Prometheus metrics: `http://localhost:8080/metrics` (gateway) и `http://localhost:4000/metrics` (central).

Production profile (multi-stage)
- Added multi-stage Dockerfiles for `api-gateway` and `central`.
- Use prod services with prebuilt dist: `central-prod`, `api-gateway-prod`.
- Run prod: `docker compose --profile prod up -d central-prod api-gateway-prod db payment-simulator ai-module`.

Payment sandbox
- Toggle behavior by POSTing JSON to `/__sandbox/config` on `payment-simulator`:
  - `{ "mode": "always_success" | "always_fail" | "random", "failureRate": 0.2, "delayMs": 200 }`.
- Central records every attempt in `payments` table and marks tickets as `paid` on success.

Dynamic pricing
- `central` optionally calls `ai-module` for a multiplier when closing a ticket.
- Controlled via `USE_AI_PRICING` (default `true`).

Перезапуск асистента: `cd smart-parking && docker compose up -d --build assistant-bot`

# Ограничения и планы
STT/TTS сейчас браузерные. Качество и наличие русских/румынских голосов зависят от вашей ОС/браузера. По желанию могу добавить локальные сервисы STT/TTS (Vosk/faster‑whisper + Coqui TTS) в докере.
При наличии OPENAI_API_KEY ассистент становится полноценно “понимающим” (в т.ч. сложные фразы и смешанные языки). Без ключа — использует улучшенный разбор по шаблонам.
Готов расширить ассистента инструментами (Tool Calling) для сложных операций: разрешение инцидентов, управление устройствами/шлагбаумами, корректировка тарифов и grace‑периодов.

CI/CD
- CI (GitHub Actions): сборка всех пакетов и Docker-образов на PR/Push.
  - Workflow: `.github/workflows/ci.yml`
- CD (GHCR): сборка и публикация образов в GitHub Container Registry на `main`/тег.
  - Workflow: `.github/workflows/cd.yml`
  - Теги: `ghcr.io/<owner>/smart-parking-<service>:{sha,latest}` (+ тег релиза)
- Секреты не требуются для GHCR (используется `GITHUB_TOKEN`). Для внешних реестров — добавьте `REGISTRY`,`REGISTRY_USER`,`REGISTRY_PASSWORD` по аналогии.

Демо-шаблоны
- Сценарии: `docs/demo-scenarios.md` — готовые последовательности действий (пользователь/админ/ассистент/шлагбаум).
- HTTP-коллекция: `docs/demo.http` — можно запускать из VS Code (REST Client) или импортировать в Insomnia/Postman.
