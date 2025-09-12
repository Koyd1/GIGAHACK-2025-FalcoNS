# создаём корневую папку
mkdir -p smart-parking

cd smart-parking

# базовые файлы
touch docker-compose.yml Makefile .env.example README.md

# база данных
mkdir -p db/migrations
touch db/migrations/001_init.sql db/migrations/002_seed_zones_rates.sql
touch db/seed.sql

# общий пакет
mkdir -p packages/common/src
touch packages/common/package.json \
      packages/common/tsconfig.json \
      packages/common/src/index.ts \
      packages/common/src/types.ts \
      packages/common/src/httpClient.ts \
      packages/common/src/logger.ts

# сервисы
mkdir -p services/api-gateway/src
touch services/api-gateway/Dockerfile \
      services/api-gateway/package.json \
      services/api-gateway/tsconfig.json \
      services/api-gateway/src/index.ts \
      services/api-gateway/src/routes.ts \
      services/api-gateway/src/config.ts

mkdir -p services/central/src/routes services/central/src/services
touch services/central/Dockerfile \
      services/central/package.json \
      services/central/tsconfig.json \
      services/central/src/index.ts \
      services/central/src/db.ts \
      services/central/src/routes/health.ts \
      services/central/src/routes/parking.ts \
      services/central/src/routes/payments.ts \
      services/central/src/routes/admin.ts \
      services/central/src/services/aiClient.ts \
      services/central/src/services/paymentClient.ts

mkdir -p services/iot-simulator/src
touch services/iot-simulator/Dockerfile \
      services/iot-simulator/package.json \
      services/iot-simulator/tsconfig.json \
      services/iot-simulator/src/index.ts

mkdir -p services/payment-simulator/src
touch services/payment-simulator/Dockerfile \
      services/payment-simulator/package.json \
      services/payment-simulator/tsconfig.json \
      services/payment-simulator/src/index.ts

mkdir -p services/ai-module/app
touch services/ai-module/Dockerfile \
      services/ai-module/requirements.txt \
      services/ai-module/app/main.py

# фронтенды
mkdir -p frontends/frontend-user/src/components
touch frontends/frontend-user/Dockerfile \
      frontends/frontend-user/package.json \
      frontends/frontend-user/index.html \
      frontends/frontend-user/vite.config.ts \
      frontends/frontend-user/src/main.tsx \
      frontends/frontend-user/src/App.tsx \
      frontends/frontend-user/src/api.ts \
      frontends/frontend-user/src/components/TicketFlow.tsx \
      frontends/frontend-user/src/components/ZonePicker.tsx

mkdir -p frontends/frontend-admin/src/components
touch frontends/frontend-admin/Dockerfile \
      frontends/frontend-admin/package.json \
      frontends/frontend-admin/index.html \
      frontends/frontend-admin/vite.config.ts \
      frontends/frontend-admin/src/main.tsx \
      frontends/frontend-admin/src/App.tsx \
      frontends/frontend-admin/src/api.ts \
      frontends/frontend-admin/src/components/Zones.tsx \
      frontends/frontend-admin/src/components/Rates.tsx \
      frontends/frontend-admin/src/components/Reports.tsx

# скрипты
mkdir -p scripts
touch scripts/generate-sensors.ts \
      scripts/migrate.sh \
      scripts/dev-reset.sh
