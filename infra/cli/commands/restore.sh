#!/usr/bin/env bash
#
# Witylogix Restore Command — Restore from backup archive
#
# Validates backup file, confirms destructive operation, stops application
# services, restores database and .env, then restarts and health-checks
#
# Usage:
#   ./witylogix restore <backup-file> [options]
#
# Options:
#   --force           Skip user confirmation (dangerous!)
#   --dry-run         Show what would be restored without doing it
#   -h, --help        Show this help
#
# Examples:
#   ./witylogix restore /opt/witylogix/backups/witylogix-backup-20260310-143022.tar.gz
#   ./witylogix restore backup.tar.gz --force
#   ./witylogix restore backup.tar.gz --dry-run
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd "$INFRA_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix-restore]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix-restore]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix-restore]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }
log_debug() { echo -e "${BLUE}  ⊙${NC} $1"; }

# Configuration
POSTGRES_CONTAINER="witylogix-postgres"
DOCKER_COMPOSE_FILE="${INFRA_DIR}/docker-compose.yml"
BACKUP_FILE=""
FORCE_RESTORE=false
DRY_RUN=false

# Services to stop/restart (order matters - stop reverse order)
SERVICES=("api" "dashboard")

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE_RESTORE=true
      shift ;;
    --dry-run)
      DRY_RUN=true
      shift ;;
    -h|--help)
      grep "^#" "$0" | head -30
      exit 0 ;;
    -*)
      log_error "Unknown option: $1"
      exit 1 ;;
    *)
      if [[ -z "$BACKUP_FILE" ]]; then
        BACKUP_FILE="$1"
      fi
      shift ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────
