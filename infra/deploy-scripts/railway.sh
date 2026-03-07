#!/usr/bin/env bash
#
# Witylogix Railway CLI — Deploy and manage Railway deployments
#
# Full-stack setup in one project: Postgres, Redis, API
#
# Usage:
#   ./infra/deploy-scripts/railway.sh [command] [options]
#
# Commands:
#   setup     Provision Postgres + Redis + API in the linked project
#   init      Create new Railway project and link
#   link      Link to an existing Railway project
#   deploy    Deploy the API (default)
#   logs      Stream deployment logs
#   status    Show deployment status
#   redeploy  Redeploy without uploading new code
#   vars      List or set environment variables
#   open      Open project in Railway dashboard
#   domain    Generate public domain for API service
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_NAME="witylogix"
ENVIRONMENT="production"
DETACH=false
CI_MODE=false
YES_MODE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }

check_railway_cli() {
  if ! command -v railway &> /dev/null; then
    log_error "Railway CLI is not installed."
    echo ""
    echo "Install: pnpm add -g @railway/cli  (or npm install -g @railway/cli)"
    echo "Then:   railway login"
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

cmd_init() {
  check_railway_cli
  cd "$ROOT_DIR"
  log_info "Creating new Railway project..."
  railway init --name Witylogix
  log_info "Project created. Run 'railway setup' to add Postgres, Redis, and deploy API."
}

confirm() {
  local prompt="$1"
  local default="${2:-n}"
  # --yes: accept all; --ci: skip (no TTY, don't add infra)
  if [[ "$YES_MODE" = true ]]; then
    return 0
  fi
  if [[ "$CI_MODE" = true ]]; then
    return 1
  fi
  local def_str="[y/N]"
  [[ "$default" = "y" ]] && def_str="[Y/n]"
  while true; do
    read -r -p "${prompt} ${def_str}: " reply
    reply="${reply:-$default}"
    case "$reply" in
      [yY]|[yY][eE][sS]) return 0 ;;
      [nN]|[nN][oO]|"") return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

cmd_setup() {
  check_railway_cli
  cd "$ROOT_DIR"

  if ! railway status &> /dev/null; then
    log_warn "No project linked. Run 'railway link' first, or 'railway init' to create one."
    railway link
  fi

  log_info "Setting up Witylogix stack..."

  ADD_POSTGRES=false
  ADD_REDIS=false

  if confirm "Add Postgres database?" "y"; then
    ADD_POSTGRES=true
  fi
  if confirm "Add Redis?" "y"; then
    ADD_REDIS=true
  fi

  if [[ "$ADD_POSTGRES" = true ]]; then
    log_cmd "Adding Postgres..."
    railway deploy -t postgres 2>/dev/null || log_warn "Postgres may already exist."
  fi

  if [[ "$ADD_REDIS" = true ]]; then
    log_cmd "Adding Redis..."
    railway deploy -t redis 2>/dev/null || log_warn "Redis may already exist."
  fi

  log_cmd "Deploying API..."
  cmd_deploy

  log_info "Setup complete."
  if [[ "$ADD_POSTGRES" = true || "$ADD_REDIS" = true ]]; then
    log_info "In Railway dashboard, set API service variables:"
    [[ "$ADD_POSTGRES" = true ]] && log_info "  DATABASE_URL = \${{Postgres.DATABASE_PRIVATE_URL}}"
    [[ "$ADD_REDIS" = true ]] && log_info "  REDIS_URL    = \${{Redis.REDIS_URL}}"
    log_info "  JWT_SECRET   = (generate a secure random string)"
  fi
}

cmd_link() {
  check_railway_cli
  cd "$ROOT_DIR"
  log_info "Linking to Railway project..."
  railway link
  log_info "Linked. Run 'railway deploy' or 'railway setup' next."
}

cmd_deploy() {
  check_railway_cli
  cd "$ROOT_DIR"

  log_info "Deploying Witylogix API..."
  log_info "Environment: $ENVIRONMENT"

  RAILWAY_ARGS=(up --environment "$ENVIRONMENT")
  [[ "$DETACH" = true ]] && RAILWAY_ARGS+=(--detach)
  [[ "$CI_MODE" = true ]] && RAILWAY_ARGS+=(--ci)

  # Try with service first; fall back to no service (single-service project)
  if [[ -n "$SERVICE_NAME" ]]; then
    railway "${RAILWAY_ARGS[@]}" --service "$SERVICE_NAME" 2>/dev/null || \
      railway "${RAILWAY_ARGS[@]}"
  else
    railway "${RAILWAY_ARGS[@]}"
  fi

  [[ "$DETACH" = false && "$CI_MODE" = false ]] && log_info "Deployment complete."
}

