#!/usr/bin/env bash
#
# Witylogix Dev Command — Local development orchestrator
#
# Boots the full stack for local development:
# - Pre-flight checks (Node.js, pnpm, Docker)
# - Infrastructure (PostgreSQL, Redis) via Docker Compose
# - Dependencies (node_modules, Prisma client)
# - Applications (API, Dashboard, Docs) via turbo dev
#
# Includes graceful shutdown and service health monitoring
#
# Usage:
#   witylogix dev [options]
#
# Options:
#   --service=SERVICE    Boot only specific service (api, dashboard, docs)
#   --skip-infra         Skip Docker infra (use external DB/Redis)
#   --reset              Clean install (rm node_modules, fresh pnpm install)
#   -h, --help           Show this help
#
# Examples:
#   witylogix dev                        # Full boot
#   witylogix dev --service=api          # API only
#   witylogix dev --skip-infra           # Use external DB/Redis
#   witylogix dev --reset                # Clean install
#

set -e

# Get script and root directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMANDS_DIR="$SCRIPT_DIR"
CLI_DIR="$(dirname "$COMMANDS_DIR")"
INFRA_DIR="$(dirname "$CLI_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"

# Source common library for logging functions
# shellcheck source=/dev/null
source "$CLI_DIR/lib/common.sh" 2>/dev/null || {
  # Fallback logging if common.sh not found
  log_info() { echo "[witylogix-dev] $1"; }
  log_warn() { echo "[witylogix-dev] WARNING: $1" >&2; }
  log_error() { echo "[witylogix-dev] ERROR: $1" >&2; }
  log_step() { echo "→ $1"; }
  log_success() { echo "✓ $1"; }
}

# Options
SERVICE_FILTER=""
SKIP_INFRA=false
RESET_MODE=false

# Configuration
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-witylogix}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-witylogix_dev}"
POSTGRES_DB="${POSTGRES_DB:-witylogix}"
REDIS_PORT="${REDIS_PORT:-6379}"

API_PORT="${API_PORT:-3001}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3002}"
DOCS_PORT="${DOCS_PORT:-3003}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Process tracking
DOCKER_PID=""
TURBO_PID=""
SHUTDOWN_IN_PROGRESS=false

# ─────────────────────────────────────────────────────────────────────────────
# Parse Arguments
# ─────────────────────────────────────────────────────────────────────────────
parse_dev_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --service=*)
        SERVICE_FILTER="${1#*=}"
        shift
        ;;
      --skip-infra)
        SKIP_INFRA=true
        shift
        ;;
      --reset)
        RESET_MODE=true
        shift
        ;;
      -h|--help)
        show_dev_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        show_dev_help
        exit 1
        ;;
    esac
  done
}

show_dev_help() {
  cat << 'EOF'
Witylogix Dev — Local development orchestrator

USAGE:
  witylogix dev [options]

OPTIONS:
  --service=SERVICE    Boot only specific service: api, dashboard, docs
  --skip-infra         Skip Docker infra (use external DB/Redis)
  --reset              Clean install (rm node_modules, fresh install)
  -h, --help           Show this help

EXAMPLES:
  witylogix dev                        # Full boot (default)
  witylogix dev --service=api          # Boot API only
  witylogix dev --skip-infra           # Use external DB/Redis
  witylogix dev --reset                # Clean install from scratch

The dev command:
  1. Verifies prerequisites (Node.js ≥20, pnpm, Docker)
  2. Checks .env file exists (creates from template if missing)
  3. Validates port availability (3001, 3002, 3003, 5432, 6379)
  4. Starts PostgreSQL + Redis (unless --skip-infra)
  5. Waits for databases to be healthy
  6. Installs dependencies (pnpm install)
  7. Generates Prisma client (pnpm db:generate)
  8. Starts applications (pnpm dev or service-specific)
  9. Displays live status table
  10. On exit: gracefully shuts down all services

EOF
}

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight Checks
# ─────────────────────────────────────────────────────────────────────────────

check_node_version() {
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    echo "  Install from: https://nodejs.org (required: >= 20.0.0)"
    exit 1
  fi

  local node_version
  node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  if [[ "$node_version" -lt 20 ]]; then
    log_error "Node.js version is $(node -v), but >= 20.0.0 is required"
    exit 1
  fi

  log_success "Node.js $(node -v) ✓"
}

