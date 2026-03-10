#!/usr/bin/env bash
#
# Witylogix CLI — install command
#
# Installs Witylogix infrastructure:
# - Detects and installs Docker + Docker Compose (if missing)
# - Installs required tools: curl, git, jq, openssl
# - Creates directory structure under /opt/witylogix
# - Pulls or builds Docker images
# - Generates .env configuration with random secrets
# - Initializes database with init-db.sql
# - Sets appropriate file permissions
#
# Usage:
#   cmd_install [--build] [--dir /custom/path]
#
# Flags:
#   --build         Build Docker images from source instead of pulling
#   --dir PATH      Install to custom directory (default: /opt/witylogix)
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
INSTALL_DIR="/opt/witylogix"
BUILD_IMAGES=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)      BUILD_IMAGES=true; shift ;;
    --dir)        INSTALL_DIR="$2"; shift 2 ;;
    *)            log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# Detect OS
detect_os() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS_NAME="$ID"
    OS_VERSION_ID="$VERSION_ID"
  else
    log_error "Cannot detect OS. /etc/os-release not found."
    exit 1
  fi

  case "$OS_NAME" in
    ubuntu|debian)
      OS_TYPE="debian"
      ;;
    amzn)
      OS_TYPE="amazon"
      ;;
    centos|rhel|fedora)
      OS_TYPE="rhel"
      ;;
    *)
      log_warn "Unsupported OS: $OS_NAME. Attempting Debian-style installation."
      OS_TYPE="debian"
      ;;
  esac

  log_step "Detected OS: $OS_NAME (Type: $OS_TYPE)"
}

# Install Docker
install_docker() {
  if command -v docker &> /dev/null; then
    log_success "Docker is already installed: $(docker --version)"
    return 0
  fi

  log_step "Installing Docker..."

  case "$OS_TYPE" in
    debian)
      log_cmd "Running: apt-get update && apt-get install -y docker.io"
      sudo apt-get update &> /dev/null || true
      sudo apt-get install -y docker.io &> /dev/null
      sudo systemctl enable docker || true
      sudo systemctl start docker || true
      ;;
    amazon)
      log_cmd "Running: yum install -y docker"
      sudo yum install -y docker &> /dev/null
      sudo systemctl enable docker || true
      sudo systemctl start docker || true
      ;;
    rhel)
      log_cmd "Running: yum install -y docker"
      sudo yum install -y docker &> /dev/null
      sudo systemctl enable docker || true
      sudo systemctl start docker || true
      ;;
  esac

  log_success "Docker installed: $(docker --version)"
}

# Install Docker Compose
install_docker_compose() {
  if command -v docker-compose &> /dev/null; then
    log_success "Docker Compose is already installed: $(docker-compose --version)"
    return 0
  fi

  log_step "Installing Docker Compose..."

  local COMPOSE_VERSION
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)

  if [[ -z "$COMPOSE_VERSION" ]]; then
    COMPOSE_VERSION="v2.20.0"
    log_warn "Could not fetch latest Docker Compose version, using $COMPOSE_VERSION"
  fi

  case "$OS_TYPE" in
    debian|amazon|rhel)
      local ARCH
      ARCH=$(uname -m)
      case "$ARCH" in
        x86_64) ARCH="x86_64" ;;
        aarch64) ARCH="aarch64" ;;
        *) log_warn "Unsupported architecture: $ARCH"; return 1 ;;
      esac

      local DL_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-${ARCH}"
      log_cmd "Downloading: $DL_URL"
      sudo curl -sL "$DL_URL" -o /usr/local/bin/docker-compose
      sudo chmod +x /usr/local/bin/docker-compose
      ;;
  esac

  log_success "Docker Compose installed: $(docker-compose --version)"
}

# Install required tools
install_required_tools() {
  log_step "Installing required tools (curl, git, jq, openssl)..."

  case "$OS_TYPE" in
    debian)
      sudo apt-get update &> /dev/null || true
      sudo apt-get install -y curl git jq openssl &> /dev/null
      ;;
    amazon|rhel)
      sudo yum install -y curl git jq openssl &> /dev/null
      ;;
  esac

  log_success "Required tools installed"
}

# Create directory structure
create_directories() {
  log_step "Creating directory structure at $INSTALL_DIR..."

  sudo mkdir -p "$INSTALL_DIR"/{data,backups,logs,certs,config}
  sudo chown -R "$(id -u):$(id -g)" "$INSTALL_DIR"

  log_success "Directory structure created"
}

# Generate random secret
generate_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

