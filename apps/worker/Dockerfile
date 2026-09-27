# Build from the repository root: docker build -f apps/worker/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATABASE_URL=/data/maia-lms.db
COPY --from=build /app /app
USER node
CMD ["node", "apps/worker/dist/worker.js"]
