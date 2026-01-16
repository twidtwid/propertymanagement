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
# Use Debian slim for Playwright/Chromium support
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Playwright needs to know where Chromium is
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright

# Install wget (for healthcheck) and Chromium dependencies for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=deps /app/node_modules ./node_modules

RUN mkdir .next
RUN chown nextjs:nodejs .next

# Camera snapshots directory
RUN mkdir -p public/camera-snapshots && chown -R nextjs:nodejs public/camera-snapshots

# Install Playwright's bundled Chromium (works better than system Chromium)
RUN npx playwright install chromium && \
    chown -R nextjs:nodejs /app/.playwright

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