check_pnpm_installed() {
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed"
    echo "  Install with: npm install -g pnpm"
    exit 1
  fi

  log_success "pnpm $(pnpm -v) ✓"
}

check_docker_running() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    echo "  Install from: https://www.docker.com/products/docker-desktop"
    exit 1
  fi

  if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running"
    echo "  Start Docker Desktop or the Docker daemon"
    exit 1
  fi

  log_success "Docker daemon running ✓"
}

check_env_file() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    log_warn ".env file not found"
    log_info "Creating .env from template..."

    if [[ -f "$ROOT_DIR/.env.example" ]]; then
      cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
      log_success "Created .env from template"
      log_info "Edit .env to customize settings (especially API keys)"
    else
      log_error "Cannot find .env.example template"
      exit 1
    fi
  fi

  log_success ".env file exists ✓"
}

check_port_available() {
  local port=$1
  local service=$2

  if command -v lsof &> /dev/null; then
    if lsof -i ":$port" &> /dev/null; then
      log_error "Port $port ($service) is already in use"
      log_error "  Run: lsof -i :$port  to find the process"
      exit 1
    fi
  elif command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
      log_error "Port $port ($service) is already in use"
      exit 1
    fi
  fi
}

check_ports_available() {
  if [[ "$SKIP_INFRA" != "true" ]]; then
    check_port_available "$POSTGRES_PORT" "PostgreSQL"
    check_port_available "$REDIS_PORT" "Redis"
  fi

  check_port_available "$API_PORT" "API"
  check_port_available "$DASHBOARD_PORT" "Dashboard"
  check_port_available "$DOCS_PORT" "Docs"

  log_success "All required ports are available ✓"
}

