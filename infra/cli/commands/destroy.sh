#!/usr/bin/env bash
#
# Witylogix CLI — destroy command
#
# DANGER: Clean teardown of all containers and optionally data:
# - REQUIRES explicit confirmation ("type DESTROY to confirm")
# - Stops all containers
# - Removes all containers
# - Removes Docker volumes (with --volumes flag, otherwise warn)
# - Removes Docker images (with --images flag)
# - Removes install directory (with --all flag)
# - Removes ~/.witylogix config (with --all flag)
# - Prints what was removed and disk space freed
#
# Flags:
#   --keep-data       Remove containers but keep volumes/data
#   --volumes         Also remove Docker volumes
#   --images          Also remove Docker images
#   --all             Remove everything including install and config
#   --force           Skip confirmation (for CI)
#
# Usage:
#   cmd_destroy [options]
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
KEEP_DATA=false
REMOVE_VOLUMES=false
REMOVE_IMAGES=false
REMOVE_ALL=false
FORCE=false

# Track what we'll remove for reporting
declare -a ITEMS_REMOVED=()
SPACE_FREED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --keep-data)    KEEP_DATA=true; shift ;;
    --volumes)      REMOVE_VOLUMES=true; shift ;;
    --images)       REMOVE_IMAGES=true; shift ;;
    --all)          REMOVE_ALL=true; shift ;;
    --force)        FORCE=true; shift ;;
    -h|--help)      show_help; exit 0 ;;
    *)              log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# Show what will be destroyed
show_destruction_plan() {
  echo ""
  log_warn "╔════════════════════════════════════════════╗"
  log_warn "║           DANGER: DESTROY PLAN             ║"
  log_warn "╚════════════════════════════════════════════╝"
  echo ""

  echo "This operation will:"
  echo "  • Stop all running containers"
  echo "  • Remove all containers"
  if [[ "$KEEP_DATA" != true ]]; then
    if [[ "$REMOVE_VOLUMES" == true ]]; then
      echo "  • Remove all Docker volumes (DATA LOSS!)"
    else
      echo "  • Keep Docker volumes (data preserved)"
    fi
  else
    echo "  • Keep Docker volumes (data preserved)"
  fi

  if [[ "$REMOVE_IMAGES" == true ]]; then
    echo "  • Remove all Docker images"
  fi

  if [[ "$REMOVE_ALL" == true ]]; then
    echo "  • Remove entire install directory: $ROOT_DIR"
    echo "  • Remove ~/.witylogix config directory"
  fi

  echo ""
  log_error "IMPORTANT: This action cannot be undone!"
  echo ""
}

# Get size of item in human-readable format
get_size() {
  local path="$1"
  if [[ -d "$path" ]]; then
    du -sh "$path" 2>/dev/null | awk '{print $1}' || echo "unknown"
  elif [[ -f "$path" ]]; then
    ls -lh "$path" 2>/dev/null | awk '{print $5}' || echo "unknown"
  else
    echo "0B"
  fi
}

# Confirm destruction
confirm_destruction() {
  if [[ "$FORCE" == true ]]; then
    log_warn "Force mode enabled (--force), skipping confirmation"
    return 0
  fi

  echo ""
  log_error "Type 'DESTROY' (in capitals) to confirm permanent destruction:"
  read -r -p "  > " confirmation

  if [[ "$confirmation" != "DESTROY" ]]; then
    log_info "Destruction cancelled"
    exit 0
  fi

  return 0
}

# Stop all containers
stop_containers() {
  log_step "Stopping containers..."

  cd "$ROOT_DIR"
  if [[ ! -f "docker-compose.yml" ]]; then
    log_warn "docker-compose.yml not found, skipping container stop"
    return 0
  fi

  if docker-compose down 2>/dev/null; then
    log_success "Containers stopped and removed"
    ITEMS_REMOVED+=("All containers")
    return 0
  else
    log_error "Failed to stop containers"
    return 1
  fi
}

# Remove Docker volumes
remove_volumes() {
  if [[ "$KEEP_DATA" == true ]]; then
    log_warn "Keeping Docker volumes (--keep-data flag set)"
    return 0
  fi

  if [[ "$REMOVE_VOLUMES" != true ]]; then
    log_warn "Skipping volume removal (use --volumes to remove)"
    return 0
  fi

  log_step "Removing Docker volumes..."

  cd "$ROOT_DIR"
  local volume_list
  volume_list=$(docker volume ls --filter "label=com.docker.compose.project=$(basename "$ROOT_DIR")" --format "{{.Name}}" 2>/dev/null || echo "")

  if [[ -z "$volume_list" ]]; then
    log_info "No volumes to remove"
    return 0
  fi

  local vol_count=0
  while IFS= read -r volume; do
    if [[ -n "$volume" ]]; then
      if docker volume rm "$volume" 2>/dev/null; then
        vol_count=$((vol_count + 1))
      fi
    fi
  done <<< "$volume_list"

  if [[ $vol_count -gt 0 ]]; then
    log_success "Removed $vol_count Docker volumes"
    ITEMS_REMOVED+=("$vol_count Docker volumes")
  fi

  return 0
}

