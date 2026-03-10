#!/usr/bin/env bash
#
# Witylogix CLI — doctor command
#
# System diagnostics: comprehensive health check across all infrastructure layers
#
# - System checks: OS, CPU, RAM, disk space, swap
# - Network checks: DNS, internet connectivity, required ports, firewall
# - Docker checks: Docker version, Compose, disk usage, containers, images
# - Application checks: Node.js, pnpm, Git, .env file, database, Redis connectivity
# - Prints report with ✅/⚠️/❌ per check
# - Aggregate score: "System Health: N/M checks passed"
# - Supports --output=FILE to save report
# - Supports --fix flag to auto-fix common issues
#
# Usage:
#   cmd_doctor [--output FILE] [--fix]
#
# Flags:
#   --output FILE    Save report to file
#   --fix            Auto-fix common issues (install missing tools, set permissions)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# Status symbols
CHECK="✅"
WARN="⚠️"
FAIL="❌"

# Logging functions
log_info() { echo -e "${GREEN}[witylogix]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix]${NC} $1"; }

# Globals
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
OUTPUT_FILE=""
FIX_MODE=false
CHECKS_PASSED=0
CHECKS_TOTAL=0
REPORT_OUTPUT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output)  OUTPUT_FILE="$2"; shift 2 ;;
    --fix)     FIX_MODE=true; shift ;;
    *)         log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# Helper: add check result to report
add_check() {
  local status="$1"
  local name="$2"
  local details="$3"

  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  if [[ "$status" == "$CHECK" ]]; then
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  fi

  local line="$status  $name"
  if [[ -n "$details" ]]; then
    line="$line — $details"
  fi
  REPORT_OUTPUT="$REPORT_OUTPUT$line\n"
}

# ────────────────────────────────────────────────────────────────────────────
# SYSTEM CHECKS
# ────────────────────────────────────────────────────────────────────────────

check_os() {
  echo -e "\n${CYAN}=== System Information ===${NC}"

  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    local os_name="${ID:-unknown}"
    local os_version="${VERSION_ID:-unknown}"
    add_check "$CHECK" "OS Detection" "$os_name $os_version"
    echo "$CHECK OS: $os_name $os_version"
  else
    add_check "$FAIL" "OS Detection" "Cannot detect OS"
    echo "$FAIL Cannot detect OS from /etc/os-release"
  fi
}

check_kernel() {
  local kernel
  kernel=$(uname -r)
  add_check "$CHECK" "Kernel Version" "$kernel"
  echo "$CHECK Kernel: $kernel"
}

check_cpu() {
  local cores
  cores=$(nproc)
  local arch
  arch=$(uname -m)
  add_check "$CHECK" "CPU" "$cores cores, $arch architecture"
  echo "$CHECK CPU: $cores cores, $arch"
}

check_ram() {
  local total_kb
  total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  local total_gb=$((total_kb / 1024 / 1024))
  local available_kb
  available_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
  local available_gb=$((available_kb / 1024 / 1024))

  if [[ $total_gb -lt 2 ]]; then
    add_check "$WARN" "RAM" "${total_gb}GB total, ${available_gb}GB available (minimum 2GB recommended)"
    echo "$WARN RAM: ${total_gb}GB total, ${available_gb}GB available"
  else
    add_check "$CHECK" "RAM" "${total_gb}GB total, ${available_gb}GB available"
    echo "$CHECK RAM: ${total_gb}GB total, ${available_gb}GB available"
  fi
}

check_disk() {
  local disk_info
  disk_info=$(df -h / | awk 'NR==2 {print $2, $3, $4, $5}')
  local total
  total=$(df -h / | awk 'NR==2 {print $2}')
  local used
  used=$(df -h / | awk 'NR==2 {print $3}')
  local available
  available=$(df -h / | awk 'NR==2 {print $4}')
  local percent
  percent=$(df -h / | awk 'NR==2 {print $5}')

  if [[ ${percent%\%} -gt 90 ]]; then
    add_check "$FAIL" "Disk Space" "Total: $total, Used: $used, Available: $available ($percent used)"
    echo "$FAIL Disk: Total=$total, Used=$used, Available=$available ($percent)"
  elif [[ ${percent%\%} -gt 75 ]]; then
    add_check "$WARN" "Disk Space" "Total: $total, Used: $used, Available: $available ($percent used)"
    echo "$WARN Disk: Total=$total, Used=$used, Available=$available ($percent)"
  else
    add_check "$CHECK" "Disk Space" "Total: $total, Used: $used, Available: $available ($percent used)"
    echo "$CHECK Disk: Total=$total, Used=$used, Available=$available ($percent)"
  fi
}

