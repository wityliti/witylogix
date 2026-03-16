#!/bin/bash

################################################################################
# Performance Test Suite Runner
#
# Executes all k6 load testing scenarios in sequence and generates reports.
#
# Usage:
#   ./run-perf-suite.sh [environment] [scenario]
#   ./run-perf-suite.sh staging all
#   ./run-perf-suite.sh dev auth-load
#
# Environments: dev, staging, production
# Scenarios: all, auth, onboarding, crud, webhook, tenant-isolation, smoke, ci
################################################################################

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
K6_TESTS_DIR="${PERF_DIR}/k6"
CONFIG_DIR="${PERF_DIR}/config"
RESULTS_DIR="${PERF_DIR}/results"

mkdir -p "${RESULTS_DIR}"

# Parameters
ENVIRONMENT="${1:-staging}"
SCENARIO="${2:-all}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="${RESULTS_DIR}/${TIMESTAMP}"

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Witylogix Performance Test Suite${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Environment:${NC} ${ENVIRONMENT}"
    echo -e "${BLUE}Scenario:${NC} ${SCENARIO}"
    echo -e "${BLUE}Results:${NC} ${REPORT_DIR}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

setup_environment() {
    case "$ENVIRONMENT" in
        dev)
            export API_BASE_URL="http://localhost:3000"
            ;;
        staging)
            export API_BASE_URL="https://staging-api.witylogix.com"
            ;;
        production)
            export API_BASE_URL="https://api.witylogix.com"
            ;;
        *)
            echo -e "${RED}Unknown environment: ${ENVIRONMENT}${NC}"
            exit 1
            ;;
    esac

    echo -e "${GREEN}✓ Environment: ${API_BASE_URL}${NC}"
}

run_test() {
    local test_name=$1
    local test_file=$2
    local output_file="${REPORT_DIR}/${test_name}-results.json"

    echo -e "${BLUE}Running: ${test_name}${NC}"

    if k6 run --out json="${output_file}" \
        -e API_BASE_URL="${API_BASE_URL}" \
        -e API_EMAIL="test@example.com" \
        -e API_PASSWORD="TestPassword123!" \
        "${test_file}"; then
        echo -e "${GREEN}✓ ${test_name}${NC}"
        return 0
    else
        echo -e "${RED}✗ ${test_name}${NC}"
        return 1
    fi
}

run_scenario() {
    local scenario=$1
    mkdir -p "${REPORT_DIR}"

    case "$scenario" in
        all)
            run_test "auth-load" "${K6_TESTS_DIR}/auth-load.js" || true
            sleep 2
            run_test "onboarding-load" "${K6_TESTS_DIR}/onboarding-load.js" || true
            sleep 2
            run_test "api-crud-load" "${K6_TESTS_DIR}/api-crud-load.js" || true
            sleep 2
            run_test "webhook-load" "${K6_TESTS_DIR}/webhook-load.js" || true
            sleep 2
            run_test "tenant-isolation-load" "${K6_TESTS_DIR}/tenant-isolation-load.js" || true
            ;;
        auth)
            run_test "auth-load" "${K6_TESTS_DIR}/auth-load.js"
            ;;
        onboarding)
            run_test "onboarding-load" "${K6_TESTS_DIR}/onboarding-load.js"
            ;;
        crud)
            run_test "api-crud-load" "${K6_TESTS_DIR}/api-crud-load.js"
            ;;
        webhook)
            run_test "webhook-load" "${K6_TESTS_DIR}/webhook-load.js"
            ;;
        tenant-isolation)
            run_test "tenant-isolation-load" "${K6_TESTS_DIR}/tenant-isolation-load.js"
            ;;
        smoke)
            K6_VUS=5 K6_DURATION=30s run_test "auth-load-smoke" "${K6_TESTS_DIR}/auth-load.js"
            ;;
        ci)
            K6_VUS=10 K6_DURATION=1m run_test "auth-load-ci" "${K6_TESTS_DIR}/auth-load.js"
            sleep 1
            K6_VUS=10 K6_DURATION=1m run_test "api-crud-load-ci" "${K6_TESTS_DIR}/api-crud-load.js"
            ;;
        *)
            echo -e "${RED}Unknown scenario: ${scenario}${NC}"
            exit 1
            ;;
    esac
}

print_summary() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Test Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ Tests completed${NC}"
    echo -e "${BLUE}Results: ${REPORT_DIR}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

main() {
    print_header
    setup_environment
    run_scenario "$SCENARIO"
    print_summary
}

main "$@"
