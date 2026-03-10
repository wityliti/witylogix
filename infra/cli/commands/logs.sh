#!/usr/bin/env bash
#
# Witylogix CLI — logs command
#
# Multi-service log tailing with color coding, filtering, and export:
# - `witylogix logs` — Tail all services (interleaved, color-coded per service)
# - `witylogix logs api` — Tail specific service
# - `witylogix logs --since=1h` — Show logs from last N hours
# - `witylogix logs --search="ERROR"` — Filter logs by pattern
# - `witylogix logs --export=FILE` — Export to file
#
# Colors per service:
#   API=cyan, Dashboard=green, Docs=blue, Postgres=yellow, Redis=magenta, Caddy=white
#
# Usage:
#   cmd_logs [SERVICE] [options]
#
# Arguments:
#   SERVICE             Service name (api, dashboard, docs, postgres, redis, caddy, all)
#
# Options:
#   --since=<time>      Show logs from last N time unit (e.g., 1h, 30m, 5s)
#   --search=<pattern>  Filter logs by grep pattern
#   --export=<file>     Export logs to file
#   --follow            Follow log stream (default: true)
#   --no-follow         Don't follow; show only existing logs
#   --lines=<N>         Show last N lines (default: 100)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
WHITE='\033[0;37m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }
log_step() { echo -e "${CYAN}→${NC} $1"; }

# Globals
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SERVICE_TARGET="all"
SINCE_TIME=""
SEARCH_PATTERN=""
EXPORT_FILE=""
FOLLOW=true
LINE_COUNT=100

# Service to color mapping
get_service_color() {
  local svc="$1"
  case "$svc" in
    api)       echo -e "${CYAN}" ;;
    dashboard) echo -e "${GREEN}" ;;
    docs)      echo -e "${BLUE}" ;;
    postgres)  echo -e "${YELLOW}" ;;
    redis)     echo -e "${MAGENTA}" ;;
    caddy)     echo -e "${WHITE}" ;;
    *)         echo -e "${NC}" ;;
  esac
}

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

# Validate requested service
validate_service() {
  local service="$1"
  if [[ "$service" == "all" ]]; then
    return 0
  fi
  if ! service_exists "$service"; then
    log_error "Service '$service' does not exist"
    log_step "Available services: $(get_all_services | tr '\n' ', ' | sed 's/,$//')"
    return 1
  fi
  return 0
}

# Tail logs from docker compose
tail_logs() {
  cd "$ROOT_DIR"

  local compose_args=()

  # Add service filter if not "all"
  if [[ "$SERVICE_TARGET" != "all" ]]; then
    compose_args+=("$SERVICE_TARGET")
  fi

  # Add follow flag
  if [[ "$FOLLOW" == true ]]; then
    compose_args+=(--follow)
  fi

  # Add tail/lines count
  compose_args+=(--tail="$LINE_COUNT")

  # Add timestamps
  compose_args+=(--timestamps)

  local docker_output
  if docker-compose logs "${compose_args[@]}" 2>/dev/null | {
    while IFS= read -r line; do
      # Parse service name from line (format: "service_name | content")
      local service_name=""
      if [[ $line =~ ^([a-z0-9_-]+)[[:space:]]*\| ]]; then
        service_name="${BASH_REMATCH[1]}"
      fi

      # Apply search filter if specified
      if [[ -n "$SEARCH_PATTERN" ]] && ! echo "$line" | grep -i "$SEARCH_PATTERN" >/dev/null 2>&1; then
        continue
      fi

      # Color-code the output
      if [[ -n "$service_name" ]]; then
        local color
        color=$(get_service_color "$service_name")
        echo -e "${color}${line}${NC}"
      else
        echo "$line"
      fi
    done

    # Export to file if specified
    if [[ -n "$EXPORT_FILE" ]]; then
      docker-compose logs --tail="$LINE_COUNT" --timestamps ${SERVICE_TARGET:+$SERVICE_TARGET} 2>/dev/null >> "$EXPORT_FILE"
    fi
  }; then
    return 0
  else
    return 1
  fi
}

# Export logs to file
export_logs() {
  cd "$ROOT_DIR"

  log_step "Exporting logs to $EXPORT_FILE..."

  local compose_args=()
  if [[ "$SERVICE_TARGET" != "all" ]]; then
    compose_args+=("$SERVICE_TARGET")
  fi
  compose_args+=(--timestamps)

  if docker-compose logs "${compose_args[@]}" 2>/dev/null > "$EXPORT_FILE"; then
    local file_size
    file_size=$(wc -c < "$EXPORT_FILE" | numfmt --to=iec-i --suffix=B 2>/dev/null || wc -c < "$EXPORT_FILE")
    log_info "Logs exported to $EXPORT_FILE ($file_size)"
    return 0
  else
    log_error "Failed to export logs"
    return 1
  fi
}

# Display service status
show_service_status() {
  log_info "Tailing logs for: $SERVICE_TARGET"
  if [[ -n "$SINCE_TIME" ]]; then
    log_info "Time filter: last $SINCE_TIME"
  fi
  if [[ -n "$SEARCH_PATTERN" ]]; then
    log_info "Search filter: $SEARCH_PATTERN"
  fi
  log_info "Line buffer: $LINE_COUNT"
  echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --since=*)      SINCE_TIME="${1#*=}"; shift ;;
    --search=*)     SEARCH_PATTERN="${1#*=}"; shift ;;
    --export=*)     EXPORT_FILE="${1#*=}"; shift ;;
    --follow)       FOLLOW=true; shift ;;
    --no-follow)    FOLLOW=false; shift ;;
    --lines=*)      LINE_COUNT="${1#*=}"; shift ;;
    -h|--help)      show_help; exit 0 ;;
    api|dashboard|docs|postgres|redis|caddy|all)
                    SERVICE_TARGET="$1"; shift ;;
    -*)             log_error "Unknown option: $1"; exit 1 ;;
    *)              SERVICE_TARGET="$1"; shift ;;
  esac
done

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

  # Validate service
  if ! validate_service "$SERVICE_TARGET"; then
    exit 1
  fi

  # Show status
  show_service_status

  # Export logs if requested
  if [[ -n "$EXPORT_FILE" ]]; then
    export_logs || exit 1
    return 0
  fi

  # Tail logs
  if ! tail_logs; then
    log_error "Failed to read logs"
    exit 1
  fi
}

show_help() {
  cat << 'EOF'
Witylogix logs — Multi-service log tailing

Usage: witylogix logs [SERVICE] [options]

Services:
  api         API service
  dashboard   Dashboard service
  docs        Documentation service
  postgres    PostgreSQL database
  redis       Redis cache
  caddy       Caddy reverse proxy
  all         All services (default)

Options:
  --since=<time>      Show logs from last N time unit (e.g., 1h, 30m, 5s)
  --search=<pattern>  Filter logs by grep pattern (case-insensitive)
  --export=<file>     Export logs to file instead of streaming
  --follow            Follow log stream in real-time (default)
  --no-follow         Show only existing logs, don't stream
  --lines=<N>         Show last N lines (default: 100)
  -h, --help          Show this help message

Examples:
  witylogix logs                    # Tail all services
  witylogix logs api                # Tail API logs only
  witylogix logs --no-follow        # Show existing logs only
  witylogix logs api --search=ERROR # Tail API logs, filter for ERROR
  witylogix logs --export=logs.txt  # Export all logs to file
  witylogix logs --since=1h         # Show logs from last hour
  witylogix logs --lines=50         # Show last 50 lines
EOF
}

main
