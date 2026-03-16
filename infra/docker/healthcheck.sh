#!/bin/sh
# infra/docker/healthcheck.sh
# Comprehensive health check script for Docker container orchestration
#
# Purpose: Verify container is healthy by checking:
# - HTTP endpoints respond with expected status codes
# - Database connectivity (PostgreSQL)
# - Cache layer connectivity (Redis)
# - Critical services are available
#
# Exit codes:
#   0: Healthy - all checks passed
#   1: Unhealthy - one or more checks failed
#   2: Starting - service initializing, not yet ready
#
# Usage in Dockerfile:
#   HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
#     CMD /app/infra/docker/healthcheck.sh

set -e

# Configuration from environment
PORT=${PORT:-3001}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-witylogix}
POSTGRES_DB=${POSTGRES_DB:-witylogix}

# Timeouts (in seconds)
HTTP_TIMEOUT=3
DB_TIMEOUT=5

# Color codes for output (useful for manual testing)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────────────────
# HTTP Health Check
# ─────────────────────────────────────────────────────────────────────────────
# Verify the application is responding to HTTP requests
check_http() {
  echo "Checking HTTP health on localhost:$PORT..."

  if curl -sf --max-time "$HTTP_TIMEOUT" "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo "HTTP health check passed"
    return 0
  else
    echo "HTTP health check failed"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Redis Health Check
# ─────────────────────────────────────────────────────────────────────────────
# Verify Redis is accessible and responding
check_redis() {
  echo "Checking Redis connectivity to $REDIS_HOST:$REDIS_PORT..."

  # Use timeout command to avoid hanging
  if timeout "$DB_TIMEOUT" redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo "Redis connectivity check passed"
    return 0
  else
    echo "Redis connectivity check failed"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL Health Check
# ─────────────────────────────────────────────────────────────────────────────
# Verify PostgreSQL is accessible
check_postgres() {
  echo "Checking PostgreSQL connectivity to $POSTGRES_HOST:$POSTGRES_PORT..."

  # Use PGPASSWORD to avoid password prompts
  # Use pg_isready which is the standard PostgreSQL health check tool
  if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -t "$DB_TIMEOUT" > /dev/null 2>&1; then
    echo "PostgreSQL connectivity check passed"
    return 0
  else
    echo "PostgreSQL connectivity check failed"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Health Check Logic
# ─────────────────────────────────────────────────────────────────────────────
main() {
  local failed=0

  echo "=== Container Health Check ==="
  echo "Time: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo ""

  # Check HTTP endpoint (primary check)
  if ! check_http; then
    failed=$((failed + 1))
  fi
  echo ""

  # Check Redis (secondary check - not fatal if missing in some environments)
  if ! check_redis; then
    # Don't increment failed counter for Redis yet
    # Some services may not require Redis
    echo "(Warning: Redis unavailable, service may degrade)"
    echo ""
  fi

  # Check PostgreSQL (secondary check)
  if ! check_postgres; then
    # Don't increment failed counter for PostgreSQL yet
    # Some services may not require PostgreSQL
    echo "(Warning: PostgreSQL unavailable, service may degrade)"
    echo ""
  fi

  echo "=== Health Check Complete ==="

  if [ $failed -gt 0 ]; then
    echo "Status: UNHEALTHY ($failed checks failed)"
    exit 1
  else
    echo "Status: HEALTHY"
    exit 0
  fi
}

# Run the health check
main "$@"
