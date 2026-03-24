#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  WityLogix Platform CLI
#  Interactive launcher for all platform apps & services
# ═══════════════════════════════════════════════════════════════

set -e

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── Paths ─────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# ── Helpers ───────────────────────────────────────────────────
header() {
  [ -t 1 ] && clear 2>/dev/null || true
  echo ""
  echo -e "${MAGENTA}${BOLD}  ╔══════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}${BOLD}  ║        🚚  WityLogix Platform CLI           ║${NC}"
  echo -e "${MAGENTA}${BOLD}  ║        Delivery logistics command center    ║${NC}"
  echo -e "${MAGENTA}${BOLD}  ╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

info()    { echo -e "  ${BLUE}ℹ${NC}  $1"; }
success() { echo -e "  ${GREEN}✓${NC}  $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "  ${RED}✗${NC}  $1"; }

check_port() {
  local port=$1
  if lsof -i :"$port" -sTCP:LISTEN &>/dev/null; then
    return 0  # Port in use
  fi
  # Fallback: try connecting
  if curl -s --max-time 1 "http://localhost:$port" -o /dev/null 2>/dev/null; then
    return 0
  fi
  return 1    # Port free
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    success "Killed process on port $port"
  fi
}

wait_for_port() {
  local port=$1
  local name=$2
  local timeout=${3:-30}
  local elapsed=0
  echo -ne "  ${DIM}Waiting for $name on port $port...${NC}"
  while ! check_port "$port"; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge $timeout ]; then
      echo ""
      error "$name failed to start within ${timeout}s"
      return 1
    fi
    echo -ne "."
  done
  echo ""
  success "$name is running on port $port"
}

# ── Status Check ──────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "  ${BOLD}Service Status:${NC}"
  echo -e "  ${DIM}─────────────────────────────────────────${NC}"

  local services=(
    "8000:API Server"
    "3003:Dashboard"
    "3004:Customer Portal"
    "3005:Docs"
    "3001:Shopify App"
    "5173:Tracking Page"
    "8081:Driver App (Expo)"
  )

  for svc in "${services[@]}"; do
    IFS=':' read -r port name <<< "$svc"
    if check_port "$port"; then
      echo -e "  ${GREEN}●${NC}  ${name}${DIM} — localhost:${port}${NC}"
    else
      echo -e "  ${DIM}○  ${name} — stopped${NC}"
    fi
  done

  echo -e "  ${DIM}─────────────────────────────────────────${NC}"
  echo ""
}

# ── Resolve tsx loader path (works across macOS/Linux, any tsx version) ──
resolve_tsx() {
  local tsx_esm
  # Try npx tsx resolution first (most reliable)
  tsx_esm=$(node -e "try{console.log(require.resolve('tsx/esm/index.mjs'))}catch{}" 2>/dev/null)
  if [ -n "$tsx_esm" ] && [ -f "$tsx_esm" ]; then
    echo "$tsx_esm"
    return
  fi
  # Fallback: find in node_modules
  tsx_esm=$(find "$ROOT_DIR/node_modules/.pnpm" -path "*/tsx@*/node_modules/tsx/dist/esm/index.mjs" -print -quit 2>/dev/null)
  if [ -n "$tsx_esm" ] && [ -f "$tsx_esm" ]; then
    echo "$tsx_esm"
    return
  fi
  # Last resort: npx
  echo "npx:tsx"
}

TSX_LOADER=""

ensure_tsx() {
  if [ -z "$TSX_LOADER" ]; then
    TSX_LOADER=$(resolve_tsx)
  fi
  if [ "$TSX_LOADER" = "npx:tsx" ]; then
    error "tsx not found. Run: pnpm install"
    return 1
  fi
}

# ── App Launchers ─────────────────────────────────────────────
start_api() {
  info "Starting API Server (Fastify) on port 8000..."
  if check_port 8000; then
    warn "API already running on port 8000"
    return
  fi
  ensure_tsx || return 1
  # Load env vars
  set -a
  source "$ROOT_DIR/.env" 2>/dev/null || true
  set +a
  : > /tmp/wl-api.log
  nohup node --import "$TSX_LOADER" apps/api/src/server.ts > /tmp/wl-api.log 2>&1 &
  disown
  wait_for_port 8000 "API Server" 25
}

start_dashboard() {
  info "Starting Dashboard (Next.js) on port 3003..."
  if check_port 3003; then
    warn "Dashboard already running on port 3003"
    return
  fi
  cd "$ROOT_DIR/apps/dashboard"
  : > /tmp/wl-dashboard.log
  nohup npx next dev -p 3003 > /tmp/wl-dashboard.log 2>&1 &
  disown
  cd "$ROOT_DIR"
  wait_for_port 3003 "Dashboard" 30
}

