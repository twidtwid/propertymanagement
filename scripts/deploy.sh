#!/bin/bash
#
# Property Management Deployment Script
#
# Automates the deployment process for production updates.
#
# Usage:
#   ./scripts/deploy.sh              # Full deployment
#   ./scripts/deploy.sh --quick      # Skip backup, quick restart
#   ./scripts/deploy.sh --rollback   # Rollback to previous version
#
# Prerequisites:
#   - Git repository cloned to /home/deploy/app
#   - Docker and Docker Compose installed
#   - .env.production configured
#   - Caddy configured and running

set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-/home/deploy/app}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_step() {
    echo ""
    log "${BLUE}━━━ $1 ━━━${NC}"
}

log_success() {
    log "${GREEN}✓ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠ $1${NC}"
}

log_error() {
    log "${RED}✗ $1${NC}"
}

# Check if running as deploy user or root
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. Consider using 'deploy' user."
    fi
}

# Change to app directory
cd "${APP_DIR}" || {
    log_error "App directory not found: ${APP_DIR}"
    exit 1
}

# Parse arguments
QUICK_MODE=false
ROLLBACK_MODE=false
for arg in "$@"; do
    case $arg in
        --quick)
            QUICK_MODE=true
            BACKUP_BEFORE_DEPLOY=false
            ;;
        --rollback)
            ROLLBACK_MODE=true
            ;;
    esac
done

# Store current commit for potential rollback
PREVIOUS_COMMIT=$(git rev-parse HEAD)

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       PROPERTY MANAGEMENT SYSTEM - DEPLOYMENT              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log "App directory: ${APP_DIR}"
log "Current commit: ${PREVIOUS_COMMIT:0:8}"

# Handle rollback
if [[ "${ROLLBACK_MODE}" == "true" ]]; then
    log_step "ROLLBACK MODE"

    # Check for previous commit marker
    if [[ -f ".previous_deploy_commit" ]]; then
        ROLLBACK_COMMIT=$(cat .previous_deploy_commit)
        log "Rolling back to: ${ROLLBACK_COMMIT:0:8}"

        git checkout "${ROLLBACK_COMMIT}"
        docker compose -f "${COMPOSE_FILE}" build --no-cache
        docker compose -f "${COMPOSE_FILE}" up -d

        log_success "Rollback complete!"
        exit 0
    else
        log_error "No previous deploy commit found. Cannot rollback."
        exit 1
    fi
fi

# Pre-flight checks
log_step "PRE-FLIGHT CHECKS"

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running"
    exit 1
fi
log_success "Docker is running"

# Check .env.production exists
if [[ ! -f ".env.production" ]]; then
    log_error ".env.production not found"
    exit 1
fi
log_success ".env.production found"

# Check required environment variables
source .env.production 2>/dev/null || true
if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL not set in .env.production"
    exit 1
fi
if [[ -z "${TOKEN_ENCRYPTION_KEY:-}" ]]; then
    log_warning "TOKEN_ENCRYPTION_KEY not set (Gmail OAuth won't work)"
fi
log_success "Environment variables verified"

# Check git status
if [[ -n "$(git status --porcelain)" ]]; then
    log_warning "Uncommitted changes detected"
    git status --short
fi

# Backup database before deployment
if [[ "${BACKUP_BEFORE_DEPLOY}" == "true" ]] && [[ "${QUICK_MODE}" == "false" ]]; then
    log_step "DATABASE BACKUP"

    if [[ -f "scripts/backup-db.sh" ]]; then
        if ./scripts/backup-db.sh; then
            log_success "Database backup complete"
        else
            log_warning "Database backup failed (continuing anyway)"
        fi
    else
        log_warning "Backup script not found, skipping"
    fi
fi

# Pull latest changes
log_step "PULLING LATEST CHANGES"

# Store previous commit for rollback
echo "${PREVIOUS_COMMIT}" > .previous_deploy_commit

git fetch origin
UPSTREAM_CHANGES=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")

if [[ "${UPSTREAM_CHANGES}" == "0" ]]; then
    log "No new changes from origin/main"
else
    log "Pulling ${UPSTREAM_CHANGES} new commit(s)..."
    git pull origin main
    log_success "Code updated"
fi

NEW_COMMIT=$(git rev-parse HEAD)
log "Now at commit: ${NEW_COMMIT:0:8}"

# Build Docker images
log_step "BUILDING DOCKER IMAGES"

if [[ "${QUICK_MODE}" == "true" ]]; then
    log "Quick mode: using cached layers"
    docker compose -f "${COMPOSE_FILE}" build
else
    log "Full rebuild (no cache)"
    docker compose -f "${COMPOSE_FILE}" build --no-cache
fi
log_success "Build complete"

# Stop and restart services
log_step "RESTARTING SERVICES"

# Stop services gracefully
log "Stopping services..."
docker compose -f "${COMPOSE_FILE}" down --timeout 30

# Start services
log "Starting services..."
docker compose -f "${COMPOSE_FILE}" up -d

# Wait for health checks
log_step "HEALTH CHECK"

log "Waiting for services to be healthy..."
sleep 10

# Check app health
HEALTH_ATTEMPTS=0
MAX_ATTEMPTS=30

while [[ $HEALTH_ATTEMPTS -lt $MAX_ATTEMPTS ]]; do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health)
        log_success "App is healthy"
        log "Health response: ${HEALTH_RESPONSE}"
        break
    fi

    ((HEALTH_ATTEMPTS++))
    if [[ $HEALTH_ATTEMPTS -eq $MAX_ATTEMPTS ]]; then
        log_error "Health check failed after ${MAX_ATTEMPTS} attempts"
        log_warning "Rolling back to previous version..."

        git checkout "${PREVIOUS_COMMIT}"
        docker compose -f "${COMPOSE_FILE}" build
        docker compose -f "${COMPOSE_FILE}" up -d

        log_error "Deployment failed. Rolled back to ${PREVIOUS_COMMIT:0:8}"
        exit 1
    fi

    log "Waiting for app to start... (attempt ${HEALTH_ATTEMPTS}/${MAX_ATTEMPTS})"
    sleep 2
done

# Check all services are running
log "Checking all services..."
docker compose -f "${COMPOSE_FILE}" ps

# Verify database connectivity
if docker compose -f "${COMPOSE_FILE}" exec -T db pg_isready -U "${DB_USER:-propman}" > /dev/null 2>&1; then
    log_success "Database is ready"
else
    log_warning "Database health check inconclusive"
fi

# Clean up old Docker images
log_step "CLEANUP"

log "Removing unused Docker images..."
docker image prune -f > /dev/null 2>&1
log_success "Cleanup complete"

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   DEPLOYMENT COMPLETE                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log_success "Successfully deployed!"
log "  Previous commit: ${PREVIOUS_COMMIT:0:8}"
log "  Current commit:  ${NEW_COMMIT:0:8}"
log "  Services running:"
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}" | tail -n +2 | while read line; do
    log "    ${line}"
done
echo ""
log "To rollback: ./scripts/deploy.sh --rollback"
echo ""
