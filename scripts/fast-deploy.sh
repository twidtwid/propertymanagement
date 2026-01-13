#!/bin/bash
#
# Fast Deploy Script - Build locally, push to GitHub Container Registry, deploy
#
# This script builds Docker images on your local machine (fast) and pushes them
# to ghcr.io, then tells production to pull and restart (also fast).
#
# Total deploy time: ~30-60 seconds (vs 5-6 minutes building on server)
#
# Usage:
#   ./scripts/fast-deploy.sh              # Full build + deploy
#   ./scripts/fast-deploy.sh --skip-build # Deploy existing images (fastest)
#   ./scripts/fast-deploy.sh --dry-run    # Show what would happen
#
# Prerequisites:
#   1. Docker logged into ghcr.io:
#      echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
#   2. SSH access to production server (root@143.110.229.185)
#
# One-time setup on production server:
#   docker login ghcr.io -u YOUR_USERNAME -p YOUR_GITHUB_TOKEN
#

set -euo pipefail

# Configuration
REGISTRY="ghcr.io"
IMAGE_NAME="twidtwid/propertymanagement"
PROD_SERVER="root@143.110.229.185"
PROD_DIR="/root/app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] $1"; }
log_step() { echo ""; log "${BLUE}━━━ $1 ━━━${NC}"; }
log_success() { log "${GREEN}✓ $1${NC}"; }
log_error() { log "${RED}✗ $1${NC}"; }

# Parse arguments
SKIP_BUILD=false
DRY_RUN=false
for arg in "$@"; do
    case $arg in
        --skip-build) SKIP_BUILD=true ;;
        --dry-run) DRY_RUN=true ;;
    esac
done

# Get version info
cd "$(dirname "$0")/.."
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
GIT_SHA=$(git rev-parse --short HEAD)
TAG="${VERSION}-${GIT_SHA}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          FAST DEPLOY - Property Management System            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log "Version: ${YELLOW}${TAG}${NC}"
log "Registry: ${REGISTRY}/${IMAGE_NAME}"
log "Target: ${PROD_SERVER}"

if [[ "${DRY_RUN}" == "true" ]]; then
    log "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
fi

# Check Docker login
if ! docker manifest inspect ${REGISTRY}/${IMAGE_NAME}:latest > /dev/null 2>&1; then
    if ! grep -q "ghcr.io" ~/.docker/config.json 2>/dev/null; then
        log_error "Not logged into ghcr.io"
        echo ""
        echo "Run this first:"
        echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin"
        echo ""
        exit 1
    fi
fi

# Build step
if [[ "${SKIP_BUILD}" == "false" ]]; then
    log_step "BUILDING IMAGES (linux/amd64)"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log "Would build: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
        log "Would build: ${REGISTRY}/${IMAGE_NAME}-worker:${TAG}"
    else
        START_TIME=$(date +%s)

        # Pull latest images for cache (ignore errors if they don't exist yet)
        log "Pulling cache images..."
        docker pull ${REGISTRY}/${IMAGE_NAME}:latest 2>/dev/null || true
        docker pull ${REGISTRY}/${IMAGE_NAME}-worker:latest 2>/dev/null || true

        # Build app and worker in parallel with layer caching
        log "Building app and worker images in parallel..."

        # Build app (runner target) with cache-from for layer reuse
        DOCKER_BUILDKIT=1 docker build \
            --platform linux/amd64 \
            --target runner \
            --build-arg BUILD_VERSION=${TAG} \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --cache-from ${REGISTRY}/${IMAGE_NAME}:latest \
            -t ${REGISTRY}/${IMAGE_NAME}:${TAG} \
            -t ${REGISTRY}/${IMAGE_NAME}:latest \
            . &
        APP_PID=$!

        # Build worker target with cache-from
        DOCKER_BUILDKIT=1 docker build \
            --platform linux/amd64 \
            --target worker \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --cache-from ${REGISTRY}/${IMAGE_NAME}-worker:latest \
            --cache-from ${REGISTRY}/${IMAGE_NAME}:latest \
            -t ${REGISTRY}/${IMAGE_NAME}-worker:${TAG} \
            -t ${REGISTRY}/${IMAGE_NAME}-worker:latest \
            . &
        WORKER_PID=$!

        # Wait for both builds to complete
        log "Waiting for parallel builds to complete..."
        wait $APP_PID || { log_error "App build failed"; exit 1; }
        wait $WORKER_PID || { log_error "Worker build failed"; exit 1; }

        BUILD_TIME=$(($(date +%s) - START_TIME))
        log_success "Parallel builds complete in ${BUILD_TIME}s"
    fi

    log_step "PUSHING TO REGISTRY"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log "Would push: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
        log "Would push: ${REGISTRY}/${IMAGE_NAME}-worker:${TAG}"
    else
        START_TIME=$(date +%s)

        docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}
        docker push ${REGISTRY}/${IMAGE_NAME}:latest
        docker push ${REGISTRY}/${IMAGE_NAME}-worker:${TAG}
        docker push ${REGISTRY}/${IMAGE_NAME}-worker:latest

        PUSH_TIME=$(($(date +%s) - START_TIME))
        log_success "Push complete in ${PUSH_TIME}s"
    fi
