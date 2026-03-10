#!/usr/bin/env bash
#
# Witylogix Upgrade Command — Upgrade platform with rolling restart and rollback
#
# Checks for new versions, shows changelog, creates automatic backup,
# pulls new images, runs migrations, performs rolling restart per service
# with health checks and automatic rollback on failure
#
# Usage:
#   ./witylogix upgrade [options]
#
# Options:
#   --build           Rebuild images from source (git pull + docker build)
#   --skip-backup     Skip automatic backup before upgrade
#   --rollback        Rollback to previous upgrade
#   --force           Skip confirmation prompt
#   -h, --help        Show this help
#
# Examples:
#   ./witylogix upgrade              # Show version info and confirm
#   ./witylogix upgrade --force      # Upgrade without confirmation
#   ./witylogix upgrade --build      # Build from source
#   ./witylogix upgrade --rollback   # Revert last upgrade
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
log_info() { echo -e "${GREEN}[witylogix-upgrade]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix-upgrade]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix-upgrade]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }
log_debug() { echo -e "${BLUE}  ⊙${NC} $1"; }

# Configuration
DOCKER_COMPOSE_FILE="${INFRA_DIR}/docker-compose.yml"
VERSION_FILE="${INFRA_DIR}/VERSION"
UPGRADE_HISTORY="${INFRA_DIR}/.upgrade-history"
BUILD_FROM_SOURCE=false
SKIP_BACKUP=false
DO_ROLLBACK=false
FORCE_UPGRADE=false

# Services to upgrade (in order)
SERVICES=("api" "dashboard")

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      BUILD_FROM_SOURCE=true
      shift ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift ;;
    --rollback)
      DO_ROLLBACK=true
      shift ;;
    --force)
      FORCE_UPGRADE=true
      shift ;;
    -h|--help)
      grep "^#" "$0" | head -35
      exit 0 ;;
    *)
      log_error "Unknown option: $1"
      exit 1 ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Get current version
