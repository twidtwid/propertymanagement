#!/bin/bash
#
# Smart Dev Restart Script
#
# Restarts the development server with minimal cache clearing.
# Only clears .next cache when necessary, otherwise just restarts.
#
# Usage:
#   ./scripts/dev-restart.sh           # Smart restart (fast)
#   ./scripts/dev-restart.sh --clean   # Force clean restart (slower)
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] $1"; }
log_success() { log "${GREEN}✓ $1${NC}"; }
log_warn() { log "${YELLOW}⚠ $1${NC}"; }

# Parse arguments
FORCE_CLEAN=false
for arg in "$@"; do
    case $arg in
        --clean) FORCE_CLEAN=true ;;
    esac
done

cd "$(dirname "$0")/.."

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║        DEV SERVER RESTART             ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Determine if we need a clean restart
NEEDS_CLEAN=false

if [[ "${FORCE_CLEAN}" == "true" ]]; then
    NEEDS_CLEAN=true
    log_warn "Forced clean restart requested"
elif [[ ! -d ".next" ]]; then
    NEEDS_CLEAN=true
    log ".next directory doesn't exist"
elif [[ ! -f ".next/BUILD_ID" ]]; then
    NEEDS_CLEAN=true
    log_warn ".next/BUILD_ID missing - cache may be corrupt"
else
    # Check if .next is older than src (code changed since last build)
    NEXT_MTIME=$(stat -f %m .next 2>/dev/null || stat -c %Y .next 2>/dev/null)
    SRC_MTIME=$(find src -type f -name "*.ts" -o -name "*.tsx" | head -20 | xargs stat -f %m 2>/dev/null | sort -rn | head -1 || echo 0)

    if [[ "${SRC_MTIME}" -gt "${NEXT_MTIME}" ]]; then
        log "Source files changed since last build"
        # Don't force clean - let Next.js HMR handle it
    fi
fi

START_TIME=$(date +%s)

if [[ "${NEEDS_CLEAN}" == "true" ]]; then
    log "${BLUE}Performing clean restart...${NC}"

    # Stop app container
    docker compose stop app 2>/dev/null || true

    # Clear Next.js cache
    log "Clearing .next cache..."
    rm -rf .next

    # Start app container
    log "Starting app container..."
    docker compose up -d app
else
    log "${BLUE}Performing quick restart...${NC}"

    # Just restart the container - keep the cache
    docker compose restart app
fi

# Wait for the dev server to be ready
log "Waiting for dev server to be ready..."
MAX_WAIT=60
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    if docker compose logs app --tail 5 2>/dev/null | grep -q "Ready in"; then
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

TOTAL_TIME=$(($(date +%s) - START_TIME))

if docker compose logs app --tail 3 2>/dev/null | grep -q "Ready in"; then
    log_success "Dev server ready in ${TOTAL_TIME}s"
else
    log_warn "Dev server may still be starting (waited ${TOTAL_TIME}s)"
    log "Check logs: docker compose logs app --tail 20"
fi

echo ""
