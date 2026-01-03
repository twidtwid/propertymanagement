FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy only lock file first for better caching
COPY package-lock.json* ./
COPY package.json ./

# Use BuildKit cache mount for npm - survives even when package.json changes
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy source files (excluding package.json to preserve npm ci cache)
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY next.config.mjs tsconfig.json tailwind.config.ts postcss.config.mjs ./
COPY package.json ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3072"

# Version passed at build time
ARG BUILD_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$BUILD_VERSION

RUN npm run build

# Runner (Next.js app)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# Worker (background scripts)
FROM base AS worker
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy node_modules and scripts (with correct ownership for nextjs user)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs

CMD ["node", "scripts/sync-emails.js", "--watch", "--interval=10"]
