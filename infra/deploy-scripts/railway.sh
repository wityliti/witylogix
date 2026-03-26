#!/usr/bin/env bash
#
# Witylogix Railway CLI — Deploy and manage Railway deployments
#
# Multi-service monorepo deployment: each app as a separate Railway service
# sharing Postgres + Redis in one project.
#
# Usage:
#   ./infra/deploy-scripts/railway.sh [command] [options]
#
# Commands:
#   setup       Provision Postgres + Redis + all services
#   init        Create new Railway project and link
#   link        Link to an existing Railway project
#   deploy      Deploy a single service (default: api)
#   deploy-all  Deploy all services in parallel
#   logs        Stream deployment logs for a service
#   status      Show deployment status
#   redeploy    Redeploy a service without uploading new code
#   vars        List or set environment variables
#   open        Open project in Railway dashboard
#   domain      Generate public domain for a service
#   services    List all deployable services
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_NAME=""
ENVIRONMENT="production"
DETACH=false
CI_MODE=false
YES_MODE=false

# Deployable services (parallel arrays for bash 3 compat)
SERVICE_NAMES=(api dashboard customer-portal docs shopify-app tracking-page)
SERVICE_DIRS=(apps/api apps/dashboard apps/customer-portal apps/docs apps/shopify-app apps/tracking-page)

# Lookup service directory by name
get_service_dir() {
  local name="$1"
  for i in "${!SERVICE_NAMES[@]}"; do
    if [[ "${SERVICE_NAMES[$i]}" = "$name" ]]; then
      echo "${SERVICE_DIRS[$i]}"
      return 0
    fi
  done
  return 1
}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }
log_cmd()   { echo -e "${CYAN}  →${NC} $1"; }

check_railway_cli() {
  if ! command -v railway &> /dev/null; then
    log_error "Railway CLI is not installed."
    echo ""
    echo "Install: npm install -g @railway/cli"
    echo "Then:    railway login"
    exit 1
  fi
}

ensure_linked() {
  cd "$ROOT_DIR"
  if ! railway status &> /dev/null; then
    log_error "No project linked. Run: ./infra/deploy-scripts/railway.sh link"
    exit 1
  fi
}

confirm() {
  local prompt="$1"
  local default="${2:-n}"
  if [[ "$YES_MODE" = true ]]; then return 0; fi
  if [[ "$CI_MODE" = true ]]; then return 1; fi
  local def_str="[y/N]"
  [[ "$default" = "y" ]] && def_str="[Y/n]"
  while true; do
    read -r -p "${prompt} ${def_str}: " reply
    reply="${reply:-$default}"
    case "$reply" in
      [yY]|[yY][eE][sS]) return 0 ;;
      [nN]|[nN][oO]|"")  return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

validate_service() {
  local svc="$1"
  if ! get_service_dir "$svc" > /dev/null; then
    log_error "Unknown service: $svc"
    echo ""
    echo "Available services:"
    for i in "${!SERVICE_NAMES[@]}"; do
      echo "  - ${SERVICE_NAMES[$i]}  (${SERVICE_DIRS[$i]})"
    done
    exit 1
  fi
}

# ─── Commands ────────────────────────────────────────────────

cmd_services() {
  echo -e "${BOLD}Deployable Services${NC}"
  echo ""
  printf "  %-20s %-25s %s\n" "SERVICE" "DIRECTORY" "CONFIG"
  printf "  %-20s %-25s %s\n" "-------" "---------" "------"
  for i in "${!SERVICE_NAMES[@]}"; do
    local svc="${SERVICE_NAMES[$i]}"
    local dir="${SERVICE_DIRS[$i]}"
    local config="railway.toml"
    [[ -f "$ROOT_DIR/$dir/Dockerfile" ]] && config="Dockerfile"
    printf "  %-20s %-25s %s\n" "$svc" "$dir/" "$config"
  done
  echo ""
  echo "Not deployable to Railway:"
  echo "  - driver-app  (Expo/React Native — use EAS Build)"
}

cmd_init() {
  check_railway_cli
  cd "$ROOT_DIR"
  log_info "Creating new Railway project..."
  railway init --name Witylogix
  log_info "Project created. Run 'railway.sh setup' to provision infra and deploy all services."
}

cmd_link() {
  check_railway_cli
  cd "$ROOT_DIR"
  log_info "Linking to Railway project..."
  railway link
  log_info "Linked. Run 'railway.sh setup' or 'railway.sh deploy-all' next."
}

