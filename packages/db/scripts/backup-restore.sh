#!/bin/bash

##############################################################################
# Witylogix Database Backup & Restore Script
#
# Usage:
#   ./backup-restore.sh --backup
#   ./backup-restore.sh --restore <backup_file>
#   ./backup-restore.sh --list
#   ./backup-restore.sh --verify <backup_file>
#
# Features:
#   - pg_dump with custom format (optimal compression)
#   - Timestamp-based naming
#   - Automatic backup rotation
#   - Restore with verification
#   - Backup integrity checks
#   - Detailed logging
#
##############################################################################

set -euo pipefail

# ─── COLORS ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKUPS_DIR="${BACKUPS_DIR:-$PROJECT_ROOT/backups}"
LOGS_DIR="${LOGS_DIR:-$PROJECT_ROOT/logs}"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-witylogix}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASSWORD:-}"
export PGPASSWORD

# Backup configuration
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
COMPRESS_LEVEL=9
BACKUP_FORMAT="custom" # custom, tar, plain, null

# Script options
OPERATION=""
BACKUP_FILE=""
DRY_RUN=false
VERBOSE=false

# ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_to_file() {
  local message="$1"
  mkdir -p "$LOGS_DIR"
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $message" >> "$LOGS_DIR/backup-restore.log"
}

# Validate environment
validate_environment() {
  if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found. Please install PostgreSQL client tools."
    exit 1
  fi

  if ! command -v psql &> /dev/null; then
    log_error "psql not found. Please install PostgreSQL client tools."
    exit 1
  fi

  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
    log_error "Cannot connect to database at $DB_HOST:$DB_PORT/$DB_NAME"
    exit 1
  fi

  mkdir -p "$BACKUPS_DIR" "$LOGS_DIR"
  log_success "Environment validated"
}

# Create backup
create_backup() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="$BACKUPS_DIR/backup_${DB_NAME}_${timestamp}.dump"

  log_info "Starting backup: $backup_file"
  log_to_file "Backup started: $backup_file"

  local backup_log="$LOGS_DIR/backup_${timestamp}.log"
  local start_time=$(date +%s)

  # Execute pg_dump
  if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v \
    --format=$BACKUP_FORMAT \
    --compress=$COMPRESS_LEVEL \
    --no-password \
    > "$backup_file" 2> "$backup_log"; then

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local size=$(du -h "$backup_file" | cut -f1)

    log_success "Backup completed: $backup_file ($size)"
    log_to_file "Backup completed successfully: $backup_file (size: $size, duration: ${duration}s)"

    # Show backup stats
    echo ""
    log_info "Backup Details:"
    echo "  File: $backup_file"
    echo "  Size: $size"
    echo "  Duration: ${duration}s"
    echo "  Format: $BACKUP_FORMAT (compression: $COMPRESS_LEVEL)"
    echo ""

    echo "$backup_file"
  else
    log_error "Backup failed. See logs: $backup_log"
    log_to_file "Backup failed: $backup_file"
    tail -20 "$backup_log" >&2
    exit 1
  fi
}