start_customer_portal() {
  info "Starting Customer Portal (Next.js) on port 3004..."
  if check_port 3004; then
    warn "Customer Portal already running on port 3004"
    return
  fi
  cd "$ROOT_DIR/apps/customer-portal"
  nohup npx next dev --port 3004 > /tmp/wl-portal.log 2>&1 &
  disown
  cd "$ROOT_DIR"
  wait_for_port 3004 "Customer Portal" 30
}

start_docs() {
  info "Starting Docs (Next.js) on port 3005..."
  if check_port 3005; then
    warn "Docs already running on port 3005"
    return
  fi
  cd "$ROOT_DIR/apps/docs"
  nohup npx next dev --port 3005 > /tmp/wl-docs.log 2>&1 &
  disown
  cd "$ROOT_DIR"
  wait_for_port 3005 "Docs" 30
}

start_tracking() {
  info "Starting Tracking Page (Vite) on port 5173..."
  if check_port 5173; then
    warn "Tracking Page already running on port 5173"
    return
  fi
  cd "$ROOT_DIR/apps/tracking-page"
  nohup npx vite dev > /tmp/wl-tracking.log 2>&1 &
  disown
  cd "$ROOT_DIR"
  wait_for_port 5173 "Tracking Page" 15
}

start_shopify() {
  info "Starting Shopify App on port 3001..."
  if check_port 3001; then
    warn "Shopify App already running on port 3001"
    return
  fi
  warn "Shopify App requires 'shopify' CLI and partner credentials."
  warn "Run manually: cd apps/shopify-app && pnpm dev"
}

start_driver_app() {
  info "Driver App (React Native / Expo)..."
  warn "Driver App requires Expo CLI and a device/emulator."
  warn "Run manually: cd apps/driver-app && pnpm start"
}

# ── Combo Launchers ───────────────────────────────────────────
start_core() {
  echo ""
  echo -e "  ${BOLD}Starting core services (API + Dashboard)...${NC}"
  echo ""
  start_api
  start_dashboard
  echo ""
  success "Core services ready!"
  echo -e "  ${CYAN}→${NC} API:       ${BOLD}http://localhost:8000${NC}"
  echo -e "  ${CYAN}→${NC} Dashboard: ${BOLD}http://localhost:3003${NC}"
  echo -e "  ${DIM}  Login: admin@demo.witylogix.io / Admin123!${NC}"
  echo ""
}

start_all_web() {
  echo ""
  echo -e "  ${BOLD}Starting all web apps...${NC}"
  echo ""
  start_api
  start_dashboard
  start_customer_portal
  start_docs
  start_tracking
  echo ""
  success "All web apps ready!"
  echo ""
}

stop_all() {
  echo ""
  info "Stopping all services..."
  local ports=(8000 3003 3004 3005 3001 5173 8081)
  for port in "${ports[@]}"; do
    kill_port "$port"
  done
  success "All services stopped."
  echo ""
}

# ── DB Operations ─────────────────────────────────────────────
db_menu() {
  echo ""
  echo -e "  ${BOLD}Database Operations:${NC}"
  echo ""
  echo -e "  ${CYAN}1${NC}) Generate Prisma Client"
  echo -e "  ${CYAN}2${NC}) Push Schema to Database"
  echo -e "  ${CYAN}3${NC}) Seed Database"
  echo -e "  ${CYAN}4${NC}) Reset & Re-seed"
  echo -e "  ${CYAN}5${NC}) Open Prisma Studio"
  echo -e "  ${CYAN}0${NC}) Back"
  echo ""
  read -rp "  Choose: " db_choice

  local PRISMA="./node_modules/.pnpm/node_modules/.bin/prisma"
  local SCHEMA="--schema packages/db/prisma/schema"

  case $db_choice in
    1)
      info "Generating Prisma Client..."
      cd "$ROOT_DIR/packages/db" && ../../node_modules/.pnpm/node_modules/.bin/prisma generate --schema prisma/schema
      cd "$ROOT_DIR"
      success "Prisma Client generated"
      ;;
    2)
      info "Pushing schema to database..."
      cd "$ROOT_DIR/packages/db" && ../../node_modules/.pnpm/node_modules/.bin/prisma db push --schema prisma/schema
      cd "$ROOT_DIR"
      success "Schema pushed"
      ;;
    3)
      info "Seeding database..."
      set -a; source "$ROOT_DIR/.env" 2>/dev/null || true; set +a
      ensure_tsx && node --import "$TSX_LOADER" packages/db/prisma/seed.ts
      success "Database seeded"
      ;;
    4)
      warn "This will reset the database. Continue? (y/N)"
      read -rp "  " confirm
      if [[ "$confirm" =~ ^[Yy]$ ]]; then
        cd "$ROOT_DIR/packages/db" && ../../node_modules/.pnpm/node_modules/.bin/prisma db push --schema prisma/schema --force-reset
        cd "$ROOT_DIR"
        set -a; source "$ROOT_DIR/.env" 2>/dev/null || true; set +a
        ensure_tsx && node --import "$TSX_LOADER" packages/db/prisma/seed.ts
        success "Database reset and seeded"
      fi
      ;;
    5)
      info "Opening Prisma Studio..."
      cd "$ROOT_DIR/packages/db" && ../../node_modules/.pnpm/node_modules/.bin/prisma studio --schema prisma/schema &
      cd "$ROOT_DIR"
      ;;
    0|"") return ;;
    *) error "Invalid choice" ;;
  esac
  echo ""
  read -rp "  Press Enter to continue..."
}

