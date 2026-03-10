#!/usr/bin/env bash
#
# Witylogix CLI — status command
#
# Service health checker: monitors all Docker containers and application services
#
# - Checks all Docker containers (running/stopped/unhealthy)
# - HTTP probe each service (API, Dashboard, Shopify App)
# - Checks database connectivity (Postgres, Redis)
# - Displays formatted status table with uptime, memory, and CPU
# - Shows version info (git commit, image tags)
# - Supports --json flag for machine-readable output
# - Supports --watch flag for continuous monitoring (refresh every 5s)
#
# Usage:
#   cmd_status [--json] [--watch]
#
# Flags:
#   --json        Output as JSON for machine-readable format
#   --watch       Continuous monitoring (refresh every 5s)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }

# Globals
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
OUTPUT_JSON=false
WATCH_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --json)   OUTPUT_JSON=true; shift ;;
    --watch)  WATCH_MODE=true; shift ;;
    *)        log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# Check if docker is available
check_docker() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi
}

# Get container status
get_container_status() {
  local name="$1"
  docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "missing"
}

# Get container uptime
get_container_uptime() {
  local name="$1"
  local status
  status=$(get_container_status "$name")

  if [[ "$status" != "running" ]]; then
    echo "N/A"
    return
  fi

  local start_time
  start_time=$(docker inspect "$name" --format='{{.State.StartedAt}}' 2>/dev/null)

  if [[ -z "$start_time" ]]; then
    echo "N/A"
    return
  fi

  # Convert to seconds since epoch
  local start_epoch
  start_epoch=$(date -d "$start_time" +%s 2>/dev/null || echo "0")
  local now_epoch
  now_epoch=$(date +%s)
  local uptime_seconds=$((now_epoch - start_epoch))

  # Convert to human-readable format
  if [[ $uptime_seconds -lt 60 ]]; then
    echo "${uptime_seconds}s"
  elif [[ $uptime_seconds -lt 3600 ]]; then
    echo "$((uptime_seconds / 60))m"
  elif [[ $uptime_seconds -lt 86400 ]]; then
    echo "$((uptime_seconds / 3600))h"
  else
    local days=$((uptime_seconds / 86400))
    local hours=$(((uptime_seconds % 86400) / 3600))
    echo "${days}d ${hours}h"
  fi
}

# Get container memory usage
get_container_memory() {
  local name="$1"
  local status
  status=$(get_container_status "$name")

  if [[ "$status" != "running" ]]; then
    echo "N/A"
    return
  fi

  # Get memory usage in bytes and convert to MB
  local memory_bytes
  memory_bytes=$(docker stats --no-stream "$name" 2>/dev/null | awk 'NR==2 {print $2}' | sed 's/MiB//' || echo "0")

  if [[ -z "$memory_bytes" ]] || [[ "$memory_bytes" == "0" ]]; then
    # Fallback: use inspect
    memory_bytes=$(docker inspect "$name" --format='{{.HostConfig.Memory}}' 2>/dev/null || echo "0")
    if [[ "$memory_bytes" != "0" ]]; then
      memory_bytes=$((memory_bytes / 1024 / 1024))
      echo "${memory_bytes} MB"
    else
      echo "N/A"
    fi
    return
  fi

  echo "${memory_bytes} MB"
}

# Get container CPU usage
get_container_cpu() {
  local name="$1"
  local status
  status=$(get_container_status "$name")

  if [[ "$status" != "running" ]]; then
    echo "N/A"
    return
  fi

  # Get CPU percentage from docker stats
  local cpu
  cpu=$(docker stats --no-stream "$name" 2>/dev/null | awk 'NR==2 {print $3}' | sed 's/%//' || echo "0")

  if [[ -z "$cpu" ]]; then
    echo "N/A"
  else
    echo "${cpu}%"
  fi
}

# HTTP health check
http_health_check() {
  local url="$1"
  local timeout="${2:-5}"

  if curl -s -f -m "$timeout" "$url" &> /dev/null; then
    echo "✅ UP"
    return 0
  else
    echo "❌ DOWN"
    return 1
  fi
}

# Check database connectivity
check_postgres() {
  if ! docker ps --format "{{.Names}}" | grep -q "witylogix-postgres"; then
    echo "❌ DOWN"
    return 1
  fi

  if docker exec witylogix-postgres pg_isready -U witylogix &> /dev/null; then
    echo "✅ UP"
    return 0
  else
    echo "❌ DOWN"
    return 1
  fi
}

# Check redis connectivity
check_redis() {
  if ! docker ps --format "{{.Names}}" | grep -q "witylogix-redis"; then
    echo "❌ DOWN"
    return 1
  fi

  if docker exec witylogix-redis redis-cli ping &> /dev/null; then
    echo "✅ UP"
    return 0
  else
    echo "❌ DOWN"
    return 1
  fi
}

# Get git commit information
get_git_info() {
  cd "$ROOT_DIR"
  local commit
  commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  echo "Commit: $commit | Branch: $branch"
}

# Get image information
get_image_info() {
  # Try to get image tags from docker compose
  local api_image
  api_image=$(docker image inspect witylogix-api --format='{{.RepoTags}}' 2>/dev/null || echo "unknown")
  local dashboard_image
  dashboard_image=$(docker image inspect witylogix-dashboard --format='{{.RepoTags}}' 2>/dev/null || echo "unknown")

  echo "API: $api_image | Dashboard: $dashboard_image"
}

