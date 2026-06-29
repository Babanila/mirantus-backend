# Multi-Stage Build (TASKS.md §T-26)
# STAGE 1: BUILD
FROM node:20-alpine AS builder

# Install ONLY required build dependencies (no runtime bloat)
RUN apk add --no-cache python3 make g++ && \
    npm install -g npm@latest

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --production

# STAGE 2: RUNTIME
FROM node:20-alpine AS runner

# Create unprivileged user BEFORE copying files UID/GID 1001 aligns with Kubernetes non-root policies
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app && \
    mkdir -p /app && \
    chown app:app /app

WORKDIR /app

# Copy ONLY production artifacts from builder stage with explicit ownership
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package*.json ./
COPY --from=builder --chown=app:app /app/dist ./dist

USER app

# HEALTH CHECK (Per TASKS.md §14 + T-18 implementation)
# - Uses liveness endpoint (/health) that does NOT check DB
# - Explicit error handling for connection failures
# - Logs status for operational visibility
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { \
    console.log('[HEALTH] Status:', r.statusCode); \
    process.exit(r.statusCode === 200 ? 0 : 1); \
  }).on('error', e => { \
    console.error('[HEALTH] Error:', e.message); \
    process.exit(1); \
  })"

EXPOSE 3000
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://user:password@localhost:5432/screening_orders \
    LOG_LEVEL=info \
    CORS_ORIGIN=http://localhost:5173 \
    DB_POOL_MAX=10 \
    DB_POOL_MIN=2 \
    DB_CONNECT_TIMEOUT_MS=5000 \
    API_PORT=3000

CMD ["node", "dist/main.js"]