# Generate .env file
generate_env() {
  log_step "Generating .env file..."

  local ENV_FILE="$ROOT_DIR/.env"

  if [[ -f "$ENV_FILE" ]]; then
    log_warn ".env already exists, skipping generation"
    return 0
  fi

  # Generate secrets
  local JWT_SECRET
  JWT_SECRET=$(generate_secret)

  local ENCRYPTION_KEY
  ENCRYPTION_KEY=$(generate_secret)

  local POSTGRES_PASSWORD
  POSTGRES_PASSWORD=$(generate_secret)

  # Create .env from template
  cat > "$ENV_FILE" << 'EOF'
# ─── Database ────────────────────────────────────────────────
DATABASE_URL="postgresql://witylogix:POSTGRES_PASSWORD@postgres:5432/witylogix?schema=public"
POSTGRES_USER=witylogix
POSTGRES_PASSWORD=POSTGRES_PASSWORD
POSTGRES_DB=witylogix

# ─── Redis ───────────────────────────────────────────────────
REDIS_URL="redis://redis:6379"
REDIS_MAXMEMORY=256mb

# ─── JWT (Authentication) ────────────────────────────────────
JWT_SECRET=JWT_SECRET
JWT_EXPIRES_IN=7d

# ─── Encryption ──────────────────────────────────────────────
ENCRYPTION_KEY=ENCRYPTION_KEY

# ─── Application Configuration ────────────────────────────────
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# ─── Shopify ─────────────────────────────────────────────────
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=

# ─── Routing Provider ───────────────────────────────────────
ROUTING_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=

# ─── Email Provider ───────────────────────────────────────
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=
EMAIL_FROM=
EMAIL_FROM_NAME=

# ─── SMS Provider ──────────────────────────────────────────
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ─── Other Configuration ──────────────────────────────────
TRACKING_PAGE_URL=http://localhost:3002
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=production
EOF

  # Replace secrets in template
  sed -i "s|POSTGRES_PASSWORD|$POSTGRES_PASSWORD|g" "$ENV_FILE"
  sed -i "s|JWT_SECRET|$JWT_SECRET|g" "$ENV_FILE"
  sed -i "s|ENCRYPTION_KEY|$ENCRYPTION_KEY|g" "$ENV_FILE"

  log_success ".env file generated with random secrets"
}

# Pull Docker images
pull_images() {
  log_step "Pulling Docker images..."

  cd "$ROOT_DIR"

  docker-compose -f infra/docker-compose.yml pull 2>&1 | grep -E "(Pulling|Downloaded|Status)" || log_warn "Some images may already be present"

  log_success "Docker images pulled"
}

# Build Docker images from source
build_images() {
  log_step "Building Docker images from source..."

  cd "$ROOT_DIR"

  docker-compose -f infra/docker-compose.yml build --no-cache 2>&1 | tail -20

  log_success "Docker images built"
}

# Initialize database
init_database() {
  log_step "Initializing database..."

  cd "$ROOT_DIR"

  # Start postgres and redis first
  log_step "Starting PostgreSQL and Redis..."
  docker-compose -f infra/docker-compose.yml up -d postgres redis

  # Wait for postgres to be ready
  local MAX_ATTEMPTS=30
  local ATTEMPT=0
  while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
    if docker exec witylogix-postgres pg_isready -U witylogix &> /dev/null; then
      log_success "PostgreSQL is ready"
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [[ $ATTEMPT -eq $MAX_ATTEMPTS ]]; then
      log_error "PostgreSQL failed to start after $MAX_ATTEMPTS attempts"
      return 1
    fi
    sleep 2
  done

  # Run init script
  log_step "Running initialization SQL..."
  docker exec -i witylogix-postgres psql -U witylogix -d witylogix < infra/docker/init-db.sql 2>&1 | grep -v "CREATE EXTENSION\|CREATE ROLE\|ALTER DEFAULT\|GRANT" || true

  log_success "Database initialized"
}

# Set file permissions
set_permissions() {
  log_step "Setting file permissions..."

  chmod 700 "$INSTALL_DIR"
  chmod 600 "$INSTALL_DIR"/config/*
  chmod 700 "$INSTALL_DIR"/{data,backups,logs,certs}

  log_success "File permissions set"
}

# Print installation summary
print_summary() {
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Witylogix Installation Complete${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Installation Directory: $INSTALL_DIR"
  echo "Configuration: $ROOT_DIR/.env"
  echo "Data Directory: $INSTALL_DIR/data"
  echo "Backups Directory: $INSTALL_DIR/backups"
  echo "Logs Directory: $INSTALL_DIR/logs"
  echo ""
  echo "Next steps:"
  log_step "Deploy the infrastructure: cli deploy"
  echo ""
}

# Main installation flow
cmd_install() {
  log_info "Starting Witylogix installation..."
  echo ""

  detect_os
  install_docker
  install_docker_compose
  install_required_tools
  create_directories
  generate_env

  if [[ "$BUILD_IMAGES" = true ]]; then
    build_images
  else
    pull_images
  fi

  init_database
  set_permissions
  print_summary

  log_success "Installation complete!"
}

# Run installation if script is executed directly
cmd_install "$@"