else
    log_step "SKIPPING BUILD (using existing images)"
fi

log_step "PRE-DEPLOYMENT VALIDATION"

if [[ "${DRY_RUN}" == "false" ]]; then
    # Check 1: Environment variable parity
    log "Checking environment variable parity..."
    MISSING_VARS=$(comm -13 \
        <(ssh ${PROD_SERVER} "grep -o '^[A-Z_]*=' ${PROD_DIR}/.env.production 2>/dev/null" | sort) \
        <(grep -o '^[A-Z_]*=' .env.local | sort))

    if [ -n "$MISSING_VARS" ]; then
        log_error "Missing environment variables in production .env.production:"
        echo "$MISSING_VARS" | sed 's/^/  - /'
        echo ""
        log_error "Add these to production before deploying:"
        echo "  ssh ${PROD_SERVER} \"echo 'VAR_NAME=value' >> ${PROD_DIR}/.env.production\""
        exit 1
    fi
    log_success "Environment variables in sync"

    # Check 2: TOKEN_ENCRYPTION_KEY must match (critical for encrypted tokens)
    log "Verifying TOKEN_ENCRYPTION_KEY..."
    PROD_KEY=$(ssh ${PROD_SERVER} "grep TOKEN_ENCRYPTION_KEY ${PROD_DIR}/.env.production 2>/dev/null | cut -d= -f2")
    LOCAL_KEY=$(grep TOKEN_ENCRYPTION_KEY .env.local | cut -d= -f2)

    if [ -z "$PROD_KEY" ]; then
        log_error "TOKEN_ENCRYPTION_KEY not found in production .env.production!"
        log_error "This will break all encrypted OAuth tokens (Gmail, Dropbox, Nest)"
        exit 1
    fi

    if [ "$PROD_KEY" != "$LOCAL_KEY" ]; then
        log_error "TOKEN_ENCRYPTION_KEY mismatch!"
        log_error "Production: ${PROD_KEY:0:20}..."
        log_error "Local:      ${LOCAL_KEY:0:20}..."
        log_error ""
        log_error "Changing this key will break all encrypted tokens!"
        log_error "All OAuth tokens (Gmail, Dropbox, Nest) will become unreadable."
        exit 1
    fi
    log_success "TOKEN_ENCRYPTION_KEY verified"
fi

log_step "DEPLOYING TO PRODUCTION"

if [[ "${DRY_RUN}" == "true" ]]; then
    log "Would run: git pull on ${PROD_SERVER}"
    log "Would run: docker compose pull && up -d"
else
    START_TIME=$(date +%s)

    # Sync code (for migrations, scripts, docker-compose changes)
    log "Syncing code..."
    ssh ${PROD_SERVER} "cd ${PROD_DIR} && git pull"

    # Pull new images and restart
    log "Pulling images and restarting..."
    ssh ${PROD_SERVER} "cd ${PROD_DIR} && docker compose -f docker-compose.prod.yml --env-file .env.production pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d"

    DEPLOY_TIME=$(($(date +%s) - START_TIME))
    log_success "Deploy complete in ${DEPLOY_TIME}s"
fi

log_step "HEALTH CHECK"

if [[ "${DRY_RUN}" == "true" ]]; then
    log "Would check: https://spmsystem.com/api/health"
else
    sleep 5

    HEALTH=$(curl -sf https://spmsystem.com/api/health 2>/dev/null || echo '{"status":"error"}')

    if echo "$HEALTH" | grep -q '"status":"ok"'; then
        log_success "Health check passed!"
        echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
    else
        log_error "Health check failed!"
        echo "$HEALTH"
        echo ""
        log "Check logs: ssh ${PROD_SERVER} \"docker logs app-app-1 --tail 50\""
        exit 1
    fi
fi

log_step "RESTARTING LOCAL DEV"

if [[ "${DRY_RUN}" == "true" ]]; then
    log "Would clean .next cache and restart dev container"
else
    # Clean stale .next cache created by production build
    rm -rf .next 2>/dev/null || true

    # Restart dev app container if running
    if docker compose ps app --status running -q 2>/dev/null | grep -q .; then
        log "Restarting dev app container..."
        docker compose restart app >/dev/null 2>&1

        # Wait for dev to be ready
        for i in {1..30}; do
            if docker compose logs app --tail 5 2>/dev/null | grep -q "Ready in"; then
                log_success "Dev server ready"
                break
            fi
            sleep 1
        done
    else
        log "Dev container not running, skipping restart"
    fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    DEPLOY SUCCESSFUL                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log_success "Deployed ${YELLOW}${TAG}${NC} to ${YELLOW}spmsystem.com${NC}"
echo ""
