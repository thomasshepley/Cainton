# ---- Build stage ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone server bundle (includes the needed node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Guest list seed — the SQLite DB is created next to it on first run
COPY --from=builder /app/data/guests.seed.json ./data/guests.seed.json
# Maintenance scripts (e.g. admin password reset)
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
VOLUME /app/data

CMD ["node", "server.js"]
