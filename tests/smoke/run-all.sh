#!/usr/bin/env bash
# Master production smoke test runner for all Railway-deployed Witylogix services
#
# Usage:
#   ./tests/smoke/run-all.sh
#
# Required env vars (set at least one):
#   API_BASE_URL            - e.g. https://api.witylogix.io
#   CUSTOMER_PORTAL_BASE_URL - e.g. https://portal.witylogix.io
#   DASHBOARD_BASE_URL      - e.g. https://dashboard.witylogix.io
#   TRACKING_PAGE_BASE_URL  - e.g. https://track.witylogix.io
#   SHOPIFY_APP_BASE_URL    - e.g. https://shopify.witylogix.io
#   DOCS_BASE_URL           - e.g. https://docs.witylogix.io
#
# Defaults fall back to localhost ports used in local dev.
# Exit code 0 = all pass, non-zero = one or more services failed.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

OVERALL_FAILED=0

run_service_smoke() {
  local service_name="$1"
  local script="$SCRIPT_DIR/$2"
  shift 2
  local env_pairs=("$@")   # KEY=VALUE pairs to export for the child script

  if [[ ! -x "$script" ]]; then
    chmod +x "$script"
  fi

  # Export service-specific env vars
  local env_cmd=""
  for pair in "${env_pairs[@]}"; do
    env_cmd+="$pair "
  done

  echo -e "${BLUE}▶ $service_name${NC}"
  if env $env_cmd bash "$script"; then
    echo ""
  else
    OVERALL_FAILED=$((OVERALL_FAILED + 1))
    echo ""
  fi
}

echo ""
echo "════════════════════════════════════════════════════"
echo " Witylogix Platform — Production Smoke Tests"
echo "════════════════════════════════════════════════════"
echo ""

run_service_smoke "API" "api.sh" \
  "BASE_URL=${API_BASE_URL:-http://localhost:8000}"

run_service_smoke "Customer Portal" "customer-portal.sh" \
  "BASE_URL=${CUSTOMER_PORTAL_BASE_URL:-http://localhost:3002}"

run_service_smoke "Dashboard" "dashboard.sh" \
  "BASE_URL=${DASHBOARD_BASE_URL:-http://localhost:3000}" \
  "API_BASE_URL=${API_BASE_URL:-http://localhost:8000}"

run_service_smoke "Tracking Page" "tracking-page.sh" \
  "BASE_URL=${TRACKING_PAGE_BASE_URL:-http://localhost:3003}"

run_service_smoke "Shopify App" "shopify-app.sh" \
  "BASE_URL=${SHOPIFY_APP_BASE_URL:-http://localhost:3004}"

run_service_smoke "Docs" "docs.sh" \
  "BASE_URL=${DOCS_BASE_URL:-http://localhost:3001}"

echo "════════════════════════════════════════════════════"
if [[ $OVERALL_FAILED -eq 0 ]]; then
  echo -e " ${GREEN}All services healthy — smoke tests passed${NC}"
else
  echo -e " ${RED}${OVERALL_FAILED} service(s) failed smoke tests${NC}"
fi
echo "════════════════════════════════════════════════════"
echo ""

exit $OVERALL_FAILED
