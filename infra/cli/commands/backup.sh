#!/usr/bin/env bash
#
# Witylogix Backup Command — Backup database, .env, and docker-compose overrides
#
# Full database backup with pg_dump in custom format, optional S3 upload,
# and automatic rotation of old backups
#
# Usage:
#   ./witylogix backup [options]
#
# Options:
#   --output=PATH      Save backup to custom path (default: $BACKUP_DIR)
#   --s3              Upload backup to S3 bucket
#   --keep=N          Keep N most recent backups (default: 7)
#   --no-env          Skip .env backup
#   --no-compose      Skip docker-compose override backup
#   -h, --help        Show this help
#
# Examples:
#   ./witylogix backup                      # Full backup to default location
#   ./witylogix backup --s3                 # Backup + upload to S3
#   ./witylogix backup --output=/tmp/backup # Custom output path
#   ./witylogix backup --keep=14            # Keep 14 backups instead of 7
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd "$INFRA_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[witylogix-backup]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[witylogix-backup]${NC} $1"; }
log_error() { echo -e "${RED}[witylogix-backup]${NC} $1"; }
log_cmd() { echo -e "${CYAN}  →${NC} $1"; }
log_debug() { echo -e "${BLUE}  ⊙${NC} $1"; }

# Configuration
WITYLOGIX_HOME="${WITYLOGIX_HOME:-/opt/witylogix}"
BACKUP_DIR="${BACKUP_DIR:-${WITYLOGIX_HOME}/backups}"
POSTGRES_CONTAINER="witylogix-postgres"
DOCKER_COMPOSE_FILE="${INFRA_DIR}/docker-compose.yml"
KEEP_BACKUPS=7
OUTPUT_PATH=""
UPLOAD_S3=false
BACKUP_ENV=true
BACKUP_COMPOSE=true

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --output=*)
      OUTPUT_PATH="${1#*=}"
      shift ;;
    --s3)
      UPLOAD_S3=true
      shift ;;
    --keep=*)
      KEEP_BACKUPS="${1#*=}"
      shift ;;
    --no-env)
      BACKUP_ENV=false
      shift ;;
    --no-compose)
      BACKUP_COMPOSE=false
      shift ;;
    -h|--help)
      grep "^#" "$0" | head -30
      exit 0 ;;
    *)
      log_error "Unknown option: $1"
      exit 1 ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# cmd_backup — Main backup function
# ─────────────────────────────────────────────────────────────────────────────
cmd_backup() {
  local backup_dir="$BACKUP_DIR"

  # Use custom output path if specified
  if [[ -n "$OUTPUT_PATH" ]]; then
    backup_dir="$(dirname "$OUTPUT_PATH")"
  fi

  # Create backup directory if it doesn't exist
  if ! mkdir -p "$backup_dir"; then
    log_error "Failed to create backup directory: $backup_dir"
    exit 1
  fi

  log_info "Starting backup..."
  log_debug "Backup directory: $backup_dir"

  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)

  local backup_filename
  if [[ -n "$OUTPUT_PATH" ]]; then
    backup_filename="$OUTPUT_PATH"
  else
    backup_filename="${backup_dir}/witylogix-backup-${timestamp}.dump"
  fi

  local backup_start_time
  backup_start_time=$(date +%s)

  # ─────────────────────────────────────────────────────────────────────────
  # Check if PostgreSQL container is running
  # ─────────────────────────────────────────────────────────────────────────
  if ! docker ps --filter "name=${POSTGRES_CONTAINER}" --format "{{.Names}}" | grep -q "${POSTGRES_CONTAINER}"; then
    log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running."
    echo ""
    echo "Start containers with:"
    echo "  cd $ROOT_DIR && docker compose -f $DOCKER_COMPOSE_FILE up -d"
    exit 1
  fi

  # Get PostgreSQL environment variables from container
  local pg_user
  local pg_password
  local pg_db

  pg_user=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo "witylogix")
  pg_password=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_PASSWORD 2>/dev/null || echo "witylogix_dev")
  pg_db=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_DB 2>/dev/null || echo "witylogix")

  # ─────────────────────────────────────────────────────────────────────────
  # Dump database with pg_dump
  # ─────────────────────────────────────────────────────────────────────────
  log_cmd "Running pg_dump (format=custom, compress=9)..."

  if ! PGPASSWORD="$pg_password" docker exec "$POSTGRES_CONTAINER" pg_dump \
    --username="$pg_user" \
    --format=custom \
    --compress=9 \
    --verbose \
    "$pg_db" > "$backup_filename" 2>/dev/null; then
    log_error "pg_dump failed"
    rm -f "$backup_filename"
    exit 1
  fi

  log_debug "Database dump completed: $backup_filename"

  # ─────────────────────────────────────────────────────────────────────────
  # Create a tar archive with backup metadata
  # ─────────────────────────────────────────────────────────────────────────
  local archive_filename="${backup_filename}.tar.gz"
  local temp_dir
  temp_dir=$(mktemp -d)
  trap "rm -rf $temp_dir" EXIT

  # Copy dump to temp directory
  cp "$backup_filename" "$temp_dir/database.dump"

  # Backup .env if requested
  if [[ "$BACKUP_ENV" = true ]]; then
    if [[ -f "$ROOT_DIR/.env" ]]; then
      cp "$ROOT_DIR/.env" "$temp_dir/.env" 2>/dev/null || log_warn ".env file not readable, skipping"
      log_debug ".env backed up"
    else
      log_debug ".env not found, skipping"
    fi
  fi

  # Backup docker-compose overrides if requested
  if [[ "$BACKUP_COMPOSE" = true ]]; then
    if [[ -f "$ROOT_DIR/docker-compose.override.yml" ]]; then
      cp "$ROOT_DIR/docker-compose.override.yml" "$temp_dir/docker-compose.override.yml" 2>/dev/null || log_warn "docker-compose.override.yml not readable, skipping"
      log_debug "docker-compose.override.yml backed up"
    fi
  fi

  # Create metadata file
  cat > "$temp_dir/backup.metadata" <<EOF