# ── Test Operations ───────────────────────────────────────────
test_menu() {
  echo ""
  echo -e "  ${BOLD}Testing:${NC}"
  echo ""
  echo -e "  ${CYAN}1${NC}) Run E2E Tests (Playwright)"
  echo -e "  ${CYAN}2${NC}) Run E2E Tests (Headed)"
  echo -e "  ${CYAN}3${NC}) Run Unit Tests (Vitest)"
  echo -e "  ${CYAN}4${NC}) Type Check"
  echo -e "  ${CYAN}0${NC}) Back"
  echo ""
  read -rp "  Choose: " test_choice

  case $test_choice in
    1)
      info "Running Playwright E2E tests..."
      cd "$ROOT_DIR/apps/dashboard" && npx playwright test --reporter=list
      cd "$ROOT_DIR"
      ;;
    2)
      info "Running Playwright E2E tests (headed)..."
      cd "$ROOT_DIR/apps/dashboard" && npx playwright test --headed
      cd "$ROOT_DIR"
      ;;
    3)
      info "Running unit tests..."
      ./node_modules/.pnpm/node_modules/.bin/vitest run 2>&1 || true
      ;;
    4)
      info "Running type check..."
      pnpm turbo typecheck 2>&1 || true
      ;;
    0|"") return ;;
    *) error "Invalid choice" ;;
  esac
  echo ""
  read -rp "  Press Enter to continue..."
}

# ── Logs Viewer ───────────────────────────────────────────────
view_logs() {
  echo ""
  echo -e "  ${BOLD}View Logs:${NC}"
  echo ""
  echo -e "  ${CYAN}1${NC}) API Server"
  echo -e "  ${CYAN}2${NC}) Dashboard"
  echo -e "  ${CYAN}3${NC}) Customer Portal"
  echo -e "  ${CYAN}4${NC}) Docs"
  echo -e "  ${CYAN}5${NC}) Tracking Page"
  echo -e "  ${CYAN}0${NC}) Back"
  echo ""
  read -rp "  Choose: " log_choice

  local logfiles=(
    ""
    "/tmp/wl-api.log"
    "/tmp/wl-dashboard.log"
    "/tmp/wl-portal.log"
    "/tmp/wl-docs.log"
    "/tmp/wl-tracking.log"
  )

  if [[ "$log_choice" =~ ^[1-5]$ ]] && [ -f "${logfiles[$log_choice]}" ]; then
    echo ""
    echo -e "  ${DIM}── Last 40 lines (Ctrl+C to exit) ──${NC}"
    tail -40 "${logfiles[$log_choice]}"
  elif [[ "$log_choice" == "0" || -z "$log_choice" ]]; then
    return
  else
    error "Log file not found. Start the service first."
  fi
  echo ""
  read -rp "  Press Enter to continue..."
}

