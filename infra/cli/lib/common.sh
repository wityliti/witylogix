#!/usr/bin/env bash
#
# Witylogix Common Library
#
# Shared utilities for all CLI commands:
# - System validation (require_root, require_docker, require_command)
# - Service management (wait_for_healthy, container_exists)
# - User interaction (confirm, spinner)
# - Output formatting (table_header, table_row, progress)
# - Configuration (get_config, set_config)
# - System detection (detect_os, detect_arch)
#

set -euo pipefail

# Validation Functions
# ====================

# require_root: Check if running as root or with sudo
require_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "This command must be run as root or with sudo"
    exit 1
  fi
}

# require_docker: Check if Docker is installed and running
require_docker() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    log_error "Install Docker: https://docs.docker.com/install/"
    exit 1
  fi

  if ! docker ps &> /dev/null; then
    log_error "Docker daemon is not running or you don't have permissions"
    log_error "Start Docker or run with: sudo usermod -aG docker \$USER"
    exit 1
  fi

  log_verbose "Docker check passed"
}

# require_command: Check if a command exists
require_command() {
  local cmd="$1"
  if ! command -v "$cmd" &> /dev/null; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
  log_verbose "Command check passed: $cmd"
}

# Service Management Functions
# ============================

# wait_for_healthy: Poll container until healthy or timeout
# Usage: wait_for_healthy "container_name" 60
wait_for_healthy() {
  local container="$1"
  local timeout="${2:-60}"
  local elapsed=0
  local interval=2

  log_step "Waiting for $container to be healthy (timeout: ${timeout}s)..."

  while [[ $elapsed -lt $timeout ]]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "")

    if [[ "$status" == "healthy" ]]; then
      log_success "$container is healthy"
      return 0
    fi

    if [[ "$status" == "unhealthy" ]]; then
      log_error "$container is unhealthy"
      return 1
    fi

    elapsed=$((elapsed + interval))
    printf "."
    sleep "$interval"
  done

  echo ""
  log_error "$container did not become healthy within ${timeout}s"
  return 1
}

# get_container_logs: Fetch recent logs from container
# Usage: get_container_logs "container_name" 50
get_container_logs() {
  local container="$1"
  local lines="${2:-50}"

  if ! docker inspect "$container" &> /dev/null; then
    log_error "Container not found: $container"
    return 1
  fi

  docker logs --tail "$lines" "$container"
}

# container_exists: Check if container is running
# Usage: if container_exists "api"; then ... fi
container_exists() {
  local container="$1"
  docker ps --filter "name=$container" --format "{{.Names}}" | grep -q "^$container$" 2>/dev/null || return 1
}

# User Interaction Functions
# ==========================

# confirm: Interactive yes/no prompt (respects --yes flag)
# Usage: if confirm "Continue?"; then ... fi
confirm() {
  local prompt="$1"
  local default="${2:-n}"

  # Respect --yes flag for non-interactive mode
  if [[ "${YES_MODE:-false}" == "true" ]]; then
    log_verbose "Auto-confirming (--yes mode): $prompt"
    return 0
  fi

  local def_str="[y/N]"
  [[ "$default" == "y" ]] && def_str="[Y/n]"

  while true; do
    read -r -p "${prompt} ${def_str}: " reply
    reply="${reply:-$default}"

    case "$reply" in
      [yY] | [yY][eE][sS])
        return 0
        ;;
      [nN] | [nN][oO] | "")
        return 1
        ;;
      *)
        echo "Please answer y or n."
        ;;
    esac
  done
}

# spinner: Animated spinner while process runs
# Usage: some_long_command & spinner $!
spinner() {
  local pid=$1
  local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0

  while kill -0 "$pid" 2>/dev/null; do
    i=$(((i + 1) % 10))
    printf "\r${spin:$i:1}"
    sleep 0.1
  done

  printf "\r"
  wait "$pid"
}

# Output Formatting Functions
# ============================

# table_header: Print formatted table header
# Usage: table_header "Name" "Status" "Port"
table_header() {
  local columns=("$@")
  local header=""

  for col in "${columns[@]}"; do
    header+="$(printf "%-20s" "$col") │ "
  done

  echo -e "${BOLD}${header%' │ '}${NC}"
  echo -e "${BOLD}$(printf '%.0s─' {1..100})${NC}"
}

# table_row: Print formatted table row
# Usage: table_row "api" "running" "3001"
table_row() {
  local columns=("$@")
  local row=""

  for col in "${columns[@]}"; do
    row+="$(printf "%-20s" "$col") │ "
  done

  echo "${row%' │ '}"
}

# progress: Show progress bar
# Usage: progress 50 100  # 50 out of 100
progress() {
  local current=$1
  local total=$2
  local percent=$((current * 100 / total))
  local bar_length=30
  local filled=$((bar_length * current / total))
  local empty=$((bar_length - filled))

  printf "\r["
  printf "%${filled}s" | tr ' ' '='
  printf "%${empty}s" | tr ' ' '-'
  printf "] %3d%%" "$percent"
}

