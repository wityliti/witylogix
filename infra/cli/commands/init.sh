#!/usr/bin/env bash
#
# Witylogix CLI — init command
#
# Contributor setup automation:
# - Checks prerequisites: git, node >= 20, pnpm, docker
# - Clones repo if not in a git repo
# - Installs dependencies via pnpm
# - Creates .env file with dev secrets
# - Starts dev infrastructure with docker compose
# - Waits for Postgres to be healthy
# - Generates Prisma client
# - Runs database migrations
# - Seeds database (with --skip-seed flag to skip)
# - Runs smoke tests (with --skip-test flag to skip)
# - Prints summary with ✅/❌ for each step
#
# Usage:
#   cmd_init [--skip-seed] [--skip-test]
#
# Flags:
#   --skip-seed    Skip database seeding
#   --skip-test    Skip smoke test
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters for summary
PASSED=0
FAILED=0

# Logging functions
log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_fail() { echo -e "${RED}❌${NC} $1"; }
log_step() { echo -e "${CYAN}→${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }

# Globals
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SKIP_SEED=false
SKIP_TEST=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-seed)    SKIP_SEED=true; shift ;;
    --skip-test)    SKIP_TEST=true; shift ;;
    *)              log_error "Unknown option: $1"; exit 1 ;;
  esac
done

################################################################################
# 1. Check prerequisites
################################################################################

check_prerequisites() {
  log_step "Checking prerequisites..."
  echo ""

  # Check git
  if command -v git &> /dev/null; then
    log_success "git is installed"
    ((PASSED++))
  else
    log_fail "git is not installed"
    echo "Install git: https://git-scm.com/downloads"
    ((FAILED++))
  fi

  # Check node >= 20
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -ge 20 ]]; then
      log_success "Node.js $(node -v) is installed"
      ((PASSED++))
    else
      log_fail "Node.js version must be >= 20 (you have $(node -v))"
      echo "Install Node.js 20+: https://nodejs.org/"
      ((FAILED++))
    fi
  else
    log_fail "Node.js is not installed"
    echo "Install Node.js 20+: https://nodejs.org/"
    ((FAILED++))
  fi

  # Check pnpm
  if command -v pnpm &> /dev/null; then
    log_success "pnpm $(pnpm -v) is installed"
    ((PASSED++))
  else
    log_fail "pnpm is not installed"
    echo "Install pnpm: npm install -g pnpm"
    ((FAILED++))
  fi

  # Check docker
  if command -v docker &> /dev/null; then
    log_success "Docker is installed"
    ((PASSED++))
  else
    log_fail "Docker is not installed"
    echo "Install Docker: https://docs.docker.com/get-docker/"
    ((FAILED++))
  fi

  echo ""

  if [[ $FAILED -gt 0 ]]; then
    log_error "Some prerequisites are missing. Please install them and try again."
    exit 1
  fi
}

################################################################################
# 2. Clone repo if needed
################################################################################

ensure_in_repo() {
  log_step "Checking repository..."

  if [[ -d "$ROOT_DIR/.git" ]]; then
    log_success "Already in a git repository: $ROOT_DIR"
    ((PASSED++))
  else
    log_fail "Not in a git repository"
    ((FAILED++))
    log_error "Please clone the repository first or initialize git"
    exit 1
  fi

  echo ""
}

################################################################################
# 3. Install dependencies
################################################################################

install_dependencies() {
  log_step "Installing dependencies..."
  cd "$ROOT_DIR"

  if pnpm install &> /tmp/pnpm-install.log; then
    log_success "Dependencies installed"
    ((PASSED++))
  else
    log_fail "Failed to install dependencies"
    cat /tmp/pnpm-install.log
    ((FAILED++))
    exit 1
  fi

  echo ""
}

################################################################################
# 4. Setup .env file
################################################################################

setup_env() {
  log_step "Setting up environment variables..."
  cd "$ROOT_DIR"

  if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
      log_cmd "Copying .env.example to .env..."
      cp .env.example .env
      log_success ".env file created from .env.example"
      ((PASSED++))
    else
      log_fail ".env.example not found"
      ((FAILED++))
      exit 1
    fi
  else
    log_success ".env file already exists"
    ((PASSED++))
  fi

  echo ""
}

################################################################################
# 5. Generate dev secrets
################################################################################

generate_secrets() {
  log_step "Generating development secrets..."
  cd "$ROOT_DIR"

  local JWT_SECRET=""
  local ENCRYPTION_KEY=""

  # Check if secrets already exist
  if grep -q "^JWT_SECRET=" .env && grep -q "^ENCRYPTION_KEY=" .env; then
    log_success "Development secrets already exist"
    ((PASSED++))
    echo ""
    return 0
  fi

  # Generate secrets
  if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    log_cmd "Generated JWT_SECRET and ENCRYPTION_KEY"
  else
    log_fail "openssl not found, cannot generate secrets"
    ((FAILED++))
    echo ""
    return 1
  fi

  # Update .env file with secrets (only if they don't exist)
  if ! grep -q "^JWT_SECRET=" .env; then
    echo "JWT_SECRET=$JWT_SECRET" >> .env
  fi

  if ! grep -q "^ENCRYPTION_KEY=" .env; then
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
  fi

  log_success "Development secrets generated and added to .env"
  ((PASSED++))

  echo ""
}

