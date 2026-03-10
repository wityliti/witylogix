#!/usr/bin/env bash
#
# Witylogix AI Command — AI-powered platform diagnostics and optimization
#
# Uses Claude AI to analyze platform health, diagnose issues, and recommend optimizations
#
# Usage:
#   ./witylogix ai [subcommand] [options]
#
# Subcommands:
#   setup      Configure Anthropic API key and enable AI features
#   diagnose   Analyze platform health and identify issues
#   optimize   Get AI recommendations for performance optimization
#   help       Show available AI subcommands
#
# Options:
#   --output=FILE      Save diagnostic report to file (diagnose only)
#   --apply            Auto-apply safe recommendations (optimize only)
#   -h, --help         Show this help
#
# Examples:
#   ./witylogix ai setup                    # Setup API key
#   ./witylogix ai diagnose                 # Run diagnostics
#   ./witylogix ai diagnose --output=report.json  # Save report
#   ./witylogix ai optimize                 # Get optimization recommendations
#   ./witylogix ai optimize --apply         # Apply recommendations
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd "$INFRA_DIR/.." && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix-ai]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix-ai]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix-ai]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }
log_debug() { echo -e "${BLUE}  ⊙${NC} $1"; }

# Configuration
WITYLOGIX_HOME="${WITYLOGIX_HOME:-$HOME/.witylogix}"
CONFIG_FILE="$WITYLOGIX_HOME/config"
OUTPUT_FILE=""
APPLY_CHANGES=false
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"

