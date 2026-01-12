#!/bin/bash
# Automatic monitoring script that runs continuously
# Checks cameras every hour and alerts if they fail

LOG_FILE="/tmp/nest-camera-monitor.log"

echo "Starting Nest Legacy camera monitor..."
echo "Checking every hour. Log file: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] Running check..."

    # Run the monitoring script
    npm run nest:monitor

    # Check exit code
    if [ $? -eq 1 ]; then
        echo "[$TIMESTAMP] ⚠️  ALERT: Token may have expired!"
        echo "[$TIMESTAMP] Check http://localhost:3000/cameras"
        echo "[$TIMESTAMP] If cameras are down, run: npm run nest:setup-refresh"
    fi

    # Wait 1 hour (3600 seconds)
    echo "[$TIMESTAMP] Next check in 1 hour..."
    sleep 3600
done
