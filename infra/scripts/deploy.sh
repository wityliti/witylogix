#!/bin/bash

###############################################################################
# Witylogix Platform Deployment Script
#
# Production-grade deployment with:
#   - Environment validation (staging/production)
#   - Pre-deployment checks (git clean, tests, Docker build)
#   - Database migrations
#   - Blue-green deployment
#   - Health check verification
#   - Automatic rollback on failure
#
# Usage:
#   ./infra/scripts/deploy.sh staging
#   ./infra/scripts/deploy.sh production
#
# Environment variables:
#   DOCKER_REGISTRY: Container registry URL (default: ghcr.io)
#   DOCKER_IMAGE: Image name (default: witylogix-platform)
#   DEPLOY_TIMEOUT: Deployment timeout in seconds (default: 600)
#   HEALTH_CHECK_RETRIES: Number of health check retries (default: 30)
#   HEALTH_CHECK_INTERVAL: Health check interval in seconds (default: 10)
###############################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
DOCKER_IMAGE="${DOCKER_IMAGE:-witylogix-platform}"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-600}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOYMENT_LOG="${PROJECT_ROOT}/.temp/deployment_${TIMESTAMP}.log"
BACKUP_DIR="${PROJECT_ROOT}/.temp/backups/${TIMESTAMP}"

# State tracking
DEPLOYMENT_FAILED=false
PREVIOUS_VERSION=""
DEPLOYMENT_VERSION=""

###############################################################################
# Utility Functions
###############################################################################

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "${DEPLOYMENT_LOG}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "${DEPLOYMENT_LOG}"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "${DEPLOYMENT_LOG}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "${DEPLOYMENT_LOG}"
}

cleanup() {
    if [ "${DEPLOYMENT_FAILED}" = true ]; then
        log_error "Deployment failed. Cleanup complete."
    else
        log_success "Deployment completed successfully."
    fi
}

trap cleanup EXIT

###############################################################################
# Pre-Deployment Checks
###############################################################################

check_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        log_error "Invalid environment: '$ENVIRONMENT'"
        log "Usage: $0 [staging|production]"
        exit 1
    fi
    log "Environment: ${ENVIRONMENT}"
}

check_git_clean() {
    log "Checking Git status..."

    if ! git -C "${PROJECT_ROOT}" diff --quiet; then
        log_warning "Working directory has uncommitted changes"
        return 1
    fi

    if ! git -C "${PROJECT_ROOT}" diff --cached --quiet; then
        log_warning "Staging area has changes"
        return 1
    fi

    log_success "Git working directory is clean"
}

check_dependencies() {
    log "Checking required dependencies..."

    local required_commands=("docker" "git" "pnpm" "node")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done

    log_success "All required dependencies are available"
}

check_tests_pass() {
    log "Running test suite..."

    if ! cd "${PROJECT_ROOT}" && pnpm test --run 2>&1 | tee -a "${DEPLOYMENT_LOG}"; then
        log_error "Tests failed. Aborting deployment."
        DEPLOYMENT_FAILED=true
        return 1
    fi

    log_success "All tests passed"
}

check_typecheck_pass() {
    log "Running TypeScript type checking..."

    if ! cd "${PROJECT_ROOT}" && pnpm typecheck 2>&1 | tee -a "${DEPLOYMENT_LOG}"; then
        log_error "Type checking failed. Aborting deployment."
        DEPLOYMENT_FAILED=true
        return 1
    fi

    log_success "Type checking passed"
}

check_lint_pass() {
    log "Running linter..."

    if ! cd "${PROJECT_ROOT}" && pnpm lint 2>&1 | tee -a "${DEPLOYMENT_LOG}"; then
        log_error "Linting failed. Aborting deployment."
        DEPLOYMENT_FAILED=true
        return 1
    fi

    log_success "Linting passed"
}

check_docker_build() {
    log "Building Docker image..."

    local build_tag="${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${TIMESTAMP}"
    DEPLOYMENT_VERSION="${build_tag}"

    if ! docker build \
        -t "${build_tag}" \
        -f "${PROJECT_ROOT}/Dockerfile" \
        "${PROJECT_ROOT}" 2>&1 | tee -a "${DEPLOYMENT_LOG}"; then
        log_error "Docker build failed. Aborting deployment."
        DEPLOYMENT_FAILED=true
        return 1
    fi

    log_success "Docker image built: ${build_tag}"
}

run_pre_deployment_checks() {
    log "Running pre-deployment checks..."

    check_environment
    check_dependencies
    check_git_clean || log_warning "Git checks failed, continuing..."
    check_lint_pass || return 1
    check_typecheck_pass || return 1
    check_tests_pass || return 1
    check_docker_build || return 1

    log_success "All pre-deployment checks passed"
}

###############################################################################
# Deployment Functions
###############################################################################

get_current_version() {
    log "Getting current deployment version..."

    # This is a placeholder - adapt to your deployment infrastructure
    PREVIOUS_VERSION=$(docker ps --filter "label=app=witylogix-${ENVIRONMENT}" --format "{{.Image}}" | head -n 1 || echo "none")

    if [ -z "${PREVIOUS_VERSION}" ] || [ "${PREVIOUS_VERSION}" = "none" ]; then
        log_warning "No previous version found"
        PREVIOUS_VERSION="none"
    else
        log "Previous version: ${PREVIOUS_VERSION}"
    fi
}

