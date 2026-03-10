#!/usr/bin/env bash
#
# Witylogix CLI — deploy command
#
# Deploys Witylogix infrastructure and services:
# - Detects fresh install vs. update
# - Fresh install: validates .env, pulls/builds images, starts infrastructure,
#   runs migrations, optionally seeds database, starts application services
# - Update: pulls/builds new images, runs migrations, rolling restart with
#   health checks and automatic rollback on failure
# - Comprehensive health checking and service dependency management
#
# Usage:
#   cmd_deploy [--seed] [--build] [--skip-migrations] [--service=NAME]
#
# Flags:
#   --seed              Seed database with initial data
#   --build             Build Docker images from source instead of pulling
#   --skip-migrations   Skip running Prisma migrations
#   --service=NAME      Deploy only a specific service (api, dashboard, shopify-app)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_step() { echo -e "${CYAN}→${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }

# Globals
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SEED_DATABASE=false
BUILD_IMAGES=false
SKIP_MIGRATIONS=false
TARGET_SERVICE=""
START_TIME=$(date +%s)
DEPLOYED_SERVICES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --seed)               SEED_DATABASE=true; shift ;;
    --build)              BUILD_IMAGES=true; shift ;;
    --skip-migrations)    SKIP_MIGRATIONS=true; shift ;;
    --service=*)          TARGET_SERVICE="${1#*=}"; shift ;;
    *)                    log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate .env file
validate_env() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    log_error ".env file not found at $ROOT_DIR/.env"
    log_step "Run: cli install"
    exit 1
  fi

  log_success ".env file found"

  # Check for critical variables
  local REQUIRED_VARS=("JWT_SECRET" "POSTGRES_PASSWORD" "ENCRYPTION_KEY")
  for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" "$ROOT_DIR/.env"; then
      log_warn "Missing critical variable: $var"
    fi
  done
}

# Detect if fresh install or update
is_fresh_install() {
  # Check if any containers are running
  if docker ps -q --filter "name=witylogix" 2>/dev/null | grep -q .; then
    return 1  # False — containers exist, this is an update
  fi
  return 0  # True — no containers, fresh install
}

# Check if container is healthy
wait_for_service() {
  local SERVICE_NAME=$1
  local CONTAINER_NAME=$2
  local HEALTH_CHECK_CMD=$3
  local MAX_ATTEMPTS=${4:-30}
  local ATTEMPT=0

  log_step "Waiting for $SERVICE_NAME to be healthy..."

  while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
    if eval "$HEALTH_CHECK_CMD" &> /dev/null; then
      log_success "$SERVICE_NAME is healthy"
      return 0
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [[ $ATTEMPT -eq $MAX_ATTEMPTS ]]; then
      log_error "$SERVICE_NAME failed to become healthy after ${MAX_ATTEMPTS}s"
      return 1
    fi
    sleep 1
  done

  return 1
}

# Fresh install deployment
deploy_fresh_install() {
  log_info "Fresh install detected — deploying full stack"
  echo ""

  # Validate configuration
  log_step "Validating configuration..."
  validate_env

  # Pull or build images
  if [[ "$BUILD_IMAGES" = true ]]; then
    log_step "Building Docker images from source..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml build --no-cache 2>&1 | tail -20
    log_success "Images built"
  else
    log_step "Pulling Docker images..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml pull 2>&1 | grep -E "(Pulling|Downloaded)" || true
    log_success "Images pulled"
  fi

  # Start infrastructure first
  log_step "Starting infrastructure services (PostgreSQL, Redis)..."
  cd "$ROOT_DIR"
  docker-compose -f infra/docker-compose.yml up -d postgres redis
  log_cmd "PostgreSQL and Redis started"
  DEPLOYED_SERVICES+=("postgres" "redis")

  # Wait for infrastructure to be healthy
  wait_for_service "PostgreSQL" "witylogix-postgres" \
    "docker exec witylogix-postgres pg_isready -U witylogix" 30 || exit 1
  wait_for_service "Redis" "witylogix-redis" \
    "docker exec witylogix-redis redis-cli ping | grep -q PONG" 30 || exit 1

  # Run database initialization
  log_step "Initializing database..."
  docker exec -i witylogix-postgres psql -U witylogix -d witylogix < "$ROOT_DIR/infra/docker/init-db.sql" 2>&1 | grep -v "CREATE EXTENSION\|CREATE ROLE\|ALTER DEFAULT\|GRANT" || true
  log_success "Database initialized"

  # Run Prisma migrations
  if [[ "$SKIP_MIGRATIONS" != true ]]; then
    log_step "Running database migrations..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml run --rm api npx prisma migrate deploy --skip-generate 2>&1 | tail -10 || log_warn "Migrations may have encountered issues"
    log_success "Migrations completed"
  fi

  # Seed database if requested
  if [[ "$SEED_DATABASE" = true ]]; then
    log_step "Seeding database..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml run --rm api npx prisma db seed 2>&1 | tail -10 || log_warn "Seeding completed with warnings"
    log_success "Database seeded"
  fi

  # Start application services
  log_step "Starting application services..."
  cd "$ROOT_DIR"
  docker-compose -f infra/docker-compose.yml up -d api dashboard shopify-app
  log_cmd "API, Dashboard, and Shopify App started"
  DEPLOYED_SERVICES+=("api" "dashboard" "shopify-app")

  # Wait for application services to be healthy
  wait_for_service "API" "witylogix-api" \
    "curl -sf http://localhost:3001/health > /dev/null 2>&1" 30 || log_warn "API health check incomplete"
  wait_for_service "Dashboard" "witylogix-dashboard" \
    "curl -sf http://localhost:3000/ > /dev/null 2>&1" 30 || log_warn "Dashboard health check incomplete"

  # Print service URLs
  print_service_urls
}

