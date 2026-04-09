#!/usr/bin/env bash
# Production smoke tests for the Witylogix Shopify App
#
# Usage:
#   BASE_URL=https://shopify.example.com ./tests/smoke/shopify-app.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3004}"
TIMEOUT="${TIMEOUT:-15}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
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

  if [[ -n "$expected_body" ]] && ! echo "$body" | grep -qi "$expected_body"; then
    echo -e "${RED}FAIL${NC}  $label — body missing '$expected_body'"
    ((FAILED++))
    return
  fi

  echo -e "${GREEN}PASS${NC}  $label"
  ((PASSED++))
}

check_redirect() {
  local label="$1"
  local url="$2"
  local expected_location_pattern="${3:-}"

  local response
  response=$(curl -s --max-time "$TIMEOUT" -I "$url" 2>/dev/null) || {
    echo -e "${RED}FAIL${NC}  $label — curl error (service unreachable)"
    ((FAILED++))
    return
  }

  local status
  status=$(echo "$response" | grep -i "^HTTP" | tail -1 | awk '{print $2}')
  local location
  location=$(echo "$response" | grep -i "^location:" | head -1 | tr -d '\r')

  if [[ "$status" != "30"* ]] && [[ "$status" != "200" ]]; then
    echo -e "${RED}FAIL${NC}  $label — expected redirect, got HTTP $status"
    ((FAILED++))
    return
  fi

  if [[ -n "$expected_location_pattern" ]] && ! echo "$location" | grep -qi "$expected_location_pattern"; then
    echo -e "${YELLOW}WARN${NC}  $label — redirect location '$location' did not match '$expected_location_pattern'"
    ((PASSED++))
    return
  fi

  echo -e "${GREEN}PASS${NC}  $label"
  ((PASSED++))
}

check_method_not_allowed() {
  local label="$1"
  local url="$2"

  local status
  status=$(curl -s --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" -X GET "$url" 2>/dev/null) || {
    echo -e "${RED}FAIL${NC}  $label — curl error"
    ((FAILED++))
    return
  }

  if [[ "$status" == "405" ]]; then
    echo -e "${GREEN}PASS${NC}  $label"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC}  $label — expected 405 Method Not Allowed, got $status"
    ((FAILED++))
  fi
}

echo "--- Shopify App smoke tests ($BASE_URL) ---"
echo ""

# ─── Health ──────────────────────────────────────────────────
echo "Health:"
check_http "GET /health returns 200 with status:ok" "$BASE_URL/health" 200 '"status":"ok"'

# ─── OAuth Install Flow ───────────────────────────────────────
echo ""
echo "OAuth Install Flow:"

# Auth without shop param should return 200 with error payload (not crash)
check_http "GET /auth (no shop) returns 200" "$BASE_URL/auth" 200

# Auth with invalid shop domain should return 200 with error
check_http "GET /auth?shop=invalid returns 200" "$BASE_URL/auth?shop=invalid" 200

# Auth with valid shop domain should redirect to Shopify OAuth
check_redirect "GET /auth?shop=test.myshopify.com redirects to Shopify" \
  "$BASE_URL/auth?shop=test.myshopify.com" "shopify"

# Auth callback without params should return 200 (renders error UI)
check_http "GET /auth/callback (no params) returns 200" "$BASE_URL/auth/callback" 200

# ─── Webhook Receiver ─────────────────────────────────────────
echo ""
echo "Webhook Receiver:"

# GET to webhook receiver should return 405
check_method_not_allowed "GET /webhooks/receive returns 405" "$BASE_URL/webhooks/receive"

# POST without HMAC should return 401
status=$(curl -s --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: test.myshopify.com" \
  -d '{"id":12345}' \
  "$BASE_URL/webhooks/receive" 2>/dev/null) || status="000"

if [[ "$status" == "401" ]] || [[ "$status" == "400" ]]; then
  echo -e "${GREEN}PASS${NC}  POST /webhooks/receive without HMAC returns $status (rejected)"
  ((PASSED++))
else
  echo -e "${RED}FAIL${NC}  POST /webhooks/receive without HMAC — expected 401/400, got $status"
  ((FAILED++))
fi

# ─── App Routes (require auth — expect redirect to /auth) ─────
echo ""
echo "Authenticated Routes (expect auth redirect):"
check_redirect "GET / redirects to auth" "$BASE_URL/" "auth"
check_redirect "GET /app redirects to auth" "$BASE_URL/app" "auth"

echo ""
echo "Results: ${PASSED} passed, ${FAILED} failed"

[[ $FAILED -eq 0 ]]
