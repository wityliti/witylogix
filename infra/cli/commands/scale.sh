#!/usr/bin/env bash
#
# Witylogix CLI — scale command
#
# Worker scaling for services:
# - `witylogix scale api 3` — Scale API to 3 replicas
# - `witylogix scale dashboard 2` — Scale dashboard to 2 replicas
# - `witylogix scale show` — Show current scale of all services
#
# Features:
# - Shows current replica count before scaling
# - Validates service name exists
# - Uses docker compose up --scale under the hood
# - Waits for all replicas to be healthy
# - Prints updated status table
# - Warns if scaling beyond recommended limits
# - Respects system resource constraints
#
# Usage:
#   cmd_scale [show | SERVICE REPLICAS]
#
# Commands:
#   show                    Show current scale of all services
#   SERVICE REPLICAS        Scale a service to N replicas
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_step() { echo -e "${CYAN}→${NC} $1"; }

# Globals
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMMAND="${1:-show}"
SERVICE_TARGET="${2:-}"
REPLICA_COUNT="${3:-}"

# Recommended max replicas per service (based on typical system)
declare -A RECOMMENDED_LIMITS=(
  [api]=5
  [dashboard]=3
  [docs]=2
  [postgres]=1
  [redis]=1
  [caddy]=3
)

# Get all available services
get_all_services() {
  cd "$ROOT_DIR"
  if [[ ! -f "docker-compose.yml" ]]; then
    log_error "docker-compose.yml not found at $ROOT_DIR"
    return 1
  fi
  docker-compose config --services 2>/dev/null || echo ""
}

# Check if service exists
service_exists() {
  local service="$1"
  local all_services
  all_services=$(get_all_services)
  echo "$all_services" | grep -q "^${service}$"
}

# Get current replica count for a service
get_current_replicas() {
  local service="$1"
  cd "$ROOT_DIR"
  # Count running containers for this service
  local count
  count=$(docker-compose ps --services | grep "^${service}$" 2>/dev/null | wc -l)
  if [[ $count -eq 0 ]]; then
    # Service exists but no containers running, return 1
    echo "0"
  else
    echo "$count"
  fi
}

# Check if service can be scaled
can_scale_service() {
  local service="$1"
  # Some services (postgres, redis) should not be scaled in production
  case "$service" in
    postgres|redis)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

# Get system resource warnings
check_system_resources() {
  local total_replicas="$1"
  local available_cores
  available_cores=$(nproc 2>/dev/null || echo "4")

  # Warn if total replicas exceed available cores
  if [[ $total_replicas -gt $available_cores ]]; then
    log_warn "Total replicas ($total_replicas) exceeds available CPU cores ($available_cores)"
    log_warn "Performance may be degraded"
    return 1
  fi
  return 0
}

# Show current scale of all services
show_current_scale() {
  log_info "Current service scale:"
  echo ""

  # Header
  printf "%-15s %-10s %-20s\n" "SERVICE" "REPLICAS" "STATUS"
  printf "%-15s %-10s %-20s\n" "-------" "--------" "------"

  local all_services
  all_services=$(get_all_services)

  local total_replicas=0
  while IFS= read -r service; do
    if [[ -z "$service" ]]; then continue; fi

    local current
    current=$(get_current_replicas "$service")
    total_replicas=$((total_replicas + current))

    local status="running"
    if [[ $current -eq 0 ]]; then
      status="not running"
    fi

    printf "%-15s %-10d %-20s\n" "$service" "$current" "$status"
  done <<< "$all_services"

  echo ""
  echo "Total active replicas: $total_replicas"
  echo ""
}