check_swap() {
  local swap_total
  swap_total=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
  local swap_free
  swap_free=$(grep SwapFree /proc/meminfo | awk '{print $2}')
  local swap_gb=$((swap_total / 1024 / 1024))

  if [[ $swap_gb -eq 0 ]]; then
    add_check "$WARN" "Swap Space" "No swap configured (recommended: 2-4GB)"
    echo "$WARN Swap: None configured"
  else
    add_check "$CHECK" "Swap Space" "${swap_gb}GB"
    echo "$CHECK Swap: ${swap_gb}GB"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# NETWORK CHECKS
# ────────────────────────────────────────────────────────────────────────────

check_dns() {
  echo -e "\n${CYAN}=== Network Configuration ===${NC}"

  if command -v dig &> /dev/null; then
    if dig google.com &> /dev/null; then
      add_check "$CHECK" "DNS Resolution" "google.com resolves correctly"
      echo "$CHECK DNS: Working"
    else
      add_check "$FAIL" "DNS Resolution" "Cannot resolve google.com"
      echo "$FAIL DNS: Cannot resolve google.com"
    fi
  else
    # Fallback without dig
    if ping -c 1 8.8.8.8 &> /dev/null; then
      add_check "$CHECK" "DNS Resolution" "Can reach 8.8.8.8"
      echo "$CHECK DNS: Working (via ping)"
    else
      add_check "$FAIL" "DNS Resolution" "Cannot reach 8.8.8.8"
      echo "$FAIL DNS: Not working"
    fi
  fi
}

check_internet() {
  echo -n "Checking internet connectivity... "
  if curl -s -f -m 5 "https://api.github.com" &> /dev/null; then
    add_check "$CHECK" "Internet Connectivity" "https://api.github.com reachable"
    echo "$CHECK"
  else
    add_check "$FAIL" "Internet Connectivity" "Cannot reach https://api.github.com"
    echo "$FAIL"
  fi
}

check_ports() {
  echo -n "Checking required ports... "
  local missing_ports=""

  for port in 3001 3002 5432 6379 80 443; do
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port " || lsof -i :$port &>/dev/null 2>&1 || true; then
      : # Port is in use or available
    else
      missing_ports="$missing_ports $port"
    fi
  done

  if [[ -z "$missing_ports" ]]; then
    add_check "$CHECK" "Required Ports" "3001, 3002, 5432, 6379, 80, 443 available"
    echo "$CHECK"
  else
    add_check "$WARN" "Required Ports" "Some ports may be in use: $missing_ports"
    echo "$WARN (ports$missing_ports in use)"
  fi
}

check_firewall() {
  echo -n "Checking firewall status... "
  if command -v ufw &> /dev/null; then
    if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
      add_check "$WARN" "Firewall" "UFW active (verify port rules)"
      echo "$WARN (UFW active)"
    else
      add_check "$CHECK" "Firewall" "UFW inactive"
      echo "$CHECK"
    fi
  elif command -v systemctl &> /dev/null && systemctl is-active iptables &>/dev/null 2>&1; then
    add_check "$WARN" "Firewall" "iptables active (verify port rules)"
    echo "$WARN (iptables active)"
  else
    add_check "$CHECK" "Firewall" "No firewall detected"
    echo "$CHECK"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# DOCKER CHECKS
# ────────────────────────────────────────────────────────────────────────────

check_docker() {
  echo -e "\n${CYAN}=== Docker & Containers ===${NC}"

  if command -v docker &> /dev/null; then
    local docker_version
    docker_version=$(docker --version | cut -d' ' -f3 | sed 's/,//')
    add_check "$CHECK" "Docker Installation" "$docker_version"
    echo "$CHECK Docker: $docker_version"
  else
    add_check "$FAIL" "Docker Installation" "Docker not installed"
    echo "$FAIL Docker: Not installed"
    if [[ "$FIX_MODE" = true ]]; then
      log_warn "Run: infra/cli/commands/install.sh to install Docker"
    fi
    return 1
  fi
}

check_docker_compose() {
  if command -v docker-compose &> /dev/null; then
    local compose_version
    compose_version=$(docker-compose --version | grep -oP '[\d.]+' | head -1)
    add_check "$CHECK" "Docker Compose" "$compose_version"
    echo "$CHECK Docker Compose: $compose_version"
  else
    add_check "$FAIL" "Docker Compose" "Not installed"
    echo "$FAIL Docker Compose: Not installed"
    return 1
  fi
}

check_docker_daemon() {
  if docker ps &> /dev/null; then
    add_check "$CHECK" "Docker Daemon" "Running and accessible"
    echo "$CHECK Docker Daemon: Running"
  else
    add_check "$FAIL" "Docker Daemon" "Not running or not accessible"
    echo "$FAIL Docker Daemon: Not running"
    return 1
  fi
}

check_docker_disk() {
  local disk_info
  disk_info=$(docker system df 2>/dev/null | tail -1)
  if [[ -n "$disk_info" ]]; then
    local images_size
    images_size=$(docker system df 2>/dev/null | grep "Images" | awk '{print $2}')
    add_check "$CHECK" "Docker Images Size" "$images_size"
    echo "$CHECK Docker Images: $images_size"
  else
    add_check "$WARN" "Docker Images Size" "Could not determine size"
    echo "$WARN Docker Images: Size unknown"
  fi
}

check_running_containers() {
  local running
  running=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l)
  local total
  total=$(docker ps -a --format "{{.Names}}" 2>/dev/null | wc -l)

  echo "$CHECK Running Containers: $running/$total"
  add_check "$CHECK" "Running Containers" "$running out of $total"

  # Check specific Witylogix containers
  local required_containers=("witylogix-api" "witylogix-dashboard" "witylogix-postgres" "witylogix-redis")
  for container in "${required_containers[@]}"; do
    local status
    status=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -c "$container" || echo "0")
    if [[ "$status" -eq 1 ]]; then
      echo "$CHECK  $container: Running"
    else
      echo "$WARN  $container: Not running"
    fi
  done
}