cmd_setup() {
  check_railway_cli
  cd "$ROOT_DIR"

  if ! railway status &> /dev/null; then
    log_warn "No project linked. Run 'railway link' first, or 'railway init' to create one."
    railway link
  fi

  log_info "Setting up Witylogix multi-service stack..."
  echo ""

  # Infrastructure
  local ADD_POSTGRES=false
  local ADD_REDIS=false

  if confirm "Add Postgres database?" "y"; then ADD_POSTGRES=true; fi
  if confirm "Add Redis?" "y"; then ADD_REDIS=true; fi

  if [[ "$ADD_POSTGRES" = true ]]; then
    log_cmd "Adding Postgres..."
    railway add --plugin postgresql 2>/dev/null || log_warn "Postgres may already exist."
  fi

  if [[ "$ADD_REDIS" = true ]]; then
    log_cmd "Adding Redis..."
    railway add --plugin redis 2>/dev/null || log_warn "Redis may already exist."
  fi

  echo ""

  # Deploy services
  if confirm "Deploy all services now?" "y"; then
    cmd_deploy_all
  else
    log_info "Skipping deploy. Run 'railway.sh deploy-all' when ready."
  fi

  echo ""
  log_info "Setup complete."
  echo ""
  echo -e "${BOLD}Next steps:${NC}"
  echo "  1. Set shared environment variables in Railway dashboard:"
  [[ "$ADD_POSTGRES" = true ]] && echo "     DATABASE_URL = \${{Postgres.DATABASE_PRIVATE_URL}}"
  [[ "$ADD_REDIS" = true ]]    && echo "     REDIS_URL    = \${{Redis.REDIS_URL}}"
  echo "     JWT_SECRET   = (generate a secure random string)"
  echo "     NODE_ENV     = production"
  echo ""
  echo "  2. Generate public domains:"
  echo "     railway.sh domain -s api"
  echo "     railway.sh domain -s dashboard"
  echo "     railway.sh domain -s customer-portal"
  echo ""
  echo "  3. Set cross-service URLs (after domains are generated):"
  echo "     NEXT_PUBLIC_API_URL = https://api-xxx.up.railway.app"
}

deploy_service() {
  local svc="$1"
  local dir
  dir="$(get_service_dir "$svc")"

  # Map service name to Railway service name (api uses existing "Witylogix" service)
  local railway_svc="$svc"
  [[ "$svc" = "api" ]] && railway_svc="Witylogix"

  log_cmd "Deploying ${BOLD}$svc${NC} → Railway service '$railway_svc'"

  cd "$ROOT_DIR"

  local RAILWAY_ARGS=(up --environment "$ENVIRONMENT" --service "$railway_svc")
  [[ "$DETACH" = true ]]   && RAILWAY_ARGS+=(--detach)
  [[ "$CI_MODE" = true ]]  && RAILWAY_ARGS+=(--ci)

  # Deploy from repo root — Railway uses each service's railway.toml for build config
  railway "${RAILWAY_ARGS[@]}" 2>&1
}

cmd_deploy() {
  check_railway_cli
  ensure_linked

  local target="${SERVICE_NAME:-api}"
  validate_service "$target"

  log_info "Deploying service: $target"
  log_info "Environment: $ENVIRONMENT"
  echo ""

  deploy_service "$target"

  log_info "Deploy complete: $target"
}

cmd_deploy_all() {
  check_railway_cli
  ensure_linked

  log_info "Deploying all services..."
  log_info "Environment: $ENVIRONMENT"
  echo ""

  local PIDS=()
  local SERVICES=()
  local LOG_DIR
  LOG_DIR=$(mktemp -d)

  for svc in "${SERVICE_NAMES[@]}"; do
    log_cmd "Starting deploy: $svc"
    deploy_service "$svc" > "$LOG_DIR/$svc.log" 2>&1 &
    PIDS+=($!)
    SERVICES+=("$svc")
  done

  echo ""
  log_info "Waiting for ${#PIDS[@]} deployments..."
  echo ""

  local FAILED=0
  for i in "${!PIDS[@]}"; do
    local svc="${SERVICES[$i]}"
    local pid="${PIDS[$i]}"

    if wait "$pid"; then
      echo -e "  ${GREEN}✓${NC} $svc"
    else
      echo -e "  ${RED}✗${NC} $svc (see log below)"
      FAILED=$((FAILED + 1))
      echo -e "${YELLOW}--- $svc deploy log ---${NC}"
      cat "$LOG_DIR/$svc.log"
      echo -e "${YELLOW}--- end $svc ---${NC}"
    fi
  done

  rm -rf "$LOG_DIR"

  echo ""
  if [[ "$FAILED" -gt 0 ]]; then
    log_error "$FAILED service(s) failed to deploy."
    exit 1
  else
    log_info "All ${#SERVICES[@]} services deployed successfully."
  fi
}

cmd_logs() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"

  local target="${SERVICE_NAME:-api}"
  validate_service "$target"

  railway logs --service "$target" --environment "$ENVIRONMENT"
}