# Remove Docker images
remove_images() {
  if [[ "$REMOVE_IMAGES" != true ]]; then
    log_warn "Skipping image removal (use --images to remove)"
    return 0
  fi

  log_step "Removing Docker images..."

  # Try to remove images related to this project
  local image_count=0
  local images
  images=$(docker images | grep -E "witylogix|api|dashboard|docs" | awk '{print $3}' 2>/dev/null || echo "")

  if [[ -z "$images" ]]; then
    log_info "No project images found to remove"
    return 0
  fi

  while IFS= read -r image_id; do
    if [[ -n "$image_id" ]]; then
      if docker rmi -f "$image_id" 2>/dev/null; then
        image_count=$((image_count + 1))
      fi
    fi
  done <<< "$images"

  if [[ $image_count -gt 0 ]]; then
    log_success "Removed $image_count Docker images"
    ITEMS_REMOVED+=("$image_count Docker images")
  fi

  return 0
}

# Remove install directory
remove_install_dir() {
  if [[ "$REMOVE_ALL" != true ]]; then
    return 0
  fi

  log_step "Removing install directory: $ROOT_DIR"

  if [[ ! -d "$ROOT_DIR" ]]; then
    log_info "Install directory already removed"
    return 0
  fi

  # Get size before removal
  local size
  size=$(get_size "$ROOT_DIR")

  # Remove the directory
  if rm -rf "$ROOT_DIR"; then
    log_success "Removed install directory"
    ITEMS_REMOVED+=("Install directory ($size)")
    return 0
  else
    log_error "Failed to remove install directory"
    return 1
  fi
}

# Remove config directory
remove_config() {
  if [[ "$REMOVE_ALL" != true ]]; then
    return 0
  fi

  log_step "Removing ~/.witylogix config..."

  local config_dir="$HOME/.witylogix"
  if [[ ! -d "$config_dir" ]]; then
    log_info "Config directory not found"
    return 0
  fi

  # Get size before removal
  local size
  size=$(get_size "$config_dir")

  # Remove the directory
  if rm -rf "$config_dir"; then
    log_success "Removed config directory"
    ITEMS_REMOVED+=("Config directory ($size)")
    return 0
  else
    log_error "Failed to remove config directory"
    return 1
  fi
}

# Show cleanup summary
show_summary() {
  echo ""
  log_success "╔════════════════════════════════════════════╗"
  log_success "║       DESTRUCTION COMPLETE                 ║"
  log_success "╚════════════════════════════════════════════╝"
  echo ""

  if [[ ${#ITEMS_REMOVED[@]} -eq 0 ]]; then
    log_info "No items were removed"
    return 0
  fi

  log_info "Items removed:"
  for item in "${ITEMS_REMOVED[@]}"; do
    echo "  ✓ $item"
  done

  echo ""
  log_warn "To reinstall Witylogix, run: witylogix install"
  echo ""
}

# Show help
show_help() {
  cat << 'EOF'
Witylogix destroy — Clean teardown (DANGER!)

IMPORTANT: This command permanently removes containers and optionally data.
It REQUIRES explicit confirmation to proceed.

Usage: witylogix destroy [options]

Flags:
  --keep-data       Remove containers but keep volumes/data
  --volumes         Also remove Docker volumes (DATA LOSS!)
  --images          Also remove Docker images
  --all             Remove everything including install and config
  --force           Skip confirmation (for CI environments)
  -h, --help        Show this help message

Default behavior:
- Stops and removes all containers
- Keeps Docker volumes (data safe)
- Keeps Docker images
- Keeps install directory and config

Examples:
  witylogix destroy              # Stop and remove containers only
  witylogix destroy --volumes    # Also remove volumes
  witylogix destroy --all        # Remove everything
  witylogix destroy --keep-data  # Remove containers, keep data
  witylogix destroy --all --force # Remove everything (no confirmation)

WARNING:
- Using --volumes will DELETE ALL DATA in volumes
- Using --all will remove the entire installation
- These operations cannot be undone
- Make sure you have backups before proceeding
EOF
}

# Main execution
main() {
  # Check if docker is available
  if ! command -v docker &> /dev/null; then
    log_error "docker is not installed"
    exit 1
  fi

  # Show destruction plan
  show_destruction_plan

  # Confirm destruction
  if ! confirm_destruction; then
    exit 1
  fi

  echo ""
  log_warn "Starting destruction process..."
  echo ""

  # Execute destruction steps
  if ! stop_containers; then
    log_error "Failed to stop containers, aborting"
    exit 1
  fi

  if ! remove_volumes; then
    log_error "Failed to remove volumes"
    exit 1
  fi

  if ! remove_images; then
    log_error "Failed to remove images"
    exit 1
  fi

  if ! remove_install_dir; then
    log_error "Failed to remove install directory"
    exit 1
  fi

  if ! remove_config; then
    log_error "Failed to remove config directory"
    exit 1
  fi

  # Show summary
  show_summary

  exit 0
}

main
