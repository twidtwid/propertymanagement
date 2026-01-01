#!/bin/bash
#
# Property Management Database Backup Script
#
# Creates compressed PostgreSQL backups and manages retention.
# Optionally uploads to DigitalOcean Spaces for offsite storage.
#
# Usage:
#   ./scripts/backup-db.sh                    # Manual backup
#   ./scripts/backup-db.sh --upload-spaces    # Backup and upload to DO Spaces
#
# Crontab entry (daily at 2 AM):
#   0 2 * * * /home/deploy/app/scripts/backup-db.sh >> /var/log/backup.log 2>&1
#
# Requirements:
#   - Docker Compose running with 'db' service
#   - Write access to BACKUP_DIR
#   - (Optional) s3cmd configured for DO Spaces upload

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-propman}"
DB_NAME="${DB_NAME:-propertymanagement}"

# DigitalOcean Spaces configuration (optional)
DO_SPACES_BUCKET="${DO_SPACES_BUCKET:-}"
DO_SPACES_ENDPOINT="${DO_SPACES_ENDPOINT:-nyc3.digitaloceanspaces.com}"

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

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date '+%Y-%m-%d_%H%M%S')
BACKUP_FILE="propertymanagement_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

log "Starting database backup..."
log "  Database: ${DB_NAME}"
log "  User: ${DB_USER}"
log "  Output: ${BACKUP_PATH}"

# Change to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

# Check if Docker Compose is running
if ! docker compose -f "${COMPOSE_FILE}" ps --status running "${DB_SERVICE}" | grep -q "${DB_SERVICE}"; then
    log_error "Database service '${DB_SERVICE}' is not running"
    exit 1
fi

# Create backup using pg_dump inside the container
log "Dumping database..."
if docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner \
    | gzip > "${BACKUP_PATH}"; then

    # Verify backup file exists and has content
    if [[ -f "${BACKUP_PATH}" && -s "${BACKUP_PATH}" ]]; then
        BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
        log_success "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
    else
        log_error "Backup file is empty or missing"
        rm -f "${BACKUP_PATH}"
        exit 1
    fi
else
    log_error "pg_dump failed"
    rm -f "${BACKUP_PATH}"
    exit 1
fi

# Upload to DigitalOcean Spaces if configured and requested
if [[ "$*" == *"--upload-spaces"* ]] && [[ -n "${DO_SPACES_BUCKET}" ]]; then
    log "Uploading to DigitalOcean Spaces..."

    if command -v s3cmd &> /dev/null; then
        if s3cmd put "${BACKUP_PATH}" "s3://${DO_SPACES_BUCKET}/backups/${BACKUP_FILE}" \
            --host="${DO_SPACES_ENDPOINT}" \
            --host-bucket="%(bucket)s.${DO_SPACES_ENDPOINT}"; then
            log_success "Uploaded to Spaces: s3://${DO_SPACES_BUCKET}/backups/${BACKUP_FILE}"
        else
            log_warning "Failed to upload to Spaces (backup saved locally)"
        fi
    else
        log_warning "s3cmd not installed, skipping Spaces upload"
    fi
fi

# Clean up old backups (local)
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=0
while IFS= read -r -d '' old_backup; do
    rm -f "$old_backup"
    log "  Deleted: $(basename "$old_backup")"
    ((DELETED_COUNT++))
done < <(find "${BACKUP_DIR}" -name "propertymanagement_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -print0)

if [[ $DELETED_COUNT -gt 0 ]]; then
    log_success "Cleaned up ${DELETED_COUNT} old backup(s)"
else
    log "No old backups to clean up"
fi

# Clean up old backups from Spaces if configured
if [[ "$*" == *"--upload-spaces"* ]] && [[ -n "${DO_SPACES_BUCKET}" ]] && command -v s3cmd &> /dev/null; then
    log "Cleaning up old Spaces backups..."
    CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" '+%Y-%m-%d' 2>/dev/null || date -v-${RETENTION_DAYS}d '+%Y-%m-%d')

    s3cmd ls "s3://${DO_SPACES_BUCKET}/backups/" \
        --host="${DO_SPACES_ENDPOINT}" \
        --host-bucket="%(bucket)s.${DO_SPACES_ENDPOINT}" 2>/dev/null | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}')
        FILE_PATH=$(echo "$line" | awk '{print $4}')

        if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
            s3cmd del "${FILE_PATH}" \
                --host="${DO_SPACES_ENDPOINT}" \
                --host-bucket="%(bucket)s.${DO_SPACES_ENDPOINT}" 2>/dev/null && \
                log "  Deleted from Spaces: $(basename "${FILE_PATH}")"
        fi
    done
fi

# Create symlink to latest backup
ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql.gz"

# Summary
log ""
log "=========================================="
log_success "Backup complete!"
log "  File: ${BACKUP_PATH}"
log "  Size: ${BACKUP_SIZE}"
log "  Symlink: ${BACKUP_DIR}/latest.sql.gz"
log "=========================================="

# Restore instructions
log ""
log "To restore this backup:"
log "  1. Stop the app: docker compose -f docker-compose.prod.yml stop app email-sync daily-summary"
log "  2. Restore: gunzip -c ${BACKUP_PATH} | docker compose -f docker-compose.prod.yml exec -T db psql -U ${DB_USER} -d ${DB_NAME}"
log "  3. Start the app: docker compose -f docker-compose.prod.yml up -d"