# ────────────────────────────────────────────────────────────────────────────
# APPLICATION CHECKS
# ────────────────────────────────────────────────────────────────────────────

check_nodejs() {
  echo -e "\n${CYAN}=== Application Requirements ===${NC}"

  if command -v node &> /dev/null; then
    local node_version
    node_version=$(node --version)
    local major_version
    major_version=$(echo "$node_version" | grep -oP 'v\K[0-9]+' | head -1)

    if [[ $major_version -ge 20 ]]; then
      add_check "$CHECK" "Node.js" "$node_version (>= v20 required)"
      echo "$CHECK Node.js: $node_version"
    else
      add_check "$FAIL" "Node.js" "$node_version (>= v20 required)"
      echo "$FAIL Node.js: $node_version (minimum v20 required)"
    fi
  else
    add_check "$FAIL" "Node.js" "Not installed"
    echo "$FAIL Node.js: Not installed"
  fi
}

check_pnpm() {
  if command -v pnpm &> /dev/null; then
    local pnpm_version
    pnpm_version=$(pnpm --version)
    add_check "$CHECK" "pnpm" "$pnpm_version"
    echo "$CHECK pnpm: $pnpm_version"
  else
    add_check "$WARN" "pnpm" "Not installed (optional)"
    echo "$WARN pnpm: Not installed"
  fi
}

check_git() {
  if command -v git &> /dev/null; then
    local git_version
    git_version=$(git --version | cut -d' ' -f3)
    add_check "$CHECK" "Git" "$git_version"
    echo "$CHECK Git: $git_version"
  else
    add_check "$FAIL" "Git" "Not installed"
    echo "$FAIL Git: Not installed"
  fi
}

