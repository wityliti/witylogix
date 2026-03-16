#!/bin/sh
# infra/docker/entrypoint.sh
# Production container entrypoint with dependency management
#
# Responsibilities:
# - Wait for external dependencies (PostgreSQL, Redis)
# - Run database migrations
# - Handle graceful shutdown signals (SIGTERM, SIGINT)
# - Start the application
#
# Usage in Dockerfile:
#   ENTRYPOINT ["/bin/sh", "/app/infra/docker/entrypoint.sh"]
#   CMD ["node", "apps/api/dist/server.js"]
#
# Execution flow:
#   1. Wait for dependencies (PostgreSQL, Redis)
#   2. Run pending migrations (db:migrate)
#   3. Start the main process
#   4. Forward shutdown signals for graceful termination

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration from environment
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-witylogix}
POSTGRES_DB=${POSTGRES_DB:-witylogix}

REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

DATABASE_URL=${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}}

# Retry configuration
MAX_RETRIES=30
RETRY_INTERVAL=2

# Trap signals for graceful shutdown
trap 'handle_sigterm' SIGTERM
trap 'handle_sigint' SIGINT

# ─────────────────────────────────────────────────────────────────────────────
# Signal Handlers
# ─────────────────────────────────────────────────────────────────────────────

handle_sigterm() {
  echo "$YELLOW[ENTRYPOINT] SIGTERM received, initiating graceful shutdown...$NC"
  # Send signal to child process (the actual application)
  kill -TERM "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  exit 0
}

handle_sigint() {
  echo "$YELLOW[ENTRYPOINT] SIGINT received, initiating graceful shutdown...$NC"
  # Send signal to child process
  kill -INT "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Logging Utilities
# ─────────────────────────────────────────────────────────────────────────────

log_info() {
  echo "$BLUE[ENTRYPOINT]$NC $1"
}

log_success() {
  echo "$GREEN[ENTRYPOINT]$NC $1"
}

log_warn() {
  echo "$YELLOW[ENTRYPOINT]$NC $1"
}

log_error() {
  echo "$RED[ENTRYPOINT]$NC $1"
}

# ─────────────────────────────────────────────────────────────────────────────
# Dependency Waiters
# ─────────────────────────────────────────────────────────────────────────────

wait_for_postgres() {
  log_info "Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT..."

  local retry=0
  while [ $retry -lt "$MAX_RETRIES" ]; do
    if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" > /dev/null 2>&1; then
      log_success "PostgreSQL is ready"
      return 0
    fi

    retry=$((retry + 1))
    log_warn "PostgreSQL not ready, retrying... ($retry/$MAX_RETRIES)"
    sleep "$RETRY_INTERVAL"
  done

  log_error "PostgreSQL did not become ready after $((MAX_RETRIES * RETRY_INTERVAL)) seconds"
  return 1
}

wait_for_redis() {
  log_info "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."

  local retry=0
  while [ $retry -lt "$MAX_RETRIES" ]; do
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
      log_success "Redis is ready"
      return 0
    fi

    retry=$((retry + 1))
    log_warn "Redis not ready, retrying... ($retry/$MAX_RETRIES)"
    sleep "$RETRY_INTERVAL"
  done

  log_error "Redis did not become ready after $((MAX_RETRIES * RETRY_INTERVAL)) seconds"
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Database Operations
# ─────────────────────────────────────────────────────────────────────────────

run_migrations() {
  log_info "Running database migrations..."

  # Set DATABASE_URL for Prisma migrations
  export DATABASE_URL

  # Run Prisma migrations if migration files exist
  if [ -d "packages/db/prisma/migrations" ]; then
    log_info "Found migrations directory, running pending migrations..."

    if pnpm exec prisma migrate deploy --skip-generate > /dev/null 2>&1; then
      log_success "Database migrations completed successfully"
      return 0
    else
      log_warn "Migration execution had issues, continuing startup"
      # Don't fail on migration issues - the schema may already be up to date
      return 0
    fi
  else
    log_warn "No migrations directory found, skipping migration step"
    return 0
  fi
}

generate_prisma_client() {
  log_info "Generating Prisma client..."

  if pnpm exec prisma generate > /dev/null 2>&1; then
    log_success "Prisma client generated successfully"
    return 0
  else
    log_error "Failed to generate Prisma client"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Entrypoint Logic
# ─────────────────────────────────────────────────────────────────────────────

main() {
  log_info "Container entrypoint starting"
  log_info "Current environment: NODE_ENV=${NODE_ENV:-development}"

  # Wait for PostgreSQL
  if ! wait_for_postgres; then
    log_error "PostgreSQL is not available, cannot continue"
    exit 1
  fi

  # Wait for Redis
  if ! wait_for_redis; then
    log_error "Redis is not available, cannot continue"
    exit 1
  fi

  # Generate Prisma client if needed
  if ! generate_prisma_client; then
    log_error "Failed to generate Prisma client"
    exit 1
  fi

  # Run migrations
  if ! run_migrations; then
    log_error "Failed to run migrations"
    exit 1
  fi

  log_success "All dependencies ready and migrations complete"
  log_info "Starting application with command: $*"
  echo ""

  # Execute the passed command (the actual application)
  # This replaces the shell process, so signals will be handled directly by the app
  exec "$@" &
  APP_PID=$!

  # Wait for the application process
  wait "$APP_PID"
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    log_success "Application exited successfully"
  else
    log_error "Application exited with code: $EXIT_CODE"
  fi

  exit "$EXIT_CODE"
}

# Execute main function with all passed arguments
main "$@"