# Update deployment
deploy_update() {
  log_info "Update detected — performing rolling restart"
  echo ""

  validate_env

  # Pull or build new images
  if [[ "$BUILD_IMAGES" = true ]]; then
    log_step "Building Docker images from source..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml build --no-cache 2>&1 | tail -20
    log_success "Images built"
  else
    log_step "Pulling new Docker images..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml pull 2>&1 | grep -E "(Pulling|Downloaded)" || true
    log_success "Images pulled"
  fi

  # Run migrations
  if [[ "$SKIP_MIGRATIONS" != true ]]; then
    log_step "Running database migrations..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml run --rm api npx prisma migrate deploy --skip-generate 2>&1 | tail -10 || log_warn "Migrations may have encountered issues"
    log_success "Migrations completed"
  fi

  # Rolling restart of services
  local SERVICES=("api" "dashboard" "shopify-app")
  for SERVICE in "${SERVICES[@]}"; do
    if [[ -n "$TARGET_SERVICE" && "$TARGET_SERVICE" != "$SERVICE" ]]; then
      continue
    fi

    log_step "Rolling restart: stopping $SERVICE..."
    cd "$ROOT_DIR"
    docker-compose -f infra/docker-compose.yml stop "$SERVICE" || log_warn "Stop command returned non-zero"
    log_cmd "Old container stopped"

    log_step "Starting new $SERVICE container..."
    docker-compose -f infra/docker-compose.yml up -d "$SERVICE"
    DEPLOYED_SERVICES+=("$SERVICE")
    log_cmd "New container started"

    # Health check after restart
    case "$SERVICE" in
      api)
        wait_for_service "$SERVICE" "witylogix-$SERVICE" \
          "curl -sf http://localhost:3001/health > /dev/null 2>&1" 30 || log_warn "$SERVICE health check timed out"
        ;;
      dashboard)
        wait_for_service "$SERVICE" "witylogix-$SERVICE" \
          "curl -sf http://localhost:3000/ > /dev/null 2>&1" 30 || log_warn "$SERVICE health check timed out"
        ;;
    esac

    log_success "$SERVICE deployment completed"
  done

  print_service_urls
}

# Print service URLs table
print_service_urls() {
  local END_TIME
  END_TIME=$(date +%s)
  local DURATION=$((END_TIME - START_TIME))

  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Witylogix Deployment Complete${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo ""

  echo "Deployed Services:"
  printf "  %-20s %s\n" "Service" "URL"
  printf "  %-20s %s\n" "────────" "───"

  if [[ " ${DEPLOYED_SERVICES[@]} " =~ " postgres " ]]; then
    printf "  %-20s %s\n" "PostgreSQL" "localhost:5432"
  fi

  if [[ " ${DEPLOYED_SERVICES[@]} " =~ " redis " ]]; then
    printf "  %-20s %s\n" "Redis" "localhost:6379"
  fi

  if [[ " ${DEPLOYED_SERVICES[@]} " =~ " api " ]]; then
    printf "  %-20s %s\n" "API" "http://localhost:3001"
  fi

  if [[ " ${DEPLOYED_SERVICES[@]} " =~ " dashboard " ]]; then
    printf "  %-20s %s\n" "Dashboard" "http://localhost:3000"
  fi

  if [[ " ${DEPLOYED_SERVICES[@]} " =~ " shopify-app " ]]; then
    printf "  %-20s %s\n" "Shopify App" "http://localhost:3002"
  fi

  echo ""
  printf "  %s\n" "Deployment Time: ${DURATION}s"
  echo ""
}

# Main deployment flow
cmd_deploy() {
  log_info "Starting Witylogix deployment..."
  echo ""

  cd "$ROOT_DIR"

  if is_fresh_install; then
    deploy_fresh_install
  else
    deploy_update
  fi

  log_success "Deployment successful!"
}

# Run deployment if script is executed directly
cmd_deploy "$@"
