FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev || npm i --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm ci || npm i
COPY src ./src
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/index.js"]

FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --include=dev
COPY src ./src
CMD ["npm", "run", "dev"]