backup_previous_deployment() {
    log "Creating backup of previous deployment..."

    mkdir -p "${BACKUP_DIR}"

    # Backup database
    log "Backing up database..."
    if [ -n "${DATABASE_URL:-}" ]; then
        # Placeholder - adapt to your database
        pg_dump "${DATABASE_URL}" > "${BACKUP_DIR}/database_backup.sql" || log_warning "Database backup failed"
    else
        log_warning "DATABASE_URL not set, skipping database backup"
    fi

    # Backup configuration
    log "Backing up configuration..."
    cp -r "${PROJECT_ROOT}/.env" "${BACKUP_DIR}/.env" 2>/dev/null || log_warning "Configuration backup skipped"

    log_success "Backup created at: ${BACKUP_DIR}"
}

run_database_migrations() {
    log "Running database migrations..."

    if [ -z "${DATABASE_URL:-}" ]; then
        log_warning "DATABASE_URL not set, skipping migrations"
        return 0
    fi

    if ! cd "${PROJECT_ROOT}" && pnpm db:migrate 2>&1 | tee -a "${DEPLOYMENT_LOG}"; then
        log_error "Database migration failed"
        return 1
    fi

    log_success "Database migrations completed"
}

deploy_blue_green() {
    log "Deploying with blue-green strategy..."

    local build_tag="${DEPLOYMENT_VERSION}"
    local container_name="witylogix-${ENVIRONMENT}-green-${TIMESTAMP}"
    local service_port="3000"

    # Start green environment
    log "Starting green environment..."
    docker run \
        --name "${container_name}" \
        --detach \
        -p "${service_port}:3000" \
        -p "3001:3001" \
        --label "app=witylogix-${ENVIRONMENT}" \
        --label "version=${DEPLOYMENT_VERSION}" \
        --label "timestamp=${TIMESTAMP}" \
        -e "NODE_ENV=${ENVIRONMENT}" \
        "${build_tag}" || {
        log_error "Failed to start green environment"
        return 1
    }

    log "Green environment started: ${container_name}"

    # Wait for green to be ready
    log "Waiting for green environment to be ready..."
    sleep 5

    # Health check
    if ! perform_health_check "${service_port}"; then
        log_error "Green environment health check failed"
        docker stop "${container_name}" 2>/dev/null || true
        docker rm "${container_name}" 2>/dev/null || true
        return 1
    fi

    # Switch traffic to green
    log "Switching traffic to green environment..."
    # Placeholder - adapt to your infrastructure (load balancer, reverse proxy, etc.)

    # Stop blue environment
    log "Stopping blue environment..."
    docker ps --filter "label=app=witylogix-${ENVIRONMENT}" --filter "label!=version=${DEPLOYMENT_VERSION}" -q | \
        xargs -r docker stop || true
    docker ps --filter "label=app=witylogix-${ENVIRONMENT}" --filter "label!=version=${DEPLOYMENT_VERSION}" -q | \
        xargs -r docker rm || true

    log_success "Blue-green deployment completed"
}

perform_health_check() {
    local port="${1:-3000}"
    local url="http://localhost:${port}/health"
    local retries="${HEALTH_CHECK_RETRIES}"
    local interval="${HEALTH_CHECK_INTERVAL}"

    log "Performing health checks (${retries} retries, ${interval}s interval)..."

    for ((i = 1; i <= retries; i++)); do
        log "Health check attempt $i/${retries}..."

        if curl -sf "${url}" &>/dev/null; then
            log_success "Health check passed"
            return 0
        fi

        if [ $i -lt "${retries}" ]; then
            sleep "${interval}"
        fi
    done

    log_error "Health checks failed after ${retries} attempts"
    return 1
}

###############################################################################
# Rollback Functions
###############################################################################

rollback_deployment() {
    log_error "Starting rollback procedure..."

    if [ "${PREVIOUS_VERSION}" = "none" ]; then
        log_error "No previous version available for rollback"
        return 1
    fi

    log "Rolling back to version: ${PREVIOUS_VERSION}"

    # Stop current deployment
    docker ps --filter "label=app=witylogix-${ENVIRONMENT}" -q | xargs -r docker stop

    # Restore previous version
    log "Restoring previous version..."
    docker run \
        --detach \
        -p 3000:3000 \
        -p 3001:3001 \
        --label "app=witylogix-${ENVIRONMENT}" \
        -e "NODE_ENV=${ENVIRONMENT}" \
        "${PREVIOUS_VERSION}" || {
        log_error "Rollback failed - manual intervention required!"
        return 1
    }

    # Restore database from backup
    log "Restoring database from backup..."
    if [ -f "${BACKUP_DIR}/database_backup.sql" ]; then
        psql "${DATABASE_URL}" < "${BACKUP_DIR}/database_backup.sql" || \
            log_warning "Database restore failed - manual intervention may be required"
    fi

    log_success "Rollback completed - previous version restored"
}

###############################################################################
# Main Deployment Flow
###############################################################################

main() {
    # Create log directory
    mkdir -p "$(dirname "${DEPLOYMENT_LOG}")"

    log "=== Witylogix Platform Deployment ==="
    log "Environment: ${ENVIRONMENT}"
    log "Project Root: ${PROJECT_ROOT}"
    log "Log File: ${DEPLOYMENT_LOG}"

    # Run checks
    if ! run_pre_deployment_checks; then
        DEPLOYMENT_FAILED=true
        exit 1
    fi

    # Get current state
    get_current_version

    # Create backups
    backup_previous_deployment || log_warning "Backup failed, continuing..."

    # Run migrations
    if ! run_database_migrations; then
        DEPLOYMENT_FAILED=true
        rollback_deployment
        exit 1
    fi

    # Deploy
    if ! deploy_blue_green; then
        DEPLOYMENT_FAILED=true
        rollback_deployment
        exit 1
    fi

    log_success "=== Deployment Complete ==="
    log "Deployed version: ${DEPLOYMENT_VERSION}"
    log "Environment: ${ENVIRONMENT}"
}

main "$@"