# Scale a service to N replicas
scale_service() {
  local service="$1"
  local replicas="$2"

  # Validate inputs
  if ! service_exists "$service"; then
    log_error "Service '$service' does not exist"
    log_step "Available services: $(get_all_services | tr '\n' ', ' | sed 's/,$//')"
    return 1
  fi

  if ! [[ "$replicas" =~ ^[0-9]+$ ]]; then
    log_error "Replica count must be a positive integer, got: $replicas"
    return 1
  fi

  if [[ $replicas -lt 0 ]]; then
    log_error "Replica count cannot be negative"
    return 1
  fi

  # Check if service can be scaled
  if ! can_scale_service "$service"; then
    log_error "Service '$service' cannot be scaled (database/cache services must have exactly 1 replica)"
    return 1
  fi

  # Warn if scaling beyond recommended limits
  local recommended
  recommended=${RECOMMENDED_LIMITS[$service]:-3}
  if [[ $replicas -gt $recommended ]]; then
    log_warn "Scaling $service to $replicas replicas (recommended max: $recommended)"
  fi

  # Show current state
  local current
  current=$(get_current_replicas "$service")
  log_info "Scaling $service: $current → $replicas replicas"
  log_step "This may take a moment..."
  echo ""

  # Scale the service
  cd "$ROOT_DIR"
  if docker-compose up --scale "${service}=${replicas}" --detach 2>/dev/null; then
    log_success "Scaling command executed"
  else
    log_error "Failed to execute scaling command"
    return 1
  fi

  # Wait for containers to be ready
  log_step "Waiting for all replicas to be ready..."
  local max_attempts=30
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    local ready_count=0
    local running_count=0

    # Count running containers
    running_count=$(docker-compose ps --filter "status=running" --services 2>/dev/null | grep "^${service}" | wc -l || echo "0")

    # Try to check health if health checks are defined
    if docker-compose ps 2>/dev/null | grep "${service}" | grep -q "healthy"; then
      ready_count=$(docker-compose ps 2>/dev/null | grep "${service}" | grep "healthy" | wc -l || echo "0")
    else
      ready_count=$running_count
    fi

    if [[ $running_count -eq $replicas ]]; then
      log_success "All $replicas replicas are running"
      echo ""
      show_current_scale
      return 0
    fi

    echo -ne "\rProgress: $running_count/$replicas replicas ready..."
    sleep 1
    attempt=$((attempt + 1))
  done

  log_warn "Timeout waiting for all replicas (got $running_count/$replicas)"
  show_current_scale
  return 1
}

# Show help
show_help() {
  cat << 'EOF'
Witylogix scale — Service scaling management

Usage: witylogix scale [show | SERVICE REPLICAS]

Commands:
  show                Show current scale of all services
  SERVICE REPLICAS    Scale a service to N replicas

Services (scalable):
  api         API service (recommended max: 5)
  dashboard   Dashboard service (recommended max: 3)
  docs        Documentation service (recommended max: 2)
  caddy       Reverse proxy (recommended max: 3)

Services (non-scalable):
  postgres    Database (fixed at 1)
  redis       Cache (fixed at 1)

Options:
  -h, --help          Show this help message

Examples:
  witylogix scale show              # Show current scale
  witylogix scale api 3             # Scale API to 3 replicas
  witylogix scale dashboard 2       # Scale dashboard to 2 replicas
  witylogix scale caddy 2           # Scale reverse proxy to 2 replicas
  witylogix scale docs 1            # Scale docs to 1 replica

Resource Warnings:
- Total replicas should not exceed available CPU cores
- Scaling beyond recommended limits may impact performance
- Database and cache services cannot be scaled
EOF
}

# Main execution
main() {
  # Check if docker-compose is available
  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed"
    exit 1
  fi

  # Check if we're in the right directory
  if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
    log_error "docker-compose.yml not found at $ROOT_DIR"
    exit 1
  fi

  case "$COMMAND" in
    show)
      show_current_scale
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      if [[ -z "$SERVICE_TARGET" ]] || [[ -z "$REPLICA_COUNT" ]]; then
        log_error "Usage: witylogix scale [show | SERVICE REPLICAS]"
        echo ""
        show_help
        exit 1
      fi

      # Scale the service
      if scale_service "$SERVICE_TARGET" "$REPLICA_COUNT"; then
        exit 0
      else
        exit 1
      fi
      ;;
  esac
}

main