# Configuration Functions
# =======================

# get_config: Read config value
# Usage: API_PORT=$(get_config "API_PORT")
get_config() {
  local key="$1"
  local config_file="$WITYLOGIX_HOME/config"

  if [[ ! -f "$config_file" ]]; then
    return 1
  fi

  # Use grep to extract key=value
  grep "^${key}=" "$config_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || return 1
}

# set_config: Write config value (creates/updates key)
# Usage: set_config "API_PORT" "3001"
set_config() {
  local key="$1"
  local value="$2"
  local config_file="$WITYLOGIX_HOME/config"

  # Ensure config directory exists
  mkdir -p "$WITYLOGIX_HOME"

  # Create file if doesn't exist
  if [[ ! -f "$config_file" ]]; then
    touch "$config_file"
  fi

  # Update or add key=value
  if grep -q "^${key}=" "$config_file"; then
    # Use sed to update existing key
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$config_file"
    rm -f "${config_file}.bak"
  else
    # Append new key
    echo "${key}=${value}" >> "$config_file"
  fi

  log_verbose "Config: $key = $value"
}

# System Detection Functions
# ==========================

# detect_os: Detect operating system
# Returns: ubuntu, debian, amzn, centos, or unknown
detect_os() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    case "$ID" in
      ubuntu)
        echo "ubuntu"
        ;;
      debian)
        echo "debian"
        ;;
      amzn)
        echo "amzn"
        ;;
      centos)
        echo "centos"
        ;;
      *)
        echo "$ID"
        ;;
    esac
  else
    echo "unknown"
  fi
}

# detect_arch: Detect CPU architecture
# Returns: amd64, arm64, arm, or unknown
detect_arch() {
  local arch
  arch=$(uname -m)

  case "$arch" in
    x86_64)
      echo "amd64"
      ;;
    aarch64)
      echo "arm64"
      ;;
    armv7l)
      echo "arm"
      ;;
    *)
      echo "$arch"
      ;;
  esac
}

# check_port_available: Check if port is available
# Usage: if check_port_available 3001; then ... fi
check_port_available() {
  local port=$1
  ! netstat -tuln 2>/dev/null | grep -q ":$port "
}

# check_disk_space: Check available disk space
# Usage: available=$(check_disk_space)
check_disk_space() {
  local path="${1:-.}"
  df "$path" | awk 'NR==2 {print $4}'
}

# Utility Functions
# =================

# join_array: Join array elements with delimiter
# Usage: join_array "," "apple" "banana" "cherry"
join_array() {
  local delimiter="$1"
  shift
  local first=true
  for item in "$@"; do
    if [[ "$first" == true ]]; then
      printf "%s" "$item"
      first=false
    else
      printf "%s%s" "$delimiter" "$item"
    fi
  done
}

# retry: Retry command with backoff
# Usage: retry 3 5 "docker pull image:latest"
retry() {
  local max_attempts=$1
  local delay=$2
  shift 2
  local cmd=("$@")
  local attempt=1

  while [[ $attempt -le $max_attempts ]]; do
    if "${cmd[@]}"; then
      return 0
    fi

    if [[ $attempt -lt $max_attempts ]]; then
      log_warn "Command failed. Retrying in ${delay}s (attempt $attempt/$max_attempts)"
      sleep "$delay"
      delay=$((delay * 2))  # Exponential backoff
    fi

    attempt=$((attempt + 1))
  done

  log_error "Command failed after $max_attempts attempts"
  return 1
}

# ensure_file: Create file with content if it doesn't exist
# Usage: ensure_file "/path/to/file" "default content"
ensure_file() {
  local filepath="$1"
  local content="$2"

  if [[ ! -f "$filepath" ]]; then
    mkdir -p "$(dirname "$filepath")"
    echo "$content" > "$filepath"
    log_verbose "Created: $filepath"
  fi
}

# ensure_dir: Create directory if it doesn't exist
# Usage: ensure_dir "/path/to/dir"
ensure_dir() {
  local dirpath="$1"
  if [[ ! -d "$dirpath" ]]; then
    mkdir -p "$dirpath"
    log_verbose "Created directory: $dirpath"
  fi
}

# run_as_root: Execute command with sudo if not already root
# Usage: run_as_root "apt-get update"
run_as_root() {
  local cmd="$@"
  if [[ $EUID -eq 0 ]]; then
    eval "$cmd"
  else
    sudo bash -c "$cmd"
  fi
}

# validate_domain: Check if domain is valid
# Usage: if validate_domain "example.com"; then ... fi
validate_domain() {
  local domain="$1"
  if [[ $domain =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$ ]]; then
    return 0
  fi
  return 1
}

# validate_port: Check if port number is valid
# Usage: if validate_port 3001; then ... fi
validate_port() {
  local port=$1
  if [[ $port =~ ^[0-9]+$ ]] && [[ $port -ge 1 ]] && [[ $port -le 65535 ]]; then
    return 0
  fi
  return 1
}

# Load library successfully
log_verbose "Common library loaded"
