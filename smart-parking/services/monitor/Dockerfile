FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --include=dev
COPY src ./src
ENV CENTRAL_URL=${CENTRAL_URL}
CMD ["npm", "run", "dev"]
