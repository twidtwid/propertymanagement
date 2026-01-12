#!/bin/bash
# Pre-deployment checks to ensure safe production deployment
# Usage: ./scripts/pre-deploy-check.sh

set -e

echo "================================================"
echo "🔍 PRE-DEPLOYMENT CHECKS"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: Environment Variable Parity
echo "📋 Check 1: Environment Variable Parity"
echo "----------------------------------------"

DEV_VARS=$(grep -o '^[A-Z_]*=' .env.local 2>/dev/null | sort || echo "")
PROD_VARS=$(ssh root@143.110.229.185 "grep -o '^[A-Z_]*=' /root/app/.env.production 2>/dev/null" | sort || echo "")

NEW_VARS=$(comm -13 <(echo "$PROD_VARS") <(echo "$DEV_VARS"))

if [ -n "$NEW_VARS" ]; then
  echo -e "${RED}❌ FAIL: New environment variables detected in dev but missing in production:${NC}"
  echo "$NEW_VARS"
  echo ""
  echo -e "${YELLOW}Action required:${NC}"
  echo "  Add these variables to production .env.production:"
  for var in $NEW_VARS; do
    VAR_NAME="${var%=}"
    VAR_VALUE=$(grep "^${VAR_NAME}=" .env.local | cut -d'=' -f2-)
    echo "  ssh root@143.110.229.185 \"echo '${VAR_NAME}=<VALUE>' >> /root/app/.env.production\""
  done
  echo ""
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ PASS: All dev environment variables exist in production${NC}"
fi
echo ""

# Check 2: Uncommitted Changes
echo "📝 Check 2: Git Status"
echo "----------------------------------------"

if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Uncommitted changes detected:${NC}"
  git status --short
  echo ""
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ PASS: Working directory clean${NC}"
fi
echo ""

# Check 3: Build Test
echo "🔨 Check 3: Build Test"
echo "----------------------------------------"

if docker compose exec app npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS: Build successful${NC}"
else
  echo -e "${RED}❌ FAIL: Build failed${NC}"
  echo "  Run: docker compose exec app npm run build"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 4: Test Suite
echo "🧪 Check 4: Test Suite"
echo "----------------------------------------"

if docker compose exec app npm run test:run > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS: All tests passed${NC}"
else
  echo -e "${RED}❌ FAIL: Tests failed${NC}"
  echo "  Run: docker compose exec app npm run test:run"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 5: Critical Environment Variables
echo "🔑 Check 5: Critical Production Environment Variables"
echo "----------------------------------------"

CRITICAL_VARS=("NEST_PROJECT_ID" "GOOGLE_CLIENT_ID" "DATABASE_URL" "NEXTAUTH_SECRET" "TOKEN_ENCRYPTION_KEY")
MISSING_VARS=()

for var in "${CRITICAL_VARS[@]}"; do
  if ! ssh root@143.110.229.185 "grep -q '^${var}=' /root/app/.env.production 2>/dev/null"; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Critical variables missing in production:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ PASS: All critical environment variables present in production${NC}"
fi
echo ""

# Check 6: Production Health
echo "🏥 Check 6: Production Health"
echo "----------------------------------------"

HEALTH_STATUS=$(curl -s https://spmsystem.com/api/health | jq -r '.status' 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" = "ok" ]; then
  echo -e "${GREEN}✅ PASS: Production is healthy${NC}"
else
  echo -e "${YELLOW}⚠️  WARNING: Production health check returned: $HEALTH_STATUS${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "================================================"
echo "📊 SUMMARY"
echo "================================================"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ PRE-DEPLOYMENT CHECKS FAILED${NC}"
  echo "   Errors: $ERRORS"
  echo "   Warnings: $WARNINGS"
  echo ""
  echo "⚠️  DO NOT DEPLOY - Fix errors above first"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  PRE-DEPLOYMENT CHECKS PASSED WITH WARNINGS${NC}"
  echo "   Errors: $ERRORS"
  echo "   Warnings: $WARNINGS"
  echo ""
  echo "✓ Safe to deploy, but review warnings"
  exit 0
else
  echo -e "${GREEN}✅ ALL PRE-DEPLOYMENT CHECKS PASSED${NC}"
  echo "   No errors or warnings"
  echo ""
  echo "✓ Safe to deploy"
  exit 0
fi
