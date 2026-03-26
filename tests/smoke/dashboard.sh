#!/usr/bin/env bash
# Production smoke tests for the Witylogix Dashboard
#
# Usage:
#   BASE_URL=https://dashboard.example.com \
#   API_BASE_URL=https://api.example.com \
#   ./tests/smoke/dashboard.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
TIMEOUT="${TIMEOUT:-15}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASSED=0
FAILED=0

check_http() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local expected_body="${4:-}"

  local response
  response=$(curl -sf --max-time "$TIMEOUT" -w "\n%{http_code}" -L "$url" 2>/dev/null) || {
    echo -e "${RED}FAIL${NC}  $label — curl error (service unreachable)"
    ((FAILED++))
    return
  }

  local body
  body=$(echo "$response" | head -n -1)
  local status
  status=$(echo "$response" | tail -n 1)

  if [[ "$status" != "$expected_status" ]]; then
    echo -e "${RED}FAIL${NC}  $label — expected HTTP $expected_status, got $status"
    ((FAILED++))
    return
  fi

  if [[ -n "$expected_body" ]] && ! echo "$body" | grep -qi "$expected_body"; then
    echo -e "${RED}FAIL${NC}  $label — body missing '$expected_body'"
    ((FAILED++))
    return
  fi

  echo -e "${GREEN}PASS${NC}  $label"
  ((PASSED++))
}

echo "--- Dashboard smoke tests ($BASE_URL) ---"

check_http "Login page loads (HTTP 200)"   "$BASE_URL/login" 200 "<html"
check_http "API connectivity (health)"     "$API_BASE_URL/health" 200 '"status":"ok"'

echo ""
echo "Results: ${PASSED} passed, ${FAILED} failed"

[[ $FAILED -eq 0 ]]