cmd_status() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"

  if [[ -n "$SERVICE_NAME" ]]; then
    validate_service "$SERVICE_NAME"
    railway status --service "$SERVICE_NAME" --environment "$ENVIRONMENT"
  else
    log_info "Checking status for all services..."
    echo ""
    for svc in "${SERVICE_NAMES[@]}"; do
      echo -e "${BOLD}[$svc]${NC}"
      railway status --service "$svc" --environment "$ENVIRONMENT" 2>/dev/null || echo "  (not deployed)"
      echo ""
    done
  fi
}

cmd_redeploy() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"

  local target="${SERVICE_NAME:-api}"
  validate_service "$target"

  log_info "Redeploying $target..."
  railway redeploy --service "$target" --environment "$ENVIRONMENT"
  log_info "Redeploy triggered: $target"
}

cmd_vars() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"

  local SUB="${1:-list}"
  shift || true

  local SVC_FLAG=""
  if [[ -n "$SERVICE_NAME" ]]; then
    validate_service "$SERVICE_NAME"
    SVC_FLAG="--service $SERVICE_NAME"
  fi

  case "$SUB" in
    list) railway variable list $SVC_FLAG --environment "$ENVIRONMENT" ;;
    set)  railway variable set "$@" $SVC_FLAG --environment "$ENVIRONMENT" ;;
    *)    railway variable "$SUB" "$@" $SVC_FLAG --environment "$ENVIRONMENT" ;;
  esac
}

cmd_open() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"
  railway open
}

cmd_domain() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"

  local target="${SERVICE_NAME:-api}"
  validate_service "$target"

  railway domain --service "$target" --environment "$ENVIRONMENT"
}

show_help() {
  echo -e "${BOLD}Witylogix Railway CLI${NC} — Multi-service deployment"
  echo ""
  echo "Usage: ./infra/deploy-scripts/railway.sh [command] [options]"
  echo ""
  echo "Commands:"
  echo "  setup       Provision Postgres + Redis + deploy all services"
  echo "  init        Create new Railway project and link"
  echo "  link        Link to existing Railway project"
  echo "  deploy      Deploy a single service (default: api)"
  echo "  deploy-all  Deploy all services in parallel"
  echo "  services    List all deployable services"
  echo "  logs        Stream logs for a service"
  echo "  status      Show status (all services if no -s flag)"
  echo "  redeploy    Redeploy a service"
  echo "  vars        List variables (vars set KEY=val to set)"
  echo "  open        Open project in Railway dashboard"
  echo "  domain      Generate public domain for a service"
  echo ""
  echo "Options:"
  echo "  -s, --service NAME      Target service (api, dashboard, customer-portal, docs, shopify-app, tracking-page)"
  echo "  -e, --environment ENV   Target environment (default: production)"
  echo "  -d, --detach            Deploy in background"
  echo "  -c, --ci                CI mode: build logs only"
  echo "  -y, --yes               Non-interactive: accept all prompts"
  echo "  -h, --help              Show this help"
  echo ""
  echo "Examples:"
  echo "  railway.sh setup                    # Full stack setup"
  echo "  railway.sh deploy                   # Deploy API only"
  echo "  railway.sh deploy -s dashboard      # Deploy dashboard"
  echo "  railway.sh deploy-all               # Deploy all services in parallel"
  echo "  railway.sh deploy-all --detach      # Deploy all, don't wait"
  echo "  railway.sh logs -s customer-portal  # Stream portal logs"
  echo "  railway.sh status                   # Status of all services"
  echo "  railway.sh domain -s api            # Generate domain for API"
  echo "  railway.sh vars set JWT_SECRET=xxx -s api"
  echo "  railway.sh services                 # List all services"
}

# ─── Parse Options ───────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--service)     SERVICE_NAME="$2"; shift 2 ;;
    -e|--environment) ENVIRONMENT="$2"; shift 2 ;;
    -d|--detach)      DETACH=true; shift ;;
    -c|--ci)          CI_MODE=true; shift ;;
    -y|--yes)         YES_MODE=true; shift ;;
    -h|--help)        show_help; exit 0 ;;
    setup|init|link|deploy|deploy-all|logs|status|redeploy|vars|open|domain|services)
      break ;;
    -*)  log_error "Unknown option: $1"; show_help; exit 1 ;;
    *)   break ;;
  esac
done

COMMAND="${1:-deploy}"
shift || true

case $COMMAND in
  setup)      cmd_setup ;;
  init)       cmd_init ;;
  link)       cmd_link ;;
  deploy)     cmd_deploy ;;
  deploy-all) cmd_deploy_all ;;
  services)   cmd_services ;;
  logs)       cmd_logs ;;
  status)     cmd_status ;;
  redeploy)   cmd_redeploy ;;
  vars)       cmd_vars "$@" ;;
  open)       cmd_open ;;
  domain)     cmd_domain ;;
  *)          log_error "Unknown command: $COMMAND"; show_help; exit 1 ;;
esac
