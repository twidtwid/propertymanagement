#!/bin/bash
# Send Pushover notification from command line
# Usage: ./scripts/notify.sh "message" ["title"] [priority]
#
# Examples:
#   ./scripts/notify.sh "Build complete"
#   ./scripts/notify.sh "Deploy finished" "Property Management"
#   ./scripts/notify.sh "URGENT: Server down" "Alert" 1

set -e

# Load environment from .env.local if it exists
if [ -f "$(dirname "$0")/../.env.local" ]; then
  export $(grep -v '^#' "$(dirname "$0")/../.env.local" | xargs)
fi

MESSAGE="${1:?Usage: notify.sh \"message\" [\"title\"] [priority]}"
TITLE="${2:-Property Management}"
PRIORITY="${3:-0}"

if [ -z "$PUSHOVER_TOKEN" ]; then
  echo "Error: PUSHOVER_TOKEN not set"
  exit 1
fi

send_notification() {
  local USER_KEY="$1"
  local USER_NAME="$2"

  if [ -z "$USER_KEY" ]; then
    echo "Skipping $USER_NAME (no user key configured)"
    return
  fi

  RESPONSE=$(curl -s -X POST https://api.pushover.net/1/messages.json \
    -d "token=$PUSHOVER_TOKEN" \
    -d "user=$USER_KEY" \
    -d "title=$TITLE" \
    -d "message=$MESSAGE" \
    -d "priority=$PRIORITY")

  if echo "$RESPONSE" | grep -q '"status":1'; then
    echo "Sent to $USER_NAME"
  else
    echo "Failed to send to $USER_NAME: $RESPONSE"
  fi
}

send_notification "$PUSHOVER_USER_ANNE" "Anne"
send_notification "$PUSHOVER_USER_TODD" "Todd"