# ─────────────────────────────────────────────────────────────────────────────
# cmd_setup — Configure Anthropic API key
# ─────────────────────────────────────────────────────────────────────────────
cmd_setup() {
  log_info "Setting up AI features..."

  # Create config directory
  mkdir -p "$WITYLOGIX_HOME"

  # Prompt for API key
  echo ""
  echo "Get your Anthropic API key from: https://console.anthropic.com/account/keys"
  echo ""
  read -r -p "Enter your Anthropic API key: " api_key

  # Validate key format (sk-ant-*)
  if [[ ! "$api_key" =~ ^sk-ant- ]]; then
    log_error "Invalid API key format. API keys must start with 'sk-ant-'"
    exit 1
  fi

  # Store API key in config file
  mkdir -p "$WITYLOGIX_HOME"
  cat > "$CONFIG_FILE" <<EOF
# Witylogix AI Configuration
ANTHROPIC_API_KEY="$api_key"
AI_ENABLED=true
EOF

  chmod 600 "$CONFIG_FILE"
  log_debug "Configuration stored in $CONFIG_FILE"

  # Test connection to Anthropic API
  log_cmd "Testing connection to Anthropic API..."

  local test_response
  test_response=$(curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $api_key" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{
      "model": "claude-opus-4-6",
      "max_tokens": 100,
      "messages": [{"role": "user", "content": "test"}]
    }' 2>/dev/null || echo "{\"error\": \"Connection failed\"}")

  if echo "$test_response" | grep -q "error"; then
    log_error "Failed to connect to Anthropic API. Check your API key."
    exit 1
  fi

  log_debug "Connection successful"

  # Update .env file in docs app
  log_cmd "Enabling AI search in docs app..."

  local docs_env="$ROOT_DIR/apps/docs/.env.local"
  if [[ ! -f "$docs_env" ]]; then
    mkdir -p "$ROOT_DIR/apps/docs"
    touch "$docs_env"
  fi

  if grep -q "ANTHROPIC_API_KEY" "$docs_env"; then
    sed -i.bak "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=\"$api_key\"/" "$docs_env"
  else
    echo "ANTHROPIC_API_KEY=\"$api_key\"" >> "$docs_env"
  fi

  log_debug "Updated $docs_env"

  # Summary
  log_info "AI features configured successfully!"
  echo ""
  echo "Available AI features:"
  echo "  • witylogix ai diagnose     — Analyze platform health"
  echo "  • witylogix ai optimize     — Get performance recommendations"
  echo "  • AI search in docs app     — Search with Claude AI"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# load_api_key — Load API key from config
# ─────────────────────────────────────────────────────────────────────────────
load_api_key() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "API key not configured. Run: ./witylogix ai setup"
    exit 1
  fi

  # Source config file
  source "$CONFIG_FILE"

  if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    log_error "ANTHROPIC_API_KEY not found in config. Run: ./witylogix ai setup"
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# mask_secrets — Mask sensitive information in .env
# ─────────────────────────────────────────────────────────────────────────────
mask_secrets() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    return
  fi

  grep -v "^#" "$env_file" | while read -r line; do
    if [[ -z "$line" ]]; then
      echo ""
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    # List of sensitive keys to mask
    if [[ "$key" =~ ^(API_KEY|TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|_SECRET)$ ]] || \
       [[ "$key" =~ API_KEY$ ]] || \
       [[ "$key" =~ TOKEN$ ]] || \
       [[ "$key" =~ SECRET$ ]]; then
      echo "${key}=***MASKED***"
    else
      echo "$line"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_system_info — Collect system information
# ─────────────────────────────────────────────────────────────────────────────
collect_system_info() {
  local os_type
  local docker_version
  local disk_usage
  local memory_total
  local cpu_count

  os_type=$(uname -s)
  docker_version=$(docker --version 2>/dev/null || echo "Not installed")
  disk_usage=$(df -h / | tail -1 | awk '{print $5}')
  memory_total=$(free -h | grep Mem | awk '{print $2}')
  cpu_count=$(nproc 2>/dev/null || echo "Unknown")

  cat <<EOF
{
  "os": "$os_type",
  "docker_version": "$docker_version",
  "disk_usage": "$disk_usage",
  "memory_total": "$memory_total",
  "cpu_count": "$cpu_count"
}
EOF
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_container_logs — Collect service logs from containers
# ─────────────────────────────────────────────────────────────────────────────
collect_container_logs() {
  local logs="{}"

  # Get list of running containers
  local containers
  containers=$(docker ps --format "{{.Names}}" 2>/dev/null || echo "")

  if [[ -z "$containers" ]]; then
    echo '{"error": "No running containers"}'
    return
  fi

  logs="{"
  local first=true

  while IFS= read -r container; do
    if [[ -z "$container" ]]; then
      continue
    fi

    local container_logs
    container_logs=$(docker logs --tail 100 "$container" 2>&1 | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

    if [[ "$first" = false ]]; then
      logs="${logs},"
    fi
    logs="${logs}\"${container}\": \"${container_logs}\""
    first=false
  done <<< "$containers"

  logs="${logs}}"
  echo "$logs"
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_health_checks — Collect service health status
# ─────────────────────────────────────────────────────────────────────────────
collect_health_checks() {
  local health_status="{}"

  # Check if Docker is running
  if ! docker info &>/dev/null; then
    echo '{"docker": "Not running", "error": "Docker daemon not accessible"}'
    return
  fi

  health_status='{"docker": "Running"'

  # Check containers
  local running
  running=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l)
  health_status="${health_status}, \"containers_running\": $running"

  # Check Postgres
  local pg_status="Unknown"
  if docker ps --format "{{.Names}}" 2>/dev/null | grep -q postgres; then
    pg_status="Running"
  fi
  health_status="${health_status}, \"postgres\": \"${pg_status}\""

  # Check Redis
  local redis_status="Unknown"
  if docker ps --format "{{.Names}}" 2>/dev/null | grep -q redis; then
    redis_status="Running"
  fi
  health_status="${health_status}, \"redis\": \"${redis_status}\""

  health_status="${health_status}}"
  echo "$health_status"
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_postgres_stats — Collect PostgreSQL statistics
# ─────────────────────────────────────────────────────────────────────────────
collect_postgres_stats() {
  local pg_container=""

  # Find Postgres container
  pg_container=$(docker ps --filter "name=postgres" --format "{{.Names}}" 2>/dev/null | head -1 || echo "")

  if [[ -z "$pg_container" ]]; then
    echo '{"error": "PostgreSQL container not found"}'
    return
  fi

  local stats
  stats=$(docker exec "$pg_container" psql -U witylogix -d witylogix -c "
    SELECT
      datname,
      sum(heap_blks_read) as heap_reads,
      sum(heap_blks_hit) as heap_hits,
      sum(idx_blks_read) as index_reads,
      sum(idx_blks_hit) as index_hits
    FROM pg_stat_statio_user_tables
    GROUP BY datname;
  " 2>/dev/null || echo "Unable to fetch stats")

  echo "{\"postgres_stats\": \"$stats\"}"
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_redis_stats — Collect Redis statistics
# ─────────────────────────────────────────────────────────────────────────────
collect_redis_stats() {
  local redis_container=""

  # Find Redis container
  redis_container=$(docker ps --filter "name=redis" --format "{{.Names}}" 2>/dev/null | head -1 || echo "")

  if [[ -z "$redis_container" ]]; then
    echo '{"error": "Redis container not found"}'
    return
  fi

  local stats
  stats=$(docker exec "$redis_container" redis-cli INFO 2>/dev/null || echo "Unable to fetch stats")

  echo "{\"redis_stats\": \"$stats\"}"
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_env_file — Collect and mask .env file
# ─────────────────────────────────────────────────────────────────────────────
collect_env_file() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    echo '{"error": ".env file not found"}'
    return
  fi

  local masked_env
  masked_env=$(mask_secrets "$ROOT_DIR/.env" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

  echo "{\"env_file\": \"$masked_env\"}"
}

# ─────────────────────────────────────────────────────────────────────────────
# cmd_diagnose — Run AI diagnostics on the platform
# ─────────────────────────────────────────────────────────────────────────────
cmd_diagnose() {
  load_api_key

  log_info "Running platform diagnostics..."

  # Collect diagnostic data
  log_cmd "Collecting system information..."
  local system_info
  system_info=$(collect_system_info)

  log_cmd "Collecting service logs..."
  local container_logs
  container_logs=$(collect_container_logs)

  log_cmd "Collecting health status..."
  local health_checks
  health_checks=$(collect_health_checks)

  log_cmd "Collecting database statistics..."
  local postgres_stats
  postgres_stats=$(collect_postgres_stats)

  log_cmd "Collecting cache statistics..."
  local redis_stats
  redis_stats=$(collect_redis_stats)

  log_cmd "Collecting environment configuration..."
  local env_file
  env_file=$(collect_env_file)

  # Build diagnostic prompt
  local prompt_template
  if [[ ! -f "$TEMPLATES_DIR/ai-diagnose-prompt.txt" ]]; then
    log_error "Diagnostic prompt template not found at $TEMPLATES_DIR/ai-diagnose-prompt.txt"
    exit 1
  fi

  prompt_template=$(cat "$TEMPLATES_DIR/ai-diagnose-prompt.txt")

  # Create full diagnostic report
  local diagnostic_data
  diagnostic_data=$(cat <<EOF
SYSTEM INFO:
$system_info

CONTAINER LOGS:
$container_logs

HEALTH CHECKS:
$health_checks

POSTGRES STATS:
$postgres_stats

REDIS STATS:
$redis_stats

ENV FILE (MASKED):
$env_file
EOF
)

  # Build Claude API request
  local api_payload
  api_payload=$(cat <<'EOF' | sed "s|{SYSTEM_PROMPT}|$prompt_template|g; s|{DIAGNOSTIC_DATA}|$diagnostic_data|g"
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 2000,
  "messages": [
    {
      "role": "user",
      "content": "{SYSTEM_PROMPT}\n\nDiagnostic Data:\n{DIAGNOSTIC_DATA}"
    }
  ]
}
EOF
)

  log_cmd "Sending diagnostics to Claude API..."

  # Call Claude API
  local response
  response=$(curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$api_payload" 2>/dev/null)

  # Parse response
  if echo "$response" | grep -q "error"; then
    log_error "API request failed"
    echo "$response" | grep -o '"message":"[^"]*' | cut -d'"' -f4
    exit 1
  fi

  # Extract text content from response
  local diagnosis
  diagnosis=$(echo "$response" | grep -o '"text":"[^"]*' | head -1 | cut -d'"' -f4)

  if [[ -z "$diagnosis" ]]; then
    log_warn "Unable to parse API response"
    exit 1
  fi

  # Decode escaped characters
  diagnosis=$(echo -e "$diagnosis" | sed 's/\\n/\n/g')

  # Save to file if requested
  if [[ -n "$OUTPUT_FILE" ]]; then
    echo "$diagnosis" > "$OUTPUT_FILE"
    log_debug "Full report saved to $OUTPUT_FILE"
  fi

  # Display formatted diagnosis
  log_info "Platform Diagnostic Report"
  echo ""
  echo "=========================================="
  echo "$diagnosis"
  echo "=========================================="
  echo ""

  if [[ -n "$OUTPUT_FILE" ]]; then
    log_info "Full report saved to: $OUTPUT_FILE"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# collect_docker_stats — Collect Docker resource usage
# ─────────────────────────────────────────────────────────────────────────────
collect_docker_stats() {
  local stats
  stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "Unable to fetch stats")

  echo "{\"docker_stats\": \"$stats\"}"
}

# ─────────────────────────────────────────────────────────────────────────────
# cmd_optimize — Get AI recommendations for optimization
# ─────────────────────────────────────────────────────────────────────────────
cmd_optimize() {
  load_api_key

  log_info "Analyzing platform for optimization opportunities..."

  # Collect optimization data
  log_cmd "Collecting Docker resource usage..."
  local docker_stats
  docker_stats=$(collect_docker_stats)

  log_cmd "Collecting database statistics..."
  local postgres_stats
  postgres_stats=$(collect_postgres_stats)

  log_cmd "Collecting cache statistics..."
  local redis_stats
  redis_stats=$(collect_redis_stats)

  # Build optimization prompt
  local prompt_template
  if [[ ! -f "$TEMPLATES_DIR/ai-optimize-prompt.txt" ]]; then
    log_error "Optimization prompt template not found at $TEMPLATES_DIR/ai-optimize-prompt.txt"
    exit 1
  fi

  prompt_template=$(cat "$TEMPLATES_DIR/ai-optimize-prompt.txt")

  # Create optimization data report
  local optimization_data
  optimization_data=$(cat <<EOF
DOCKER STATS:
$docker_stats

POSTGRES STATS:
$postgres_stats

REDIS STATS:
$redis_stats
EOF
)

  # Build Claude API request
  local api_payload
  api_payload=$(cat <<'EOF' | sed "s|{SYSTEM_PROMPT}|$prompt_template|g; s|{OPTIMIZATION_DATA}|$optimization_data|g"
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 2000,
  "messages": [
    {
      "role": "user",
      "content": "{SYSTEM_PROMPT}\n\nOptimization Data:\n{OPTIMIZATION_DATA}"
    }
  ]
}
EOF
)

  log_cmd "Analyzing performance metrics with Claude..."

  # Call Claude API
  local response
  response=$(curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$api_payload" 2>/dev/null)

  # Parse response
  if echo "$response" | grep -q "error"; then
    log_error "API request failed"
    exit 1
  fi

  # Extract text content
  local recommendations
  recommendations=$(echo "$response" | grep -o '"text":"[^"]*' | head -1 | cut -d'"' -f4)

  if [[ -z "$recommendations" ]]; then
    log_warn "Unable to parse API response"
    exit 1
  fi

  # Decode escaped characters
  recommendations=$(echo -e "$recommendations" | sed 's/\\n/\n/g')

  # Display recommendations
  log_info "Optimization Recommendations"
  echo ""
  echo "=========================================="
  echo "$recommendations"
  echo "=========================================="
  echo ""

  # Apply changes if requested
  if [[ "$APPLY_CHANGES" = true ]]; then
    log_warn "Auto-apply is not yet implemented for this release"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# cmd_help — Show AI subcommands
# ─────────────────────────────────────────────────────────────────────────────
cmd_help() {
  echo "Witylogix AI — AI-powered platform features"
  echo ""
  echo "Usage: ./witylogix ai [subcommand] [options]"
  echo ""
  echo "Subcommands:"
  echo "  setup      Configure Anthropic API key and enable AI features"
  echo "  diagnose   Analyze platform health and identify issues"
  echo "  optimize   Get AI recommendations for performance optimization"
  echo "  help       Show this help message"
  echo ""
  echo "Options:"
  echo "  --output=FILE      Save diagnostic report to file (diagnose only)"
  echo "  --apply            Auto-apply safe recommendations (optimize only)"
  echo "  -h, --help         Show this help"
  echo ""
  echo "Examples:"
  echo "  ./witylogix ai setup                         # Configure API key"
  echo "  ./witylogix ai diagnose                      # Run diagnostics"
  echo "  ./witylogix ai diagnose --output=report.json # Save report"
  echo "  ./witylogix ai optimize                      # Get recommendations"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Parse options
# ─────────────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --output=*)
      OUTPUT_FILE="${1#*=}"
      shift ;;
    --apply)
      APPLY_CHANGES=true
      shift ;;
    -h|--help)
      cmd_help
      exit 0 ;;
    setup|diagnose|optimize|help)
      break ;;
    -*)
      log_error "Unknown option: $1"
      cmd_help
      exit 1 ;;
    *)
      break ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Main command routing
# ─────────────────────────────────────────────────────────────────────────────
SUBCOMMAND="${1:-help}"

case $SUBCOMMAND in
  setup)    cmd_setup ;;
  diagnose) cmd_diagnose ;;
  optimize) cmd_optimize ;;
  help)     cmd_help ;;
  *)        log_error "Unknown subcommand: $SUBCOMMAND"; cmd_help; exit 1 ;;
esac
