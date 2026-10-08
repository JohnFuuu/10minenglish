# Production image for Cloud Run. Two stages: compile TypeScript with the
# dev dependencies, then ship only the compiled JS and runtime dependencies.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/src ./dist/src
# Cloud Run sets PORT (8080); server.ts reads it.
USER node
CMD ["node", "dist/src/server.js"]
