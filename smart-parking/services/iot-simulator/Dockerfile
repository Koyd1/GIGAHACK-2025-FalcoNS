FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install --include=dev
RUN npm install -g tsx
COPY src ./src
CMD ["npm", "run", "dev"]