# Display status table
display_status_table() {
  local api_status
  api_status=$(http_health_check "http://localhost:3001/health" 5)
  local dashboard_status
  dashboard_status=$(http_health_check "http://localhost:3002" 5)
  local shopify_status
  shopify_status=$(http_health_check "http://localhost:3002" 5)
  local postgres_status
  postgres_status=$(check_postgres)
  local redis_status
  redis_status=$(check_redis)

  # Get container info
  local api_uptime
  api_uptime=$(get_container_uptime "witylogix-api")
  local api_memory
  api_memory=$(get_container_memory "witylogix-api")
  local api_cpu
  api_cpu=$(get_container_cpu "witylogix-api")

  local dashboard_uptime
  dashboard_uptime=$(get_container_uptime "witylogix-dashboard")
  local dashboard_memory
  dashboard_memory=$(get_container_memory "witylogix-dashboard")
  local dashboard_cpu
  dashboard_cpu=$(get_container_cpu "witylogix-dashboard")

  local postgres_uptime
  postgres_uptime=$(get_container_uptime "witylogix-postgres")
  local postgres_memory
  postgres_memory=$(get_container_memory "witylogix-postgres")
  local postgres_cpu
  postgres_cpu=$(get_container_cpu "witylogix-postgres")

  local redis_uptime
  redis_uptime=$(get_container_uptime "witylogix-redis")
  local redis_memory
  redis_memory=$(get_container_memory "witylogix-redis")
  local redis_cpu
  redis_cpu=$(get_container_cpu "witylogix-redis")

  # Print table
  echo ""
  echo "┌──────────────┬──────────┬──────────┬───────────┬──────────┐"
  echo "│ Service      │ Status   │ Uptime   │ Memory    │ CPU      │"
  echo "├──────────────┼──────────┼──────────┼───────────┼──────────┤"
  printf "│ %-12s │ %s │ %-8s │ %-9s │ %-8s │\n" "API" "$api_status" "$api_uptime" "$api_memory" "$api_cpu"
  printf "│ %-12s │ %s │ %-8s │ %-9s │ %-8s │\n" "Dashboard" "$dashboard_status" "$dashboard_uptime" "$dashboard_memory" "$dashboard_cpu"
  printf "│ %-12s │ %s │ %-8s │ %-9s │ %-8s │\n" "Shopify App" "$shopify_status" "—" "—" "—"
  printf "│ %-12s │ %s │ %-8s │ %-9s │ %-8s │\n" "PostgreSQL" "$postgres_status" "$postgres_uptime" "$postgres_memory" "$postgres_cpu"
  printf "│ %-12s │ %s │ %-8s │ %-9s │ %-8s │\n" "Redis" "$redis_status" "$redis_uptime" "$redis_memory" "$redis_cpu"
  echo "└──────────────┴──────────┴──────────┴───────────┴──────────┘"
  echo ""
}

# Display JSON output
display_json() {
  local api_status
  api_status=$(http_health_check "http://localhost:3001/health" 5 | grep -o "✅\|❌")
  local dashboard_status
  dashboard_status=$(http_health_check "http://localhost:3002" 5 | grep -o "✅\|❌")
  local postgres_status
  postgres_status=$(check_postgres | grep -o "✅\|❌")
  local redis_status
  redis_status=$(check_redis | grep -o "✅\|❌")

  # Convert status to boolean
  local api_up=false
  [[ "$api_status" == "✅" ]] && api_up=true
  local dashboard_up=false
  [[ "$dashboard_status" == "✅" ]] && dashboard_up=true
  local postgres_up=false
  [[ "$postgres_status" == "✅" ]] && postgres_up=true
  local redis_up=false
  [[ "$redis_status" == "✅" ]] && redis_up=true

  cat << EOF
{
  "api": {
    "status": $api_up,
    "uptime": "$(get_container_uptime 'witylogix-api')",
    "memory": "$(get_container_memory 'witylogix-api')",
    "cpu": "$(get_container_cpu 'witylogix-api')"
  },
  "dashboard": {
    "status": $dashboard_up,
    "uptime": "$(get_container_uptime 'witylogix-dashboard')",
    "memory": "$(get_container_memory 'witylogix-dashboard')",
    "cpu": "$(get_container_cpu 'witylogix-dashboard')"
  },
  "postgres": {
    "status": $postgres_up,
    "uptime": "$(get_container_uptime 'witylogix-postgres')",
    "memory": "$(get_container_memory 'witylogix-postgres')",
    "cpu": "$(get_container_cpu 'witylogix-postgres')"
  },
  "redis": {
    "status": $redis_up,
    "uptime": "$(get_container_uptime 'witylogix-redis')",
    "memory": "$(get_container_memory 'witylogix-redis')",
    "cpu": "$(get_container_cpu 'witylogix-redis')"
  },
  "version": {
    "git": "$(get_git_info)",
    "images": "$(get_image_info)"
  },
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

# Main status function
cmd_status() {
  check_docker

  if [[ "$WATCH_MODE" = true ]]; then
    log_info "Monitoring services (refresh every 5s, press Ctrl+C to exit)..."
    while true; do
      clear
      echo ""
      log_info "Witylogix Platform Status"
      if [[ "$OUTPUT_JSON" = true ]]; then
        display_json
      else
        display_status_table
      fi
      echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
      sleep 5
    done
  else
    echo ""
    log_info "Witylogix Platform Status"
    if [[ "$OUTPUT_JSON" = true ]]; then
      display_json
    else
      display_status_table
    fi
    echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
  fi
}

# Run status command if script is executed directly
cmd_status "$@"