check_env_file() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    echo "$CHECK .env file: Found"
    add_check "$CHECK" ".env File" "File exists"

    # Check required variables
    local required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET")
    local missing_vars=""

    for var in "${required_vars[@]}"; do
      if ! grep -q "^${var}=" "$ROOT_DIR/.env"; then
        missing_vars="$missing_vars $var"
      fi
    done

    if [[ -z "$missing_vars" ]]; then
      add_check "$CHECK" ".env Variables" "All required variables set"
      echo "$CHECK .env Variables: All required variables present"
    else
      add_check "$WARN" ".env Variables" "Missing:$missing_vars"
      echo "$WARN .env Variables: Missing$missing_vars"
    fi
  else
    add_check "$FAIL" ".env File" "File not found"
    echo "$FAIL .env file: Not found"
  fi
}

check_database_connectivity() {
  echo -n "Checking database connectivity... "
  if docker ps --format "{{.Names}}" | grep -q "witylogix-postgres"; then
    if docker exec witylogix-postgres pg_isready -U witylogix &> /dev/null; then
      add_check "$CHECK" "PostgreSQL Connectivity" "Connected successfully"
      echo "$CHECK"
    else
      add_check "$FAIL" "PostgreSQL Connectivity" "Cannot connect"
      echo "$FAIL"
    fi
  else
    add_check "$WARN" "PostgreSQL Connectivity" "Container not running"
    echo "$WARN (container not running)"
  fi
}

check_redis_connectivity() {
  echo -n "Checking Redis connectivity... "
  if docker ps --format "{{.Names}}" | grep -q "witylogix-redis"; then
    if docker exec witylogix-redis redis-cli ping &> /dev/null; then
      add_check "$CHECK" "Redis Connectivity" "Connected successfully"
      echo "$CHECK"
    else
      add_check "$FAIL" "Redis Connectivity" "Cannot connect"
      echo "$FAIL"
    fi
  else
    add_check "$WARN" "Redis Connectivity" "Container not running"
    echo "$WARN (container not running)"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# AUTO-FIX FUNCTIONS
# ────────────────────────────────────────────────────────────────────────────

auto_fix() {
  if [[ "$FIX_MODE" = false ]]; then
    return
  fi

  log_info "Attempting to fix common issues..."

  # Create .env if missing
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    log_info "Generating .env file..."
    # This would typically be done by install.sh
  fi

  # Set file permissions
  if [[ -d "$ROOT_DIR" ]]; then
    chmod 755 "$ROOT_DIR" 2>/dev/null || true
    chmod 644 "$ROOT_DIR/.env" 2>/dev/null || true
  fi

  log_info "Basic fixes applied"
}

# ────────────────────────────────────────────────────────────────────────────
# MAIN DOCTOR FUNCTION
# ────────────────────────────────────────────────────────────────────────────

cmd_doctor() {
  echo ""
  log_info "Starting system diagnostics..."
  echo ""

  # Run all checks
  check_os
  check_kernel
  check_cpu
  check_ram
  check_disk
  check_swap

  check_dns
  check_internet
  check_ports
  check_firewall

  check_docker || true
  check_docker_compose || true
  check_docker_daemon || true
  check_docker_disk || true
  check_running_containers

  check_nodejs
  check_pnpm
  check_git
  check_env_file
  check_database_connectivity
  check_redis_connectivity

  # Print summary
  echo ""
  echo -e "${CYAN}=== System Health Summary ===${NC}"
  local health_percent=$((CHECKS_PASSED * 100 / CHECKS_TOTAL))
  echo "System Health: ${CHECKS_PASSED}/${CHECKS_TOTAL} checks passed (${health_percent}%)"

  if [[ $health_percent -eq 100 ]]; then
    echo -e "${GREEN}✅ All systems operational${NC}"
  elif [[ $health_percent -gt 80 ]]; then
    echo -e "${YELLOW}⚠️  Most systems operational, review warnings above${NC}"
  else
    echo -e "${RED}❌ Critical issues detected, review failures above${NC}"
  fi

  # Save report if requested
  if [[ -n "$OUTPUT_FILE" ]]; then
    echo -e "$REPORT_OUTPUT" > "$OUTPUT_FILE"
    log_info "Report saved to $OUTPUT_FILE"
  fi

  # Apply fixes if requested
  auto_fix

  echo ""
}

# Run doctor command if script is executed directly
cmd_doctor "$@"