cmd_logs() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"
  local SVC=""
  [[ -n "$SERVICE_NAME" ]] && SVC="--service $SERVICE_NAME"
  railway logs $SVC --environment "$ENVIRONMENT"
}

cmd_status() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"
  local SVC=""
  [[ -n "$SERVICE_NAME" ]] && SVC="--service $SERVICE_NAME"
  railway status $SVC --environment "$ENVIRONMENT"
}

cmd_redeploy() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"
  log_info "Redeploying..."
  local SVC=""
  [[ -n "$SERVICE_NAME" ]] && SVC="--service $SERVICE_NAME"
  railway redeploy $SVC --environment "$ENVIRONMENT"
  log_info "Redeploy triggered."
}

cmd_vars() {
  check_railway_cli
  ensure_linked
  cd "$ROOT_DIR"
  local SUB="${1:-list}"
  shift || true
  local SVC=""
  [[ -n "$SERVICE_NAME" ]] && SVC="--service $SERVICE_NAME"
  case "$SUB" in
    list) railway variable list $SVC --environment "$ENVIRONMENT" ;;
    set)  railway variable set "$@" $SVC --environment "$ENVIRONMENT" ;;
    *)    railway variable "$SUB" "$@" $SVC --environment "$ENVIRONMENT" ;;
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
  local SVC=""
  [[ -n "$SERVICE_NAME" ]] && SVC="--service $SERVICE_NAME"
  railway domain $SVC --environment "$ENVIRONMENT"
}

show_help() {
  echo "Witylogix Railway CLI — Deploy and manage Railway"
  echo ""
  echo "Usage: ./infra/deploy-scripts/railway.sh [command] [options]"
  echo ""
  echo "Commands:"
  echo "  setup     Provision Postgres + Redis + deploy API (full stack)"
  echo "  init      Create new Railway project and link"
  echo "  link      Link to existing Railway project"
  echo "  deploy    Deploy the API (default)"
  echo "  logs      Stream deployment logs"
  echo "  status    Show deployment status"
  echo "  redeploy  Redeploy without uploading new code"
  echo "  vars      List variables (vars set KEY=val to set)"
  echo "  open      Open project in Railway dashboard"
  echo "  domain    Generate public domain for API"
  echo ""
  echo "Options:"
  echo "  -s, --service NAME     Target service (default: witylogix)"
  echo "  -e, --environment ENV Target environment (default: production)"
  echo "  -d, --detach          Deploy in background"
  echo "  -c, --ci              CI mode: build logs only"
  echo "  -y, --yes             Non-interactive: accept all prompts (setup)"
  echo "  -h, --help            Show this help"
  echo ""
  echo "Examples:"
  echo "  railway.sh init              # Create new project"
  echo "  railway.sh link              # Link to existing project"
  echo "  railway.sh setup             # Add Postgres, Redis, deploy API"
  echo "  railway.sh deploy            # Deploy API only"
  echo "  railway.sh vars list         # List environment variables"
  echo "  railway.sh vars set JWT_SECRET=xxx"
  echo "  railway.sh domain            # Generate public URL"
}

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--service)    SERVICE_NAME="$2"; shift 2 ;;
    -e|--environment) ENVIRONMENT="$2"; shift 2 ;;
    -d|--detach)    DETACH=true; shift ;;
    -c|--ci)        CI_MODE=true; shift ;;
    -y|--yes)       YES_MODE=true; shift ;;
    -h|--help)      show_help; exit 0 ;;
    setup|init|link|deploy|logs|status|redeploy|vars|open|domain)
      break ;;
    -*)             log_error "Unknown option: $1"; show_help; exit 1 ;;
    *)              break ;;
  esac
done

COMMAND="${1:-deploy}"
shift || true

case $COMMAND in
  setup)   cmd_setup ;;
  init)    cmd_init ;;
  link)    cmd_link ;;
  deploy)  cmd_deploy ;;
  logs)    cmd_logs ;;
  status)  cmd_status ;;
  redeploy) cmd_redeploy ;;
  vars)   cmd_vars "$@" ;;
  open)   cmd_open ;;
  domain) cmd_domain ;;
  *)      log_error "Unknown command: $COMMAND"; show_help; exit 1 ;;
esac
