#!/usr/bin/env bash
#
# Witylogix Environment Configuration CLI
#
# Usage:
#   witylogix env init                   Interactive .env configurator
#   witylogix env show                   Print current env (masked secrets)
#   witylogix env set KEY=VALUE          Set single environment variable
#   witylogix env validate               Check all required vars and formats
#   witylogix env export                 Export env as JSON (masked secrets)
#
# Examples:
#   witylogix env init
#   witylogix env show
#   witylogix env set NODE_ENV=production
#   witylogix env validate
#   witylogix env export > env.json
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_DIR="$SCRIPT_DIR/.."
TEMPLATES_DIR="$CLI_DIR/templates"
INSTALL_DIR="${INSTALL_DIR:-.}"
ENV_FILE="${INSTALL_DIR}/.env"
ENV_TEMPLATE="${TEMPLATES_DIR}/env.template"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[env]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[env]${NC} $1"; }
log_error() { echo -e "${RED}[env]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }
log_section() { echo -e "${BLUE}$1${NC}"; }

# ─── Utility Functions ─────────────────────────────────────────────

generate_secret() {
  local length="${1:-32}"
  openssl rand -hex "$length" 2>/dev/null || openssl rand -base64 "$length" 2>/dev/null
}

mask_secret() {
  local value="$1"
  if [[ ${#value} -gt 4 ]]; then
    echo "${value:0:2}****${value: -2}"
  else
    echo "****"
  fi
}

read_var() {
  local prompt="$1"
  local default="$2"
  local hidden="${3:-false}"
  local result=""

  if [[ "$hidden" == "true" ]]; then
    read -rsp "${prompt} ${default:+[$default] }" result
    echo ""
  else
    read -rp "${prompt} ${default:+[$default] }" result
  fi

  echo "${result:-$default}"
}

# ─── Validation Functions ─────────────────────────────────────────

validate_url() {
  local url="$1"
  # Simple regex for URL validation
  [[ "$url" =~ ^https?:// ]] || [[ "$url" =~ ^postgresql:// ]] || [[ "$url" =~ ^redis:// ]]
}

validate_email() {
  local email="$1"
  [[ $email =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]
}

validate_port() {
  local port="$1"
  [[ $port =~ ^[0-9]+$ ]] && [[ $port -ge 1 ]] && [[ $port -le 65535 ]]
}

validate_node_env() {
  local env="$1"
  [[ "$env" == "development" ]] || [[ "$env" == "staging" ]] || [[ "$env" == "production" ]]
}

validate_log_level() {
  local level="$1"
  [[ "$level" == "debug" ]] || [[ "$level" == "info" ]] || [[ "$level" == "warn" ]] || [[ "$level" == "error" ]]
}

# ─── Init Command ─────────────────────────────────────────────────

cmd_init() {
  log_info "Starting interactive .env configuration..."
  log_info ""

  if [[ -f "$ENV_FILE" ]]; then
    log_warn ".env file already exists at $ENV_FILE"
    read -rp "Overwrite? [y/N]: " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      log_info "Cancelled."
      return 0
    fi
  fi

  if [[ ! -f "$ENV_TEMPLATE" ]]; then
    log_error "env.template not found at $ENV_TEMPLATE"
    return 1
  fi

  local env_content=""
  local in_section=false
  local current_section=""

  # Read template and process
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Section headers
    if [[ "$line" =~ ^#.*---.*$ ]]; then
      in_section=true
      current_section=$(echo "$line" | sed 's/^#[ -]*//; s/[ -]*$//')
      env_content+="$line"$'\n'
      log_section "$current_section"
      continue
    fi

    # Regular comments (descriptions)
    if [[ $line =~ ^# ]]; then
      env_content+="$line"$'\n'
      echo "  ${line:2}"
      continue
    fi

    # Empty lines
    if [[ -z "$line" || ! "$line" =~ = ]]; then
      env_content+="$line"$'\n'
      continue
    fi

    # Variables (KEY=VALUE or KEY=)
    local key="${line%%=*}"
    local default="${line#*=}"

    # Skip commented-out vars
    if [[ $key =~ ^# ]]; then
      env_content+="$line"$'\n'
      continue
    fi

    echo ""

    # Determine if required based on key
    local is_required=false
    case "$key" in
      DATABASE_URL|REDIS_URL|JWT_SECRET|ENCRYPTION_KEY)
        is_required=true
        ;;
    esac

    local prompt="  $key"
    [[ "$is_required" == "true" ]] && prompt+=" (required)"
    prompt+=": "

    local should_hide=false
    case "$key" in
      *SECRET|*KEY|*TOKEN|PASSWORD|*_PASS|*_PWD)
        should_hide=true
        ;;
    esac

    local value=""

    # Handle special cases
    case "$key" in
      JWT_SECRET|ENCRYPTION_KEY)
        # Auto-generate secrets
        log_cmd "Auto-generating $key..."
        value=$(generate_secret 32)
        echo "${prompt}Generated: $(mask_secret "$value")"
        ;;
      DATABASE_URL)
        # Database URL validation
        while true; do
          value=$(read_var "$prompt" "$default")
          if validate_url "$value" || [[ -z "$value" ]]; then
            break
          fi
          log_error "Invalid URL format. Use postgresql://user:pass@host:port/db"
        done
        ;;
      REDIS_URL)
        # Redis URL validation
        while true; do
          value=$(read_var "$prompt" "$default")
          if validate_url "$value" || [[ -z "$value" ]]; then
            break
          fi
          log_error "Invalid URL format. Use redis://host:port"
        done
        ;;
      NODE_ENV)
        # Enum: development, staging, production
        while true; do
          value=$(read_var "$prompt" "$default")
          if validate_node_env "$value" || [[ -z "$value" ]]; then
            break
          fi
          log_error "Must be: development, staging, or production"
        done
        ;;
      LOG_LEVEL)
        # Enum: debug, info, warn, error
        while true; do
          value=$(read_var "$prompt" "$default")
          if validate_log_level "$value" || [[ -z "$value" ]]; then
            break
          fi
          log_error "Must be: debug, info, warn, or error"
        done
        ;;
      PORT)
        # Port validation
        while true; do
          value=$(read_var "$prompt" "$default")
          if validate_port "$value" || [[ -z "$value" ]]; then
            break
          fi
          log_error "Invalid port. Use number 1-65535"
        done
        ;;
      EMAIL_FROM)
        # Email validation
        while true; do
          value=$(read_var "$prompt" "$default")
          if validate_email "$value" || [[ -z "$value" ]]; then
            break
          fi
          log_error "Invalid email format"
        done
        ;;
      *)
        value=$(read_var "$prompt" "$default" "$should_hide")
        ;;
    esac

    # Write to env content
    env_content+="$key=${value:-$default}"$'\n'

  done < "$ENV_TEMPLATE"

  # Write to .env file
  mkdir -p "$(dirname "$ENV_FILE")"
  echo -n "$env_content" > "$ENV_FILE"

  log_info ""
  log_info "Configuration saved to $ENV_FILE"
  log_cmd "Review with: witylogix env show"
  log_cmd "Validate with: witylogix env validate"

  return 0
}

# ─── Show Command ─────────────────────────────────────────────────

cmd_show() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log_warn "No .env file found at $ENV_FILE"
    return 1
  fi

  log_info "Current environment configuration:"
  echo ""

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ -z "$line" || $line =~ ^# ]]; then
      echo "$line"
      continue
    fi

    # Variables
    if [[ $line =~ = ]]; then
      local key="${line%%=*}"
      local value="${line#*=}"

      # Mask secrets
      if [[ $key =~ SECRET|KEY|TOKEN|PASSWORD|_PASS|_PWD ]]; then
        value=$(mask_secret "$value")
      fi

      printf "%-30s %s\n" "$key=" "$value"
    fi

  done < "$ENV_FILE"

  return 0
}

# ─── Set Command ──────────────────────────────────────────────────

cmd_set() {
  local key_value="$1"

  if [[ -z "$key_value" ]]; then
    log_error "Usage: witylogix env set KEY=VALUE"
    return 1
  fi

  if [[ ! "$key_value" =~ = ]]; then
    log_error "Invalid format. Use: KEY=VALUE"
    return 1
  fi

  local key="${key_value%%=*}"
  local value="${key_value#*=}"

  if [[ ! -f "$ENV_FILE" ]]; then
    # Create new .env file
    mkdir -p "$(dirname "$ENV_FILE")"
    echo "$key_value" > "$ENV_FILE"
    log_info "Created .env with $key=$value"
    return 0
  fi

  # Update existing file
  if grep -q "^$key=" "$ENV_FILE"; then
    # Key exists, replace it
    sed -i.bak "s/^$key=.*/$key=$value/" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
    log_info "Updated $key"
  else
    # Key doesn't exist, append it
    echo "$key=$value" >> "$ENV_FILE"
    log_info "Added $key"
  fi

  return 0
}

# ─── Validate Command ─────────────────────────────────────────────

cmd_validate() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log_warn "No .env file found at $ENV_FILE"
    return 1
  fi

  log_info "Validating environment configuration..."

  local required_vars=(
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
    "NODE_ENV"
  )

  local errors=0
  local warnings=0

  # Check required vars
  for var in "${required_vars[@]}"; do
    local value=$(grep "^$var=" "$ENV_FILE" | cut -d= -f2-)
    if [[ -z "$value" ]]; then
      log_error "Missing required variable: $var"
      ((errors++))
    else
      log_info "✓ $var is set"
    fi
  done

  # Validate specific formats
  local db_url=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2-)
  if [[ -n "$db_url" ]] && ! validate_url "$db_url"; then
    log_error "Invalid DATABASE_URL format"
    ((errors++))
  fi

  local redis_url=$(grep "^REDIS_URL=" "$ENV_FILE" | cut -d= -f2-)
  if [[ -n "$redis_url" ]] && ! validate_url "$redis_url"; then
    log_error "Invalid REDIS_URL format"
    ((errors++))
  fi

  local node_env=$(grep "^NODE_ENV=" "$ENV_FILE" | cut -d= -f2-)
  if [[ -n "$node_env" ]] && ! validate_node_env "$node_env"; then
    log_error "Invalid NODE_ENV. Must be: development, staging, production"
    ((errors++))
  fi

  local jwt_secret=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d= -f2-)
  if [[ -n "$jwt_secret" && ${#jwt_secret} -lt 32 ]]; then
    log_warn "JWT_SECRET is shorter than 32 characters (security recommendation)"
    ((warnings++))
  fi

  # Summary
  echo ""
  if [[ $errors -eq 0 ]]; then
    log_info "All validations passed!"
  else
    log_error "Validation failed with $errors error(s)"
    [[ $warnings -gt 0 ]] && log_warn "  and $warnings warning(s)"
    return 1
  fi

  return 0
}

# ─── Export Command ───────────────────────────────────────────────

cmd_export() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log_error "No .env file found at $ENV_FILE"
    return 1
  fi

  local json="{"
  local first=true

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ -z "$line" || $line =~ ^# ]] && continue

    # Variables only
    if [[ $line =~ = ]]; then
      local key="${line%%=*}"
      local value="${line#*=}"

      # Mask secrets in JSON output
      if [[ $key =~ SECRET|KEY|TOKEN|PASSWORD|_PASS|_PWD ]]; then
        value=$(mask_secret "$value")
      fi

      # Escape JSON values
      value="${value//\\/\\\\}"
      value="${value//\"/\\\"}"

      # Add to JSON
      if [[ "$first" == true ]]; then
        first=false
      else
        json+=","
      fi

      json+="\"$key\":\"$value\""
    fi

  done < "$ENV_FILE"

  json+="}"

  # Pretty-print JSON if jq available
  if command -v jq &> /dev/null; then
    echo "$json" | jq .
  else
    echo "$json"
  fi

  return 0
}

# ─── Help ─────────────────────────────────────────────────────────

show_help() {
  cat << EOF
Witylogix Environment Configuration CLI

Usage: witylogix env [command] [options]

Commands:
  init                     Interactive .env configurator
  show                     Print current env (masked secrets)
  set KEY=VALUE            Set single environment variable
  validate                 Check all required vars and formats
  export                   Export env as JSON (masked secrets)
  -h, --help              Show this help

Examples:
  witylogix env init
  witylogix env show
  witylogix env set NODE_ENV=production
  witylogix env validate
  witylogix env export > env.json

Configuration:
  Environment file: $ENV_FILE
  Template file: $ENV_TEMPLATE

EOF
}

# ─── Main ─────────────────────────────────────────────────────────

case "${1:-help}" in
  init)
    cmd_init
    ;;
  show)
    cmd_show
    ;;
  set)
    cmd_set "$2"
    ;;
  validate)
    cmd_validate
    ;;
  export)
    cmd_export
    ;;
  -h|--help|help)
    show_help
    exit 0
    ;;
  *)
    log_error "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
