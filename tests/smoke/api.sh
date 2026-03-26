#!/usr/bin/env bash
# Production smoke tests for the Witylogix API service
#
# Usage:
#   BASE_URL=https://api.example.com ./tests/smoke/api.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
TIMEOUT="${TIMEOUT:-10}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

check_http() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local expected_body="${4:-}"

  local response
  response=$(curl -sf --max-time "$TIMEOUT" -w "\n%{http_code}" "$url" 2>/dev/null) || {
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

  if [[ -n "$expected_body" ]] && ! echo "$body" | grep -q "$expected_body"; then
    echo -e "${RED}FAIL${NC}  $label — body missing '$expected_body' (got: ${body:0:120})"
    ((FAILED++))
    return
  fi

  echo -e "${GREEN}PASS${NC}  $label"
  ((PASSED++))
}

echo "--- API smoke tests ($BASE_URL) ---"

check_http "GET /health returns 200 with status:ok"       "$BASE_URL/health"        200 '"status":"ok"'
check_http "GET /health/ready returns 200"                "$BASE_URL/health/ready"  200
check_http "GET /health/deep returns 200"                 "$BASE_URL/health/deep"   200

echo ""
echo "Results: ${PASSED} passed, ${FAILED} failed"

[[ $FAILED -eq 0 ]]
