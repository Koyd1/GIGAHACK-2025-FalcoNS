FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --include=dev
COPY src ./src
CMD ["npm", "run", "dev"]
