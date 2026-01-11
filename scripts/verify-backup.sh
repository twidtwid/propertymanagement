#!/bin/bash
#
# Property Management Backup Verification Script
#
# Verifies that database backups can be successfully restored.
# Runs weekly via cron to ensure disaster recovery readiness.
#
# Usage:
#   ./scripts/verify-backup.sh                    # Verify latest backup
#   ./scripts/verify-backup.sh <backup-file>      # Verify specific backup
#
# Crontab entry (weekly on Sunday at 4 AM):
#   0 4 * * SUN /home/deploy/app/scripts/verify-backup.sh >> /var/log/backup-verify.log 2>&1
#
# Requirements:
#   - Docker Compose running with 'db' service
#   - Read access to BACKUP_DIR
#   - (Optional) Pushover credentials for alerts

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-propman}"
DB_NAME="${DB_NAME:-propertymanagement}"
TEST_DB_NAME="${TEST_DB_NAME:-propertymanagement_verify_test}"

# Pushover configuration (optional)
PUSHOVER_TOKEN="${PUSHOVER_TOKEN:-}"
PUSHOVER_USER="${PUSHOVER_USER_TODD:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
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

send_pushover() {
    local message="$1"
    local priority="${2:-0}"

    if [[ -n "${PUSHOVER_TOKEN}" ]] && [[ -n "${PUSHOVER_USER}" ]]; then
        curl -s \
            --form-string "token=${PUSHOVER_TOKEN}" \
            --form-string "user=${PUSHOVER_USER}" \
            --form-string "message=${message}" \
            --form-string "priority=${priority}" \
            --form-string "title=Backup Verification" \
            https://api.pushover.net/1/messages.json > /dev/null
    fi
}

# Change to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

# Determine which backup to verify
if [[ $# -gt 0 ]]; then
    BACKUP_FILE="$1"
    if [[ ! -f "${BACKUP_FILE}" ]]; then
        log_error "Backup file not found: ${BACKUP_FILE}"
        exit 1
    fi
else
    # Use latest backup
    BACKUP_FILE="${BACKUP_DIR}/latest.sql.gz"
    if [[ ! -f "${BACKUP_FILE}" ]]; then
        log_error "No backup found at ${BACKUP_FILE}"
        send_pushover "❌ Backup verification failed: No backup file found" 1
        exit 1
    fi
    # Resolve symlink to get actual filename
    BACKUP_FILE=$(readlink -f "${BACKUP_FILE}" 2>/dev/null || realpath "${BACKUP_FILE}")
fi

log "=========================================="
log "Backup Verification Starting"
log "=========================================="
log "Backup file: ${BACKUP_FILE}"

# Check if Docker Compose is running
if ! docker compose -f "${COMPOSE_FILE}" ps --status running "${DB_SERVICE}" | grep -q "${DB_SERVICE}"; then
    log_error "Database service '${DB_SERVICE}' is not running"
    send_pushover "❌ Backup verification failed: Database service not running" 1
    exit 1
fi

# Create test database
log "Creating test database..."
if docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
    psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" > /dev/null 2>&1 && \
   docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
    psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${TEST_DB_NAME};" > /dev/null 2>&1; then
    log_success "Test database created: ${TEST_DB_NAME}"
else
    log_error "Failed to create test database"
    send_pushover "❌ Backup verification failed: Could not create test database" 1
    exit 1
fi

# Restore backup to test database
log "Restoring backup to test database..."
if gunzip -c "${BACKUP_FILE}" | \
   docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
    psql -U "${DB_USER}" -d "${TEST_DB_NAME}" > /dev/null 2>&1; then
    log_success "Backup restored successfully"
else
    log_error "Failed to restore backup"
    # Clean up test database
    docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
        psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" > /dev/null 2>&1
    send_pushover "❌ Backup verification failed: Restore failed" 1
    exit 1
fi

# Verify data integrity by comparing row counts
log "Verifying data integrity..."

# Get list of all tables
TABLES=$(docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
    psql -U "${DB_USER}" -d "${DB_NAME}" -t -c \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')

MISMATCH_COUNT=0
TOTAL_TABLES=0

for table in $TABLES; do
    if [[ -z "$table" ]]; then
        continue
    fi

    TOTAL_TABLES=$((TOTAL_TABLES + 1))

    # Get row count from production
    PROD_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
        psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM ${table};" | tr -d ' ')

    # Get row count from test database
    TEST_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
        psql -U "${DB_USER}" -d "${TEST_DB_NAME}" -t -c "SELECT COUNT(*) FROM ${table};" | tr -d ' ')

    if [[ "${PROD_COUNT}" != "${TEST_COUNT}" ]]; then
        log_warning "Row count mismatch for ${table}: prod=${PROD_COUNT}, test=${TEST_COUNT}"
        MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
    fi
done

# Clean up test database
log "Cleaning up test database..."
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
    psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" > /dev/null 2>&1
log_success "Test database dropped"

# Final results
log ""
log "=========================================="
if [[ $MISMATCH_COUNT -eq 0 ]]; then
    log_success "Backup verification PASSED"
    log "  Tables verified: ${TOTAL_TABLES}"
    log "  Backup file: $(basename "${BACKUP_FILE}")"
    log "  Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)"
    log "=========================================="
    send_pushover "✅ Backup verification passed: ${TOTAL_TABLES} tables verified" 0
    exit 0
else
    log_error "Backup verification FAILED"
    log "  Tables checked: ${TOTAL_TABLES}"
    log "  Mismatches: ${MISMATCH_COUNT}"
    log "  Backup file: $(basename "${BACKUP_FILE}")"
    log "=========================================="
    send_pushover "❌ Backup verification failed: ${MISMATCH_COUNT}/${TOTAL_TABLES} tables have mismatches" 1
    exit 1
fi
