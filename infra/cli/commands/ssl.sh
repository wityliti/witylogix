#!/usr/bin/env bash
#
# Witylogix SSL/TLS CLI — Manage SSL certificates and Caddy configuration
#
# Usage:
#   witylogix ssl <domain>              Configure SSL for domain with Let's Encrypt
#   witylogix ssl <domain> --email addr Configure SSL with specific email for Let's Encrypt
#   witylogix ssl <domain> --self-signed Generate self-signed cert for development
#   witylogix ssl status                Show current SSL certificate info
#   witylogix ssl renew                 Force renewal of SSL certificates
#
# Examples:
#   witylogix ssl example.com
#   witylogix ssl example.com --email admin@example.com
#   witylogix ssl staging.local --self-signed
#   witylogix ssl status
#   witylogix ssl renew
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_DIR="$SCRIPT_DIR/.."
TEMPLATES_DIR="$CLI_DIR/templates"
CADDY_CONFIG_DIR="${CADDY_CONFIG_DIR:-/etc/caddy}"
CADDY_DATA_DIR="${CADDY_DATA_DIR:-/var/lib/caddy}"
CADDY_LOG_DIR="${CADDY_LOG_DIR:-/var/log/caddy}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[ssl]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[ssl]${NC} $1"; }
log_error() { echo -e "${RED}[ssl]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }

check_requirements() {
  local missing=0

  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    missing=1
  fi

  if ! command -v dig &> /dev/null && ! command -v nslookup &> /dev/null; then
    log_warn "dig/nslookup not found. DNS validation will be skipped."
  fi

  if ! command -v openssl &> /dev/null; then
    log_error "openssl is not installed"
    missing=1
  fi

  if [[ $missing -eq 1 ]]; then
    exit 1
  fi
}

validate_domain() {
  local domain="$1"

  if [[ ! "$domain" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
    log_error "Invalid domain format: $domain"
    return 1
  fi

  return 0
}

validate_dns() {
  local domain="$1"
  local server_ip="${SERVER_IP:-}"

  # Skip DNS validation if SERVER_IP not set
  if [[ -z "$server_ip" ]]; then
    log_warn "SERVER_IP not set. Skipping DNS validation."
    return 0
  fi

  log_info "Validating DNS records for $domain..."

  local resolved_ip=""
  if command -v dig &> /dev/null; then
    resolved_ip=$(dig +short "$domain" A | tail -1)
  elif command -v nslookup &> /dev/null; then
    resolved_ip=$(nslookup "$domain" 8.8.8.8 | grep -oP '(?<=Address: )[0-9.]+' | tail -1)
  fi

  if [[ -z "$resolved_ip" ]]; then
    log_warn "Could not resolve DNS for $domain"
    return 0
  fi

  if [[ "$resolved_ip" != "$server_ip" ]]; then
    log_warn "DNS record points to $resolved_ip, expected $server_ip"
    log_warn "Certificate issuance may fail. Update your DNS records."
    return 0
  fi

  log_info "DNS record validated: $domain -> $resolved_ip"
  return 0
}

generate_caddyfile() {
  local domain="$1"
  local email="$2"
  local output_path="$3"
  local self_signed="${4:-false}"

  if [[ ! -f "$TEMPLATES_DIR/Caddyfile.template" ]]; then
    log_error "Caddyfile.template not found at $TEMPLATES_DIR/Caddyfile.template"
    return 1
  fi

  log_info "Generating Caddyfile for domain: $domain"

  # Generate from template
  local caddyfile_content=$(cat "$TEMPLATES_DIR/Caddyfile.template")

  # Replace placeholders
  caddyfile_content="${caddyfile_content//\{\{DOMAIN\}\}/$domain}"
  caddyfile_content="${caddyfile_content//\{\{ACME_EMAIL\}\}/$email}"

  # For self-signed, disable auto HTTPS
  if [[ "$self_signed" == "true" ]]; then
    # Add directive to disable auto HTTPS
    caddyfile_content="# Self-signed certificate for development
{
  auto_https off
}

$caddyfile_content"
  fi

  mkdir -p "$(dirname "$output_path")"
  echo "$caddyfile_content" > "$output_path"
  log_cmd "Caddyfile written to $output_path"

  return 0
}

generate_self_signed_cert() {
  local domain="$1"
  local cert_dir="${2:-$CADDY_DATA_DIR}"

  log_info "Generating self-signed certificate for $domain..."

  mkdir -p "$cert_dir"

  local key_file="$cert_dir/${domain}.key"
  local cert_file="$cert_dir/${domain}.crt"

  # Generate private key (2048-bit RSA)
  log_cmd "Generating private key..."
  openssl genrsa -out "$key_file" 2048 2>/dev/null

  # Generate self-signed certificate (365 days validity)
  log_cmd "Generating self-signed certificate (365 days)..."
  openssl req -new -x509 -key "$key_file" -out "$cert_file" -days 365 \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$domain" 2>/dev/null

  log_info "Self-signed certificate generated:"
  log_cmd "Key: $key_file"
  log_cmd "Cert: $cert_file"

  return 0
}

get_cert_info() {
  local cert_file="$1"

  if [[ ! -f "$cert_file" ]]; then
    return 1
  fi

  openssl x509 -in "$cert_file" -noout \
    -subject \
    -dates \
    -issuer \
    -serial 2>/dev/null || return 1
}

caddy_is_running() {
  docker ps --filter "name=caddy" --filter "status=running" | grep -q caddy
  return $?
}

restart_caddy() {
  log_info "Restarting Caddy container..."

  if ! caddy_is_running; then
    log_warn "Caddy container is not running. Attempting to start..."
    docker start caddy || {
      log_error "Failed to start Caddy container"
      return 1
    }
  else
    docker restart caddy || {
      log_error "Failed to restart Caddy container"
      return 1
    }
  fi

  # Wait for container to be ready
  sleep 2

  # Verify Caddy is running
  if caddy_is_running; then
    log_info "Caddy restarted successfully"
    return 0
  else
    log_error "Caddy failed to start"
    return 1
  fi
}

cmd_ssl() {
  local domain="$1"
  local email="${ACME_EMAIL:-admin@$domain}"
  local self_signed=false

  shift || true

  # Parse flags
  while [[ $# -gt 0 ]]; do
    case $1 in
      --email)
        email="$2"
        shift 2
        ;;
      --self-signed)
        self_signed=true
        shift
        ;;
      *)
        log_error "Unknown option: $1"
        return 1
        ;;
    esac
  done

  check_requirements

  if ! validate_domain "$domain"; then
    return 1
  fi

  # Validate DNS unless self-signed
  if [[ "$self_signed" != "true" ]]; then
    validate_dns "$domain" || true
  fi

  # Generate Caddyfile
  local caddyfile_path="$CADDY_CONFIG_DIR/Caddyfile"
  if ! generate_caddyfile "$domain" "$email" "$caddyfile_path" "$self_signed"; then
    return 1
  fi

  # Generate self-signed cert if requested
  if [[ "$self_signed" == "true" ]]; then
    if ! generate_self_signed_cert "$domain"; then
      return 1
    fi
  fi

  # Restart Caddy
  if ! restart_caddy; then
    return 1
  fi

  log_info "SSL configuration complete for $domain"
  log_info ""
  log_info "Subdomains configured:"
  log_cmd "api.$domain     → :3001"
  log_cmd "app.$domain     → :3002"
  log_cmd "docs.$domain    → :3003"

  if [[ "$self_signed" == "true" ]]; then
    log_warn "Self-signed certificate in use (development only)"
  else
    log_info "Let's Encrypt email: $email"
  fi

  return 0
}

cmd_status() {
  log_info "Checking SSL/TLS certificates..."

  # Check for Caddy container
  if ! caddy_is_running; then
    log_warn "Caddy container is not running"
    return 1
  fi

  # List certificate files
  if [[ ! -d "$CADDY_DATA_DIR" ]]; then
    log_warn "No certificates found"
    return 0
  fi

  log_info "Certificates in $CADDY_DATA_DIR:"

  local found_any=false
  for cert_file in "$CADDY_DATA_DIR"/*.crt; do
    if [[ -f "$cert_file" ]]; then
      found_any=true
      echo ""
      log_info "Certificate: $(basename "$cert_file")"
      get_cert_info "$cert_file" | sed 's/^/  /'
    fi
  done

  if [[ "$found_any" != "true" ]]; then
    log_warn "No certificates found"
    return 0
  fi

  return 0
}

cmd_renew() {
  log_info "Forcing certificate renewal..."

  if ! caddy_is_running; then
    log_error "Caddy container is not running"
    return 1
  fi

  # Trigger Caddy's certificate renewal
  docker exec caddy /bin/sh -c "caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile" || {
    log_error "Failed to reload Caddy configuration"
    return 1
  }

  log_info "Certificate renewal triggered"
  log_info "Caddy will renew certificates before expiry"

  return 0
}

show_help() {
  cat << EOF
Witylogix SSL/TLS CLI — Manage SSL certificates and Caddy reverse proxy

Usage: witylogix ssl [command] [options]

Commands:
  <domain>                  Configure SSL for domain with Let's Encrypt
  status                    Show current SSL certificate info
  renew                     Force renewal of SSL certificates
  -h, --help               Show this help

Options:
  --email ADDR             Email for Let's Encrypt notifications (default: admin@domain)
  --self-signed            Generate self-signed certificate (development only)

Examples:
  witylogix ssl example.com
  witylogix ssl example.com --email admin@example.com
  witylogix ssl staging.local --self-signed
  witylogix ssl status
  witylogix ssl renew

Environment Variables:
  CADDY_CONFIG_DIR         Caddy config directory (default: /etc/caddy)
  CADDY_DATA_DIR          Caddy data directory (default: /var/lib/caddy)
  CADDY_LOG_DIR           Caddy log directory (default: /var/log/caddy)
  SERVER_IP               Server IP for DNS validation
  ACME_EMAIL              Default email for Let's Encrypt

EOF
}

# Main
case "${1:-help}" in
  -h|--help|help)
    show_help
    exit 0
    ;;
  status)
    cmd_status
    ;;
  renew)
    cmd_renew
    ;;
  *)
    cmd_ssl "$@"
    ;;
esac