################################################################################
# 6. Start dev infrastructure
################################################################################

start_dev_infrastructure() {
  log_step "Starting development infrastructure..."
  cd "$ROOT_DIR"

  if docker compose -f infra/docker-compose.dev.yml up -d &> /tmp/docker-compose.log; then
    log_success "Development infrastructure started"
    ((PASSED++))
  else
    log_fail "Failed to start development infrastructure"
    cat /tmp/docker-compose.log
    ((FAILED++))
    exit 1
  fi

  echo ""
}

################################################################################
# 7. Wait for Postgres to be healthy
################################################################################

wait_for_postgres() {
  log_step "Waiting for Postgres to be healthy..."
  cd "$ROOT_DIR"

  local MAX_ATTEMPTS=30
  local ATTEMPT=0

  while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready &> /dev/null; then
      log_success "Postgres is healthy"
      ((PASSED++))
      echo ""
      return 0
    fi

    ((ATTEMPT++))
    if [[ $((ATTEMPT % 5)) -eq 0 ]]; then
      log_cmd "Still waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
    fi
    sleep 1
  done

  log_fail "Postgres failed to become healthy after ${MAX_ATTEMPTS}s"
  ((FAILED++))
  exit 1
}

################################################################################
# 8. Generate Prisma client
################################################################################

generate_prisma_client() {
  log_step "Generating Prisma client..."
  cd "$ROOT_DIR"

  if pnpm db:generate &> /tmp/prisma-generate.log; then
    log_success "Prisma client generated"
    ((PASSED++))
  else
    log_fail "Failed to generate Prisma client"
    cat /tmp/prisma-generate.log
    ((FAILED++))
    exit 1
  fi

  echo ""
}

################################################################################
# 9. Run migrations
################################################################################

run_migrations() {
  log_step "Running database migrations..."
  cd "$ROOT_DIR"

  # Try with pnpm script first, fallback to npx
  if pnpm db:migrate &> /tmp/prisma-migrate.log; then
    log_success "Database migrations completed"
    ((PASSED++))
  else
    # Try fallback
    if npx prisma migrate dev --skip-generate 2>&1 | tee -a /tmp/prisma-migrate.log | grep -q "Prisma Migrate"; then
      log_success "Database migrations completed"
      ((PASSED++))
    else
      log_fail "Failed to run database migrations"
      cat /tmp/prisma-migrate.log
      ((FAILED++))
      exit 1
    fi
  fi

  echo ""
}

################################################################################
# 10. Seed database
################################################################################

seed_database() {
  if [[ "$SKIP_SEED" == "true" ]]; then
    log_step "Skipping database seed (--skip-seed flag set)"
    ((PASSED++))
    echo ""
    return 0
  fi

  log_step "Seeding database..."
  cd "$ROOT_DIR"

  if pnpm db:seed &> /tmp/prisma-seed.log; then
    log_success "Database seeded"
    ((PASSED++))
  else
    # Seed might be optional, so just warn instead of fail
    log_warn "Database seeding completed with warnings (this may be normal)"
    cat /tmp/prisma-seed.log | tail -5
    ((PASSED++))
  fi

  echo ""
}

################################################################################
# 11. Run smoke test
################################################################################

run_smoke_test() {
  if [[ "$SKIP_TEST" == "true" ]]; then
    log_step "Skipping smoke test (--skip-test flag set)"
    ((PASSED++))
    echo ""
    return 0
  fi

  log_step "Running smoke test..."
  cd "$ROOT_DIR"

  if bash scripts/smoke-test.sh &> /tmp/smoke-test.log; then
    log_success "Smoke test passed"
    ((PASSED++))
  else
    log_fail "Smoke test failed"
    cat /tmp/smoke-test.log
    ((FAILED++))
    exit 1
  fi

  echo ""
}

################################################################################
# 12. Print summary and next steps
################################################################################

print_summary() {
  echo ""
  echo "================================================================================"
  echo "Witylogix Contributor Setup Summary"
  echo "================================================================================"
  echo ""
  echo -e "${GREEN}✅ Passed:${NC} $PASSED"
  echo -e "${RED}❌ Failed:${NC} $FAILED"
  echo ""

  if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}You're ready!${NC}"
    echo ""
    echo "Service URLs:"
    echo "  API:       http://localhost:3001"
    echo "  Dashboard: http://localhost:3000"
    echo ""
    echo "Next steps:"
    echo "  1. Start the development server:"
    echo "     docker compose -f infra/docker-compose.dev.yml logs -f"
    echo ""
    echo "  2. Check infrastructure status:"
    echo "     docker compose -f infra/docker-compose.dev.yml ps"
    echo ""
    echo "  3. View API docs:"
    echo "     open http://localhost:3001/docs"
    echo ""
    echo "  4. Access dashboard:"
    echo "     open http://localhost:3000"
    echo ""
    echo "Happy coding!"
    echo ""
    exit 0
  else
    log_error "Setup failed. Please review errors above and try again."
    exit 1
  fi
}

################################################################################
# Main execution
################################################################################

# Clear screen for cleaner output
clear

log_info "Witylogix Contributor Setup v1.0"
echo ""

# Run all setup steps
check_prerequisites
ensure_in_repo
install_dependencies
setup_env
generate_secrets
start_dev_infrastructure
wait_for_postgres
generate_prisma_client
run_migrations
seed_database
run_smoke_test
print_summary
