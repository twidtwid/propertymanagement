#!/bin/bash
# Hourly monitor script to check if Nest Legacy cameras are working
# Run this every hour to verify token hasn't expired

LOG_FILE="/tmp/nest-camera-monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Checking Nest Legacy cameras..." | tee -a "$LOG_FILE"

# Test Garage camera (f0bc9318-5714-4123-b2af-89a31d9af63d)
GARAGE_RESPONSE=$(docker compose logs app --tail 50 2>&1 | grep -c "✓ Fetched snapshot for Garage")

# Test Entryway camera (39b64c49-de42-45ce-a105-2e4e75ef72c2)
ENTRYWAY_RESPONSE=$(docker compose logs app --tail 50 2>&1 | grep -c "✓ Fetched snapshot for Entryway")

# Check for 403 errors
ERROR_403=$(docker compose logs app --tail 50 2>&1 | grep -c "Dropcam API error: 403")

if [ "$GARAGE_RESPONSE" -gt 0 ] && [ "$ENTRYWAY_RESPONSE" -gt 0 ]; then
    echo "[$TIMESTAMP] ✅ Both cameras working (Garage: $GARAGE_RESPONSE, Entryway: $ENTRYWAY_RESPONSE)" | tee -a "$LOG_FILE"
    exit 0
elif [ "$ERROR_403" -gt 0 ]; then
    echo "[$TIMESTAMP] ❌ TOKEN EXPIRED - 403 errors detected ($ERROR_403 occurrences)" | tee -a "$LOG_FILE"
    echo "[$TIMESTAMP] ACTION REQUIRED: Token needs refresh" | tee -a "$LOG_FILE"
    exit 1
else
    echo "[$TIMESTAMP] ⚠️  No recent camera activity detected" | tee -a "$LOG_FILE"
    exit 0
fi