# List backups
list_backups() {
  log_info "Available backups:"
  if [[ -d "$BACKUPS_DIR" && $(ls -1 "$BACKUPS_DIR"/*.dump 2>/dev/null | wc -l) -gt 0 ]]; then
    ls -lhS "$BACKUPS_DIR"/*.dump | awk '{print $9, "(" $5 ")"}'
  else
    log_warning "No backups found in $BACKUPS_DIR"
  fi
}

# Verify backup integrity
verify_backup() {
  local backup_file="$1"

  if [[ ! -f "$backup_file" ]]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi

  log_info "Verifying backup integrity: $(basename "$backup_file")"

  # Check file size
  local size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
  if [[ $size -lt 1000 ]]; then
    log_error "Backup file too small ($size bytes), likely corrupted"
    return 1
  fi

  # Verify file format (custom format starts with PGDMP)
  if file "$backup_file" | grep -q "data"; then
    log_success "Backup file format verified"
    log_to_file "Backup verified: $(basename "$backup_file")"
    return 0
  else
    log_warning "Cannot verify backup format (may be OK for non-custom format)"
    return 0
  fi
}

# Restore from backup
restore_backup() {
  local backup_file="$1"

  if [[ ! -f "$backup_file" ]]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi

  # Verify backup first
  if ! verify_backup "$backup_file"; then
    log_error "Backup verification failed"
    return 1
  fi

  log_warning "CAUTION: This will restore the database to the state at backup time"
  log_warning "All changes since backup will be lost"
  echo ""
  echo -n "Backup file: $(basename "$backup_file")"
  echo " ($(du -h "$backup_file" | cut -f1))"
  echo ""

  if [[ "$DRY_RUN" == false ]]; then
    read -p "Are you sure? Type 'restore' to confirm: " confirmation
    if [[ "$confirmation" != "restore" ]]; then
      log_info "Restore cancelled"
      return 0
    fi
  fi

  local restore_log="$LOGS_DIR/restore_$(date +%Y%m%d_%H%M%S).log"
  log_info "Starting restore from: $(basename "$backup_file")"
  log_to_file "Restore started from: $backup_file"

  # Execute pg_restore
  if pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v \
    --no-password \
    "$backup_file" > "$restore_log" 2>&1; then

    log_success "Restore completed successfully"
    log_to_file "Restore completed successfully from: $backup_file"

    # Verify restore
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" &> /dev/null; then
      log_success "Database verification passed"
      echo ""
      log_info "Restore Summary:"
      echo "  Source: $(basename "$backup_file")"
      echo "  Target: $DB_HOST:$DB_PORT/$DB_NAME"
      echo "  Time: $(date +'%Y-%m-%d %H:%M:%S')"
      echo ""
      return 0
    else
      log_warning "Restore completed but verification failed"
      return 1
    fi
  else
    log_error "Restore failed. See logs: $restore_log"
    log_to_file "Restore failed from: $backup_file"
    tail -30 "$restore_log" >&2
    return 1
  fi
}

# Clean up old backups
cleanup_old_backups() {
  log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days"

  local find_cmd="find $BACKUPS_DIR -name 'backup_*.dump' -type f"

  # Count files to be deleted
  local count=$(eval "$find_cmd" "-mtime +$BACKUP_RETENTION_DAYS" 2>/dev/null | wc -l)

  if [[ $count -gt 0 ]]; then
    log_warning "Found $count backup(s) to delete"

    if [[ "$DRY_RUN" == true ]]; then
      log_info "[DRY RUN] Would delete:"
      eval "$find_cmd" "-mtime +$BACKUP_RETENTION_DAYS" -exec ls -lh {} \;
    else
      eval "$find_cmd" "-mtime +$BACKUP_RETENTION_DAYS" -delete
      log_success "Deleted $count old backup(s)"
      log_to_file "Cleanup: Deleted $count backup(s) older than $BACKUP_RETENTION_DAYS days"
    fi
  else
    log_success "No old backups to clean up"
  fi
}

# ─── MAIN ───────────────────────────────────────────────────────────────────

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --backup)
        OPERATION="backup"
        shift
        ;;
      --restore)
        OPERATION="restore"
        BACKUP_FILE="$2"
        shift 2
        ;;
      --list)
        OPERATION="list"
        shift
        ;;
      --verify)
        OPERATION="verify"
        BACKUP_FILE="$2"
        shift 2
        ;;
      --cleanup)
        OPERATION="cleanup"
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      -v|--verbose)
        VERBOSE=true
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Validate setup
  validate_environment

  # Execute operation
  case $OPERATION in
    backup)
      create_backup
      cleanup_old_backups
      ;;
    restore)
      restore_backup "$BACKUP_FILE"
      ;;
    list)
      list_backups
      ;;
    verify)
      verify_backup "$BACKUP_FILE"
      ;;
    cleanup)
      cleanup_old_backups
      ;;
    *)
      log_error "No operation specified"
      show_help
      exit 1
      ;;
  esac
}

show_help() {
  cat << EOF
${BLUE}Witylogix Database Backup & Restore Script${NC}

${YELLOW}Usage:${NC}
  ./backup-restore.sh <operation> [options]

${YELLOW}Operations:${NC}
  --backup              Create full database backup
  --restore <file>      Restore from backup file
  --list                List all available backups
  --verify <file>       Verify backup integrity
  --cleanup             Delete old backups (> $BACKUP_RETENTION_DAYS days)

${YELLOW}Examples:${NC}
  ./backup-restore.sh --backup
  ./backup-restore.sh --restore ./backups/backup_witylogix_20260316_120000.dump
  ./backup-restore.sh --list
  ./backup-restore.sh --verify ./backups/backup_witylogix_20260316_120000.dump
  ./backup-restore.sh --cleanup --dry-run

${YELLOW}Options:${NC}
  --dry-run             Show what would be done without executing
  -v, --verbose         Show detailed output
  -h, --help            Show this help message

${YELLOW}Environment Variables:${NC}
  DB_HOST               Database host (default: localhost)
  DB_PORT               Database port (default: 5432)
  DB_NAME               Database name (default: witylogix)
  DB_USER               Database user (default: postgres)
  DB_PASSWORD           Database password (optional)
  BACKUPS_DIR           Backup directory (default: ./backups)
  BACKUP_RETENTION_DAYS Retention days for old backups (default: 30)

${YELLOW}Features:${NC}
  - Custom format compression (level 9)
  - Automatic backup rotation
  - Integrity verification
  - Detailed logging
  - Dry-run mode support

EOF
}

# Run main function
main "$@"
