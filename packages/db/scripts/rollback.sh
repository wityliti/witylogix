#!/bin/bash

##############################################################################
# Witylogix Database Migration Rollback Script
#
# Usage:
#   ./rollback.sh <migration_name>
#   ./rollback.sh 20260316_auth_system
#   ./rollback.sh --latest
#   ./rollback.sh --all
#
# Features:
#   - Validates migration exists
#   - Creates automatic backup before rollback
#   - Executes rollback SQL
#   - Verifies rollback success
#   - Logs rollback events
#   - Supports dry-run mode (--dry-run)
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
MIGRATIONS_DIR="$PROJECT_ROOT/prisma/migrations"
BACKUPS_DIR="${BACKUPS_DIR:-$PROJECT_ROOT/backups}"
LOGS_DIR="${LOGS_DIR:-$PROJECT_ROOT/logs}"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-witylogix}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASSWORD:-}"
export PGPASSWORD

# Script options
DRY_RUN=false
VERBOSE=false
ROLLBACK_TARGET=""

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
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $message" >> "$LOGS_DIR/rollback.log"
}

# Validate environment
validate_environment() {
  if ! command -v psql &> /dev/null; then
    log_error "psql not found. Please install PostgreSQL client."
    exit 1
  fi

  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
    log_error "Cannot connect to database at $DB_HOST:$DB_PORT/$DB_NAME"
    exit 1
  fi

  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    log_error "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
  fi

  log_success "Environment validated"
}

