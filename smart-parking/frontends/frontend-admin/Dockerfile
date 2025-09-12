FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci || npm i
COPY index.html vite.config.ts tailwind.config.ts postcss.config.js ./
COPY src ./src
ENV VITE_API_URL=${VITE_API_URL}
CMD ["sh", "-lc", "npm install --include=dev && npm run dev -- --host 0.0.0.0 --port 5174"]