# ── Main Menu ─────────────────────────────────────────────────
main_menu() {
  while true; do
    header
    show_status

    echo -e "  ${BOLD}Quick Start:${NC}"
    echo -e "  ${GREEN}1${NC}) Start Core ${DIM}(API + Dashboard)${NC}"
    echo -e "  ${GREEN}2${NC}) Start All Web Apps"
    echo ""
    echo -e "  ${BOLD}Individual Apps:${NC}"
    echo -e "  ${CYAN}3${NC}) API Server       ${DIM}:8000${NC}"
    echo -e "  ${CYAN}4${NC}) Dashboard         ${DIM}:3003${NC}"
    echo -e "  ${CYAN}5${NC}) Customer Portal   ${DIM}:3004${NC}"
    echo -e "  ${CYAN}6${NC}) Docs              ${DIM}:3005${NC}"
    echo -e "  ${CYAN}7${NC}) Tracking Page     ${DIM}:5173${NC}"
    echo -e "  ${CYAN}8${NC}) Shopify App       ${DIM}:3001${NC}"
    echo -e "  ${CYAN}9${NC}) Driver App        ${DIM}(Expo)${NC}"
    echo ""
    echo -e "  ${BOLD}Tools:${NC}"
    echo -e "  ${YELLOW}d${NC}) Database Operations"
    echo -e "  ${YELLOW}t${NC}) Run Tests"
    echo -e "  ${YELLOW}l${NC}) View Logs"
    echo -e "  ${YELLOW}s${NC}) Refresh Status"
    echo ""
    echo -e "  ${RED}x${NC}) Stop All Services"
    echo -e "  ${DIM}q${NC}) Quit"
    echo ""
    read -rp "  Choose: " choice

    case $choice in
      1) start_core ;;
      2) start_all_web ;;
      3) start_api ;;
      4) start_dashboard ;;
      5) start_customer_portal ;;
      6) start_docs ;;
      7) start_tracking ;;
      8) start_shopify ;;
      9) start_driver_app ;;
      d|D) db_menu ;;
      t|T) test_menu ;;
      l|L) view_logs ;;
      s|S) continue ;;  # Just re-render
      x|X) stop_all ;;
      q|Q) echo ""; info "Goodbye!"; echo ""; exit 0 ;;
      *) error "Invalid choice" ;;
    esac

    if [[ ! "$choice" =~ ^[sSdDtTlL]$ ]]; then
      read -rp "  Press Enter to continue..."
    fi
  done
}

# ── CLI Arguments (non-interactive mode) ──────────────────────
if [ $# -gt 0 ]; then
  case "$1" in
    start)
      shift
      case "${1:-core}" in
        core)      start_core ;;
        all)       start_all_web ;;
        api)       start_api ;;
        dashboard) start_dashboard ;;
        portal)    start_customer_portal ;;
        docs)      start_docs ;;
        tracking)  start_tracking ;;
        *) error "Unknown app: $1. Options: core, all, api, dashboard, portal, docs, tracking" ;;
      esac
      ;;
    stop)
      stop_all ;;
    status)
      header; show_status ;;
    logs)
      shift
      case "${1:-api}" in
        api)       tail -50 /tmp/wl-api.log 2>/dev/null || error "No API logs" ;;
        dashboard) tail -50 /tmp/wl-dashboard.log 2>/dev/null || error "No dashboard logs" ;;
        portal)    tail -50 /tmp/wl-portal.log 2>/dev/null || error "No portal logs" ;;
        *) error "Unknown log: $1" ;;
      esac
      ;;
    test)
      shift
      case "${1:-e2e}" in
        e2e)  cd "$ROOT_DIR/apps/dashboard" && npx playwright test --reporter=list ;;
        unit) ./node_modules/.pnpm/node_modules/.bin/vitest run ;;
        *) error "Unknown test: $1. Options: e2e, unit" ;;
      esac
      ;;
    db)
      shift
      case "${1:-}" in
        generate) cd packages/db && ../../node_modules/.pnpm/node_modules/.bin/prisma generate --schema prisma/schema ;;
        push)     cd packages/db && ../../node_modules/.pnpm/node_modules/.bin/prisma db push --schema prisma/schema ;;
        seed)     set -a; source "$ROOT_DIR/.env" 2>/dev/null; set +a; ensure_tsx && node --import "$TSX_LOADER" packages/db/prisma/seed.ts ;;
        studio)   cd packages/db && ../../node_modules/.pnpm/node_modules/.bin/prisma studio --schema prisma/schema ;;
        *) error "Unknown db command: $1. Options: generate, push, seed, studio" ;;
      esac
      ;;
    help|-h|--help)
      header
      echo -e "  ${BOLD}Usage:${NC}"
      echo -e "    ${CYAN}./cli.sh${NC}                    Interactive menu"
      echo -e "    ${CYAN}./cli.sh start${NC} [app]        Start services (core|all|api|dashboard|portal|docs|tracking)"
      echo -e "    ${CYAN}./cli.sh stop${NC}               Stop all services"
      echo -e "    ${CYAN}./cli.sh status${NC}             Show service status"
      echo -e "    ${CYAN}./cli.sh logs${NC} [app]         View logs (api|dashboard|portal)"
      echo -e "    ${CYAN}./cli.sh test${NC} [type]        Run tests (e2e|unit)"
      echo -e "    ${CYAN}./cli.sh db${NC} [cmd]           Database ops (generate|push|seed|studio)"
      echo ""
      ;;
    *)
      error "Unknown command: $1"
      echo -e "  Run ${CYAN}./cli.sh help${NC} for usage."
      echo ""
      exit 1
      ;;
  esac
  exit 0
fi

# ── Launch Interactive Menu ───────────────────────────────────
main_menu