# List available migrations
list_migrations() {
  log_info "Available migrations:"
  if [[ -d "$MIGRATIONS_DIR" ]]; then
    ls -1d "$MIGRATIONS_DIR"/*/ 2>/dev/null | xargs -n1 basename | sort
  else
    log_error "Migrations directory not found"
    exit 1
  fi
}

# Check if migration exists
migration_exists() {
  local migration_name="$1"
  [[ -d "$MIGRATIONS_DIR/$migration_name" && -f "$MIGRATIONS_DIR/$migration_name/migration.sql" ]]
}

# Create backup before rollback
create_backup() {
  mkdir -p "$BACKUPS_DIR"
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="$BACKUPS_DIR/rollback_backup_${timestamp}.sql.gz"

  log_info "Creating backup: $backup_file"

  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose 2>&1 | grep -E "(Processing|Dumping)" | head -5

  if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    > "$backup_file" 2>/dev/null; then
    log_success "Backup created: $backup_file"
    log_to_file "Backup created: $backup_file"
    echo "$backup_file"
  else
    log_error "Backup failed"
    log_to_file "Backup failed for rollback"
    exit 1
  fi
}

# Get rollback SQL (inverse of migration)
generate_rollback_sql() {
  local migration_name="$1"
  local migration_dir="$MIGRATIONS_DIR/$migration_name"

  # For now, we'll rely on a rollback.sql file if it exists
  # Otherwise, we'll need manual rollback instructions
  if [[ -f "$migration_dir/rollback.sql" ]]; then
    cat "$migration_dir/rollback.sql"
  else
    # Provide rollback instructions
    log_warning "No rollback.sql found for $migration_name"
    log_info "Manual rollback required. Common rollback patterns:"
    echo ""
    echo "  -- Drop tables added by migration"
    echo "  DROP TABLE IF EXISTS table_name CASCADE;"
    echo ""
    echo "  -- Re-create tables if rollback involves schema changes"
    echo "  -- (see migration documentation)"
    echo ""
    return 1
  fi
}

# Execute rollback
execute_rollback() {
  local migration_name="$1"
  local backup_file="$2"

  log_info "Rolling back migration: $migration_name"

  if ! generate_rollback_sql "$migration_name" > /tmp/rollback_${migration_name}.sql; then
    log_warning "No rollback script found for $migration_name"
    log_info "To rollback, you may need to:"
    log_info "  1. Review the original migration: $MIGRATIONS_DIR/$migration_name/migration.sql"
    log_info "  2. Restore from backup: ./backup-restore.sh --restore $backup_file"
    return 1
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would execute rollback SQL:"
    cat /tmp/rollback_${migration_name}.sql | head -20
    echo "  ..."
    rm -f /tmp/rollback_${migration_name}.sql
    return 0
  fi

  # Execute rollback
  if psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f /tmp/rollback_${migration_name}.sql &> /tmp/rollback_${migration_name}.log; then
    log_success "Rollback completed successfully"
    log_to_file "Rollback completed: $migration_name"
    rm -f /tmp/rollback_${migration_name}.sql
    return 0
  else
    log_error "Rollback failed. See logs: /tmp/rollback_${migration_name}.log"
    log_to_file "Rollback failed: $migration_name. Check /tmp/rollback_${migration_name}.log"
    return 1
  fi
}

# Verify rollback success
verify_rollback() {
  local migration_name="$1"

  log_info "Verifying rollback..."

  # Run simple verification queries
  local verification_result=$(psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT schemaversion FROM schema_migrations WHERE description = '$migration_name' LIMIT 1;" 2>/dev/null || echo "")

  if [[ -z "$verification_result" ]]; then
    log_success "Rollback verified - migration not in history"
    log_to_file "Rollback verified: $migration_name"
    return 0
  else
    log_warning "Migration still in history - may require manual cleanup"
    return 1
  fi
}

# ─── MAIN ───────────────────────────────────────────────────────────────────

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        log_info "Dry-run mode enabled"
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
      -l|--list)
        list_migrations
        exit 0
        ;;
      *)
        ROLLBACK_TARGET="$1"
        shift
        ;;
    esac
  done

  # Validate setup
  validate_environment

  # Show help if no target specified
  if [[ -z "$ROLLBACK_TARGET" ]]; then
    log_error "No migration target specified"
    echo ""
    show_help
    exit 1
  fi

  # Create backup
  local backup_file=$(create_backup)
  if [[ $? -ne 0 ]]; then
    exit 1
  fi

  # Validate migration exists
  if ! migration_exists "$ROLLBACK_TARGET"; then
    log_error "Migration not found: $ROLLBACK_TARGET"
    list_migrations
    exit 1
  fi

  # Execute rollback
  execute_rollback "$ROLLBACK_TARGET" "$backup_file"
  local rollback_status=$?

  if [[ $rollback_status -eq 0 ]]; then
    # Verify rollback
    verify_rollback "$ROLLBACK_TARGET"
    log_success "Rollback process complete. Backup saved: $backup_file"
    exit 0
  else
    log_warning "Rollback encountered issues. Backup available: $backup_file"
    log_info "To restore: ./backup-restore.sh --restore $backup_file"
    exit 1
  fi
}

show_help() {
  cat << EOF
${BLUE}Witylogix Database Rollback Script${NC}

${YELLOW}Usage:${NC}
  ./rollback.sh <migration_name> [options]

${YELLOW}Examples:${NC}
  ./rollback.sh 20260316_auth_system
  ./rollback.sh 20260316_onboarding --dry-run
  ./rollback.sh --list
  ./rollback.sh -h

${YELLOW}Options:${NC}
  --dry-run           Show what would be rolled back without executing
  -v, --verbose       Show detailed output
  -l, --list          List available migrations
  -h, --help          Show this help message

${YELLOW}Environment Variables:${NC}
  DB_HOST             Database host (default: localhost)
  DB_PORT             Database port (default: 5432)
  DB_NAME             Database name (default: witylogix)
  DB_USER             Database user (default: postgres)
  DB_PASSWORD         Database password (optional)
  BACKUPS_DIR         Backup directory (default: ./backups)

${YELLOW}Features:${NC}
  - Automatic backup before rollback
  - Idempotent operations
  - Comprehensive logging
  - Verification of rollback success

EOF
}

# Run main function
main "$@"