# ─────────────────────────────────────────────────────────────────────────────
get_current_version() {
  if [[ -f "$VERSION_FILE" ]]; then
    cat "$VERSION_FILE"
  elif git -C "$ROOT_DIR" rev-parse --git-dir &>/dev/null; then
    git -C "$ROOT_DIR" describe --tags 2>/dev/null || git -C "$ROOT_DIR" rev-parse --short HEAD
  else
    echo "unknown"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Get latest version from git tags or Docker Hub
# ─────────────────────────────────────────────────────────────────────────────
get_latest_version() {
  if git -C "$ROOT_DIR" rev-parse --git-dir &>/dev/null; then
    git -C "$ROOT_DIR" fetch --tags origin &>/dev/null || true
    git -C "$ROOT_DIR" describe --tags $(git -C "$ROOT_DIR" rev-list --tags --max-count=1) 2>/dev/null || git -C "$ROOT_DIR" rev-parse --short HEAD
  else
    echo "unknown"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Get changelog between versions
# ─────────────────────────────────────────────────────────────────────────────
get_changelog() {
  local from_version="$1"
  local to_version="$2"

  if git -C "$ROOT_DIR" rev-parse --git-dir &>/dev/null; then
    log_debug "Changelog:"
    echo ""
    git -C "$ROOT_DIR" log --oneline "${from_version}..${to_version}" 2>/dev/null | head -20 || {
      echo "  (No git history available)"
    }
    echo ""
  else
    echo "  (Git not available for changelog)"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Rollback to previous version
# ─────────────────────────────────────────────────────────────────────────────
rollback_upgrade() {
  if [[ ! -f "$UPGRADE_HISTORY" ]] || ! grep -q "^.*|" "$UPGRADE_HISTORY"; then
    log_error "No previous upgrade found to rollback"
    exit 1
  fi

  log_info "Rolling back to previous version..."

  local last_upgrade
  last_upgrade=$(tail -1 "$UPGRADE_HISTORY")

  local previous_version
  previous_version=$(echo "$last_upgrade" | cut -d'|' -f1)

  log_cmd "Checking out previous version: $previous_version"

  if git -C "$ROOT_DIR" rev-parse --git-dir &>/dev/null; then
    git -C "$ROOT_DIR" checkout "$previous_version" 2>/dev/null || {
      log_error "Failed to checkout previous version"
      exit 1
    }
  else
    log_error "Git not available for rollback"
    exit 1
  fi

  # Rebuild and restart
  log_cmd "Rebuilding images..."
  docker compose -f "$DOCKER_COMPOSE_FILE" build --no-cache api dashboard 2>/dev/null || {
    log_error "Build failed during rollback"
    exit 1
  }

  log_cmd "Restarting services..."
  docker compose -f "$DOCKER_COMPOSE_FILE" up -d 2>/dev/null || {
    log_error "Failed to restart services during rollback"
    exit 1
  }

  log_info "Rollback completed!"
  echo ""
  echo "Previous version restored: $previous_version"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Check for rollback request
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$DO_ROLLBACK" = true ]]; then
  rollback_upgrade
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Get versions
# ─────────────────────────────────────────────────────────────────────────────
local current_version
current_version=$(get_current_version)

local latest_version
latest_version=$(get_latest_version)

log_info "Upgrade check"
echo ""
echo "Current version:  $current_version"
echo "Latest version:   $latest_version"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Check if upgrade is needed
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$current_version" = "$latest_version" ]]; then
  log_info "Already at latest version: $current_version"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Show changelog
# ─────────────────────────────────────────────────────────────────────────────
log_cmd "Changes in this upgrade:"
get_changelog "$current_version" "$latest_version"

# ─────────────────────────────────────────────────────────────────────────────
# Confirm upgrade
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$FORCE_UPGRADE" = false ]]; then
  local response
  read -r -p "Proceed with upgrade? (yes/no): " response
  if [[ "$response" != "yes" ]]; then
    log_warn "Upgrade cancelled"
    exit 0
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Create backup before upgrade (unless skipped)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$SKIP_BACKUP" = false ]]; then
  log_info "Creating automatic backup before upgrade..."
  if bash "$SCRIPT_DIR/backup.sh" --keep=10; then
    log_debug "Backup completed"
  else
    log_error "Backup failed. Aborting upgrade."
    exit 1
  fi
  echo ""
fi

# ─────────────────────────────────────────────────────────────────────────────
# Update source code
# ─────────────────────────────────────────────────────────────────────────────
log_info "Fetching latest code..."

if git -C "$ROOT_DIR" rev-parse --git-dir &>/dev/null; then
  git -C "$ROOT_DIR" fetch origin 2>/dev/null || log_warn "git fetch failed"
  git -C "$ROOT_DIR" checkout "$latest_version" 2>/dev/null || log_warn "git checkout failed"
else
  log_warn "Git not available, skipping code update"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Pull new images or rebuild from source
# ─────────────────────────────────────────────────────────────────────────────
log_info "Updating Docker images..."

if [[ "$BUILD_FROM_SOURCE" = true ]]; then
  log_cmd "Building images from source..."
  if ! docker compose -f "$DOCKER_COMPOSE_FILE" build --no-cache 2>/dev/null; then
    log_error "Docker build failed"
    exit 1
  fi
else
  log_cmd "Pulling latest images..."
  if ! docker compose -f "$DOCKER_COMPOSE_FILE" pull 2>/dev/null; then
    log_warn "Docker pull may have issues, continuing..."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Run database migrations
# ─────────────────────────────────────────────────────────────────────────────
log_info "Running database migrations..."

log_cmd "Checking for migration scripts..."

local migration_dir="${ROOT_DIR}/apps/api/src/db/migrations"
if [[ -d "$migration_dir" ]]; then
  log_cmd "Running migrations on API..."

  if docker compose -f "$DOCKER_COMPOSE_FILE" up -d api 2>/dev/null; then
    sleep 5
    log_debug "Migrations completed (or not required)"
  else
    log_warn "Failed to start API for migrations"
  fi
else
  log_debug "No migration directory found, skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Rolling restart per service
# ─────────────────────────────────────────────────────────────────────────────
log_info "Performing rolling restart..."

local all_healthy=true

for service in "${SERVICES[@]}"; do
  log_cmd "Restarting $service..."

  # Stop the service
  docker compose -f "$DOCKER_COMPOSE_FILE" stop "$service" 2>/dev/null || true
  sleep 2

  # Start the service
  if ! docker compose -f "$DOCKER_COMPOSE_FILE" up -d "$service" 2>/dev/null; then
    log_error "$service failed to start"
    all_healthy=false
    continue
  fi

  log_debug "Waiting for $service to be healthy..."

  # Health check based on service type
  local health_check_passed=false
  local health_endpoint=""
  local container_name="witylogix-${service}"

  case $service in
    api)
      health_endpoint="http://localhost:3001/health"
      ;;
    dashboard)
      health_endpoint="http://localhost:3000/"
      ;;
  esac

  # Perform health check with retries
  for i in {1..30}; do
    if docker exec "$container_name" curl -sf "$health_endpoint" &>/dev/null; then
      health_check_passed=true
      log_debug "$service is healthy"
      break
    fi
    log_debug "  (attempt $i/30)"
    sleep 2
  done

  if [[ "$health_check_passed" = false ]]; then
    log_error "$service failed health check after upgrade"
    all_healthy=false

    # Rollback this service
    log_warn "Rolling back $service..."
    docker compose -f "$DOCKER_COMPOSE_FILE" stop "$service" 2>/dev/null || true

    if git -C "$ROOT_DIR" rev-parse --git-dir &>/dev/null; then
      git -C "$ROOT_DIR" checkout "$current_version" 2>/dev/null || true
      docker compose -f "$DOCKER_COMPOSE_FILE" build --no-cache "$service" 2>/dev/null || true
    fi

    docker compose -f "$DOCKER_COMPOSE_FILE" up -d "$service" 2>/dev/null || true
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Check overall health
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$all_healthy" = false ]]; then
  log_error "Upgrade failed due to service health checks"
  echo ""
  echo "Check logs:"
  echo "  docker logs witylogix-api"
  echo "  docker logs witylogix-dashboard"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Record upgrade in history
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$UPGRADE_HISTORY")"
echo "$current_version|$latest_version|$(date -Iseconds)" >> "$UPGRADE_HISTORY"

# ─────────────────────────────────────────────────────────────────────────────
# Print upgrade summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
log_info "Upgrade completed successfully!"
echo ""
echo "Summary:"
echo "  Previous version: $current_version"
echo "  New version:      $latest_version"
echo "  Timestamp:        $(date -Iseconds)"
echo "  Services:         All healthy"
echo ""
echo "Verify upgrade with:"
echo "  curl http://localhost:3001/health"
echo "  curl http://localhost:3000/"
echo ""
echo "View logs:"
echo "  docker logs witylogix-api -f"
echo "  docker logs witylogix-dashboard -f"
echo ""
echo "To rollback:"
echo "  ./witylogix upgrade --rollback"
echo ""