if [[ -z "$BACKUP_FILE" ]]; then
  log_error "No backup file specified"
  echo ""
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Handle relative paths
if [[ "$BACKUP_FILE" != /* ]]; then
  BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Validate backup file format (tar.gz)
if ! file "$BACKUP_FILE" | grep -q "gzip compressed data"; then
  log_error "Invalid backup file format. Expected gzip compressed tar archive."
  file "$BACKUP_FILE"
  exit 1
fi

log_info "Restore operation detected"
log_debug "Backup file: $BACKUP_FILE"
log_debug "File size: $(du -h "$BACKUP_FILE" | cut -f1)"

# ─────────────────────────────────────────────────────────────────────────────
# Check if PostgreSQL container is running
# ─────────────────────────────────────────────────────────────────────────────
if ! docker ps --filter "name=${POSTGRES_CONTAINER}" --format "{{.Names}}" | grep -q "${POSTGRES_CONTAINER}"; then
  log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running."
  echo ""
  echo "Start containers with:"
  echo "  cd $ROOT_DIR && docker compose -f $DOCKER_COMPOSE_FILE up -d"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Show what will be restored
# ─────────────────────────────────────────────────────────────────────────────
log_cmd "Examining backup contents..."

local temp_dir
temp_dir=$(mktemp -d)
trap "rm -rf $temp_dir" EXIT

tar -tzf "$BACKUP_FILE" > "$temp_dir/contents.txt" 2>/dev/null || {
  log_error "Failed to read backup contents"
  exit 1
}

echo ""
log_info "Backup contains:"

if grep -q "database.dump" "$temp_dir/contents.txt"; then
  log_debug "✓ Database dump (database.dump)"
fi
if grep -q "\.env" "$temp_dir/contents.txt"; then
  log_debug "✓ Environment file (.env)"
fi
if grep -q "docker-compose.override.yml" "$temp_dir/contents.txt"; then
  log_debug "✓ Docker Compose overrides (docker-compose.override.yml)"
fi
if grep -q "backup.metadata" "$temp_dir/contents.txt"; then
  log_debug "✓ Backup metadata"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Confirm restore (destructive operation)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
log_warn "DESTRUCTIVE OPERATION: This will overwrite the current database!"
echo ""

if [[ "$DRY_RUN" = true ]]; then
  log_info "DRY-RUN MODE: No changes will be made"
  echo ""
  exit 0
fi

if [[ "$FORCE_RESTORE" = false ]]; then
  local response
  read -r -p "Type 'yes' to confirm restore: " response
  if [[ "$response" != "yes" ]]; then
    log_warn "Restore cancelled"
    exit 0
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Extract backup to temporary directory
# ─────────────────────────────────────────────────────────────────────────────
log_info "Extracting backup..."

if ! tar -xzf "$BACKUP_FILE" -C "$temp_dir" 2>/dev/null; then
  log_error "Failed to extract backup archive"
  exit 1
fi

log_debug "Backup extracted to temporary directory"

# ─────────────────────────────────────────────────────────────────────────────
# Stop application services
# ─────────────────────────────────────────────────────────────────────────────
log_info "Stopping application services..."

for service in "${SERVICES[@]}"; do
  if docker ps --filter "name=witylogix-${service}" --format "{{.Names}}" | grep -q "witylogix-${service}"; then
    log_cmd "Stopping $service..."
    docker compose -f "$DOCKER_COMPOSE_FILE" stop "$service" 2>/dev/null || log_warn "Failed to stop $service"
  fi
done

sleep 2

# ─────────────────────────────────────────────────────────────────────────────
# Restore database
# ─────────────────────────────────────────────────────────────────────────────
log_info "Restoring database..."

if [[ ! -f "$temp_dir/database.dump" ]]; then
  log_error "database.dump not found in backup"
  exit 1
fi

# Get PostgreSQL credentials
local pg_user
local pg_password
local pg_db

pg_user=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo "witylogix")
pg_password=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_PASSWORD 2>/dev/null || echo "witylogix_dev")
pg_db=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_DB 2>/dev/null || echo "witylogix")

log_cmd "Running pg_restore (clean, if-exists)..."

# Copy dump file to container and restore
docker cp "$temp_dir/database.dump" "$POSTGRES_CONTAINER:/tmp/database.dump" 2>/dev/null || {
  log_error "Failed to copy backup to PostgreSQL container"
  exit 1
}

if ! PGPASSWORD="$pg_password" docker exec "$POSTGRES_CONTAINER" pg_restore \
  --username="$pg_user" \
  --clean \
  --if-exists \
  --verbose \
  /tmp/database.dump 2>/dev/null; then
  log_error "pg_restore failed"
  exit 1
fi

# Clean up copied file
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/database.dump 2>/dev/null || true

log_debug "Database restore completed"

# ─────────────────────────────────────────────────────────────────────────────
# Restore .env if included
# ─────────────────────────────────────────────────────────────────────────────
if [[ -f "$temp_dir/.env" ]]; then
  log_cmd "Restoring .env file..."

  # Backup current .env if it exists
  if [[ -f "$ROOT_DIR/.env" ]]; then
    cp "$ROOT_DIR/.env" "$ROOT_DIR/.env.backup.$(date +%s)" 2>/dev/null || true
  fi

  cp "$temp_dir/.env" "$ROOT_DIR/.env" 2>/dev/null || {
    log_error "Failed to restore .env"
    exit 1
  }

  log_debug ".env file restored"
  log_warn "Review .env file to ensure it's correct for this environment"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Restore docker-compose overrides if included
# ─────────────────────────────────────────────────────────────────────────────
if [[ -f "$temp_dir/docker-compose.override.yml" ]]; then
  log_cmd "Restoring docker-compose.override.yml..."

  # Backup current override if it exists
  if [[ -f "$ROOT_DIR/docker-compose.override.yml" ]]; then
    cp "$ROOT_DIR/docker-compose.override.yml" \
      "$ROOT_DIR/docker-compose.override.yml.backup.$(date +%s)" 2>/dev/null || true
  fi

  cp "$temp_dir/docker-compose.override.yml" "$ROOT_DIR/docker-compose.override.yml" 2>/dev/null || {
    log_error "Failed to restore docker-compose.override.yml"
    exit 1
  }

  log_debug "docker-compose.override.yml restored"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Wait for PostgreSQL to be ready
# ─────────────────────────────────────────────────────────────────────────────
log_info "Waiting for PostgreSQL to be ready..."

local max_attempts=30
local attempt=0

while ! docker exec "$POSTGRES_CONTAINER" pg_isready -U "$pg_user" &>/dev/null; do
  attempt=$((attempt + 1))
  if [[ $attempt -ge $max_attempts ]]; then
    log_error "PostgreSQL failed to become ready after $max_attempts attempts"
    exit 1
  fi
  sleep 2
done

log_debug "PostgreSQL is ready"

# ─────────────────────────────────────────────────────────────────────────────
# Start application services
# ─────────────────────────────────────────────────────────────────────────────
log_info "Starting application services..."

for service in "${SERVICES[@]}"; do
  log_cmd "Starting $service..."
  docker compose -f "$DOCKER_COMPOSE_FILE" up -d "$service" 2>/dev/null || log_warn "Failed to start $service"
done

# ─────────────────────────────────────────────────────────────────────────────
# Health check services
# ─────────────────────────────────────────────────────────────────────────────
log_info "Performing health checks..."

# Health check for API
log_cmd "Checking API health..."
local api_healthy=false
for i in {1..30}; do
  if docker exec witylogix-api curl -f http://localhost:3001/health &>/dev/null; then
    api_healthy=true
    log_debug "API is healthy"
    break
  fi
  sleep 2
done

if [[ "$api_healthy" = false ]]; then
  log_warn "API failed health check. Check logs with: docker logs witylogix-api"
fi

# Health check for Dashboard
log_cmd "Checking Dashboard health..."
local dashboard_healthy=false
for i in {1..30}; do
  if docker exec witylogix-dashboard curl -f http://localhost:3000/ &>/dev/null; then
    dashboard_healthy=true
    log_debug "Dashboard is healthy"
    break
  fi
  sleep 2
done

if [[ "$dashboard_healthy" = false ]]; then
  log_warn "Dashboard failed health check. Check logs with: docker logs witylogix-dashboard"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Print restore summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
log_info "Restore completed!"
echo ""
echo "Summary:"
echo "  Backup file:    $(basename "$BACKUP_FILE")"
echo "  Database:       Restored"
echo "  Environment:    $([ -f "$temp_dir/.env" ] && echo "Restored" || echo "Not included")"
echo "  API status:     $([ "$api_healthy" = true ] && echo "✓ Healthy" || echo "⚠ Check logs")"
echo "  Dashboard:      $([ "$dashboard_healthy" = true ] && echo "✓ Healthy" || echo "⚠ Check logs")"
echo ""

if [[ "$api_healthy" = false || "$dashboard_healthy" = false ]]; then
  echo "Troubleshooting:"
  echo "  docker logs witylogix-api"
  echo "  docker logs witylogix-dashboard"
  echo "  docker compose -f $DOCKER_COMPOSE_FILE ps"
  echo ""
fi

echo "Verify restore with:"
echo "  curl http://localhost:3001/health"
echo "  curl http://localhost:3000/"
echo ""