BACKUP_TIMESTAMP=$(date -Iseconds)
BACKUP_VERSION=1.0
WITYLOGIX_VERSION=\$(git -C "$ROOT_DIR" describe --tags 2>/dev/null || echo "unknown")
POSTGRES_USER=$pg_user
POSTGRES_DB=$pg_db
EOF

  log_debug "Creating archive: $archive_filename"

  # Create tar.gz archive
  if ! tar -czf "$archive_filename" -C "$temp_dir" . 2>/dev/null; then
    log_error "Failed to create backup archive"
    rm -f "$backup_filename" "$archive_filename"
    exit 1
  fi

  # Remove uncompressed dump
  rm -f "$backup_filename"
  backup_filename="$archive_filename"

  # ─────────────────────────────────────────────────────────────────────────
  # Calculate backup size and duration
  # ─────────────────────────────────────────────────────────────────────────
  local backup_end_time
  backup_end_time=$(date +%s)
  local duration=$((backup_end_time - backup_start_time))

  local backup_size
  backup_size=$(du -h "$backup_filename" | cut -f1)

  # ─────────────────────────────────────────────────────────────────────────
  # Upload to S3 if requested
  # ─────────────────────────────────────────────────────────────────────────
  if [[ "$UPLOAD_S3" = true ]]; then
    if ! command -v aws &> /dev/null; then
      log_error "AWS CLI is not installed. Install with: pip install awscli"
      exit 1
    fi

    log_cmd "Uploading to S3..."

    local s3_bucket="${AWS_S3_BUCKET:-witylogix-backups}"
    local s3_key="backups/$(basename "$backup_filename")"

    if aws s3 cp "$backup_filename" "s3://${s3_bucket}/${s3_key}" 2>/dev/null; then
      log_debug "S3 upload successful: s3://${s3_bucket}/${s3_key}"
    else
      log_error "S3 upload failed. Ensure AWS credentials are configured."
      log_warn "Backup file preserved locally: $backup_filename"
      exit 1
    fi
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Rotate old backups
  # ─────────────────────────────────────────────────────────────────────────
  log_cmd "Rotating backups (keeping $KEEP_BACKUPS most recent)..."

  local backup_count
  backup_count=$(find "$backup_dir" -maxdepth 1 -name "witylogix-backup-*.tar.gz" -type f | wc -l)

  if [[ $backup_count -gt $KEEP_BACKUPS ]]; then
    # Delete oldest backups
    find "$backup_dir" -maxdepth 1 -name "witylogix-backup-*.tar.gz" -type f \
      | sort -r \
      | tail -n +$((KEEP_BACKUPS + 1)) \
      | while read -r old_backup; do
      log_debug "Deleting old backup: $(basename "$old_backup")"
      rm -f "$old_backup"
    done
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Print summary
  # ─────────────────────────────────────────────────────────────────────────
  log_info "Backup completed successfully!"
  echo ""
  echo "Summary:"
  echo "  Backup file:  $(basename "$backup_filename")"
  echo "  Location:     $backup_filename"
  echo "  Size:         $backup_size"
  echo "  Duration:     ${duration}s"
  echo "  Timestamp:    $(date -Iseconds)"
  echo ""

  if [[ "$UPLOAD_S3" = true ]]; then
    echo "  S3 bucket:    $s3_bucket"
    echo "  S3 path:      $s3_key"
    echo ""
  fi

  echo "To restore this backup:"
  echo "  ./witylogix restore $backup_filename"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Run main backup function
# ─────────────────────────────────────────────────────────────────────────────
cmd_backup