run_preflight_checks() {
  log_step "Running pre-flight checks..."
  check_node_version
  check_pnpm_installed
  if [[ "$SKIP_INFRA" != "true" ]]; then
    check_docker_running
  fi
  check_env_file
  check_ports_available
  log_success "All pre-flight checks passed"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Infrastructure Boot (PostgreSQL + Redis)
# ─────────────────────────────────────────────────────────────────────────────

start_docker_infra() {
  if [[ "$SKIP_INFRA" = "true" ]]; then
    log_info "Skipping Docker infrastructure (--skip-infra)"
    return
  fi

  log_step "Starting Docker infrastructure..."
  cd "$ROOT_DIR"

  # Start PostgreSQL and Redis
  if docker compose -f "$INFRA_DIR/docker-compose.dev.yml" -f "$INFRA_DIR/docker-compose.yml" up -d postgres redis &> /tmp/docker-up.log; then
    log_success "PostgreSQL + Redis started"
  else
    log_error "Failed to start Docker containers"
    cat /tmp/docker-up.log
    exit 1
  fi
}

wait_for_postgres() {
  if [[ "$SKIP_INFRA" = "true" ]]; then
    return
  fi

  log_step "Waiting for PostgreSQL to be healthy..."
  local max_attempts=30
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    if pg_isready -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" &> /dev/null; then
      log_success "PostgreSQL is healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  log_error "PostgreSQL did not become healthy after 30 seconds"
  exit 1
}

wait_for_redis() {
  if [[ "$SKIP_INFRA" = "true" ]]; then
    return
  fi

  log_step "Waiting for Redis to be healthy..."
  local max_attempts=30
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    if redis-cli -p "$REDIS_PORT" ping &> /dev/null; then
      log_success "Redis is healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  log_error "Redis did not become healthy after 30 seconds"
  exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Dependencies Boot
# ─────────────────────────────────────────────────────────────────────────────

install_dependencies() {
  log_step "Installing dependencies..."
  cd "$ROOT_DIR"

  if [[ "$RESET_MODE" = "true" ]]; then
    log_warn "Reset mode: removing node_modules..."
    rm -rf node_modules
  fi

  if [[ ! -d "node_modules" ]]; then
    if pnpm install; then
      log_success "Dependencies installed"
    else
      log_error "Failed to install dependencies"
      exit 1
    fi
  else
    log_info "node_modules already present, skipping install"
  fi
}

generate_prisma_client() {
  log_step "Generating Prisma client..."
  cd "$ROOT_DIR"

  if pnpm db:generate; then
    log_success "Prisma client generated"
  else
    log_error "Failed to generate Prisma client"
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Status Table
# ─────────────────────────────────────────────────────────────────────────────

print_status_header() {
  cat << 'EOF'

┌──────────────┬────────┬─────────────────────────────┐
│ Service      │ Port   │ Status                      │
├──────────────┼────────┼─────────────────────────────┤
EOF
}

print_status_row() {
  local service=$1
  local port=$2
  local status=$3
  printf "│ %-12s │ %-6s │ %-27s │\n" "$service" "$port" "$status"
}

print_status_footer() {
  cat << 'EOF'
└──────────────┴────────┴─────────────────────────────┘

EOF
}

show_startup_status() {
  print_status_header

  if [[ "$SKIP_INFRA" != "true" ]]; then
    print_status_row "PostgreSQL" "$POSTGRES_PORT" "✅ Running"
    print_status_row "Redis" "$REDIS_PORT" "✅ Running"
  else
    print_status_row "PostgreSQL" "$POSTGRES_PORT" "⏭️  Skipped"
    print_status_row "Redis" "$REDIS_PORT" "⏭️  Skipped"
  fi

  print_status_row "API" "$API_PORT" "🔄 Starting..."
  print_status_row "Dashboard" "$DASHBOARD_PORT" "🔄 Starting..."
  print_status_row "Docs" "$DOCS_PORT" "🔄 Starting..."

  print_status_footer
  log_info "Services are booting. This may take 30-60 seconds."
  log_info "Press Ctrl+C to stop all services gracefully."
}

# ─────────────────────────────────────────────────────────────────────────────
# Application Boot (Turbo Dev)
# ─────────────────────────────────────────────────────────────────────────────

start_applications() {
  log_step "Starting applications via turbo..."
  cd "$ROOT_DIR"

  show_startup_status

  local turbo_cmd="pnpm dev"

  if [[ -n "$SERVICE_FILTER" ]]; then
    turbo_cmd="pnpm --filter @witylogix/$SERVICE_FILTER dev"
    log_info "Running only service: @witylogix/$SERVICE_FILTER"
  fi

  # Start turbo dev in background
  $turbo_cmd &
  TURBO_PID=$!
}

# ─────────────────────────────────────────────────────────────────────────────
# Process Management & Graceful Shutdown
# ─────────────────────────────────────────────────────────────────────────────

cleanup_and_exit() {
  if [[ "$SHUTDOWN_IN_PROGRESS" = "true" ]]; then
    return
  fi
  SHUTDOWN_IN_PROGRESS=true

  echo ""
  log_warn "Shutting down services..."

  # Kill turbo dev
  if [[ -n "$TURBO_PID" ]] && kill -0 "$TURBO_PID" 2>/dev/null; then
    log_info "Stopping applications..."
    kill "$TURBO_PID" 2>/dev/null || true
    wait "$TURBO_PID" 2>/dev/null || true
  fi

  # Stop Docker containers (if not skipped)
  if [[ "$SKIP_INFRA" != "true" ]]; then
    log_info "Stopping Docker infrastructure..."
    cd "$ROOT_DIR"
    docker compose -f "$INFRA_DIR/docker-compose.dev.yml" -f "$INFRA_DIR/docker-compose.yml" down 2>/dev/null || true
  fi

  echo ""
  log_success "All services stopped"
  log_info "Goodbye! 👋"
}

trap cleanup_and_exit SIGINT SIGTERM EXIT

# ─────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────────────────────

cmd_dev() {
  # Parse command-specific arguments
  parse_dev_args "$@"

  log_step "Witylogix Dev — Local development orchestrator"
  echo ""

  # Phase 1: Pre-flight checks
  run_preflight_checks

  # Phase 2: Infrastructure boot
  start_docker_infra
  wait_for_postgres
  wait_for_redis

  # Phase 3: Dependencies
  install_dependencies
  generate_prisma_client

  # Phase 4: Application boot
  start_applications

  # Phase 5: Keep running
  log_success "Development environment is ready!"
  wait
}

# Execute if sourced via CLI
cmd_dev "$@"
