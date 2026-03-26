#!/bin/bash

# Smoke Test Runner Script
# Usage: ./tests/e2e/smoke/run-smoke-tests.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
TEST_FILE=""
DEBUG_MODE=false
HEADED_MODE=false
REPORT_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --debug)
      DEBUG_MODE=true
      shift
      ;;
    --headed)
      HEADED_MODE=true
      shift
      ;;
    --report)
      REPORT_ONLY=true
      shift
      ;;
    --critical)
      TEST_FILE="critical-path.spec.ts"
      shift
      ;;
    --auth)
      TEST_FILE="auth-flows.spec.ts"
      shift
      ;;
    --onboarding)
      TEST_FILE="onboarding-complete.spec.ts"
      shift
      ;;
    --health)
      TEST_FILE="integration-health.spec.ts"
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Show help text
show_help() {
  echo -e "${BLUE}Smoke Test Runner${NC}"
  echo ""
  echo "Usage: ./tests/e2e/smoke/run-smoke-tests.sh [options]"
  echo ""
  echo "Options:"
  echo "  --debug        Run in debug mode (interactive)"
  echo "  --headed       Run with visible browser window"
  echo "  --report       Only show report, don't run tests"
  echo "  --critical     Run critical path tests only"
  echo "  --auth         Run auth flow tests only"
  echo "  --onboarding   Run onboarding tests only"
  echo "  --health       Run health check tests only"
  echo "  --help         Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./tests/e2e/smoke/run-smoke-tests.sh                 # Run all smoke tests"
  echo "  ./tests/e2e/smoke/run-smoke-tests.sh --debug          # Debug mode"
  echo "  ./tests/e2e/smoke/run-smoke-tests.sh --critical       # Critical path only"
  echo "  ./tests/e2e/smoke/run-smoke-tests.sh --report         # Show report only"
}

# Print header
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║  Witylogix Smoke Test Suite                    ║"
echo "║  End-to-End Critical Path Testing              ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if only showing report
if [ "$REPORT_ONLY" = true ]; then
  echo -e "${GREEN}Generating test report...${NC}"
  if [ -f "tests/e2e/results/smoke/index.html" ]; then
    echo -e "${GREEN}✓ Opening HTML report...${NC}"
    if command -v open &> /dev/null; then
      open tests/e2e/results/smoke/index.html
    elif command -v xdg-open &> /dev/null; then
      xdg-open tests/e2e/results/smoke/index.html
    else
      echo -e "${YELLOW}Report location: tests/e2e/results/smoke/index.html${NC}"
    fi
  else
    echo -e "${RED}✗ No test report found. Run tests first.${NC}"
    exit 1
  fi
  exit 0
fi

# Build test command
TEST_CMD="npx playwright test --config=tests/e2e/smoke/playwright.smoke.config.ts"

if [ -n "$TEST_FILE" ]; then
  TEST_CMD="$TEST_CMD tests/e2e/smoke/$TEST_FILE"
fi

if [ "$DEBUG_MODE" = true ]; then
  TEST_CMD="$TEST_CMD --debug"
  echo -e "${YELLOW}Running in debug mode...${NC}"
fi

if [ "$HEADED_MODE" = true ]; then
  TEST_CMD="$TEST_CMD --headed"
  echo -e "${YELLOW}Running in headed mode (visible browser)...${NC}"
fi

echo ""
echo -e "${BLUE}Starting test run...${NC}"
echo ""

# Run the tests
if eval "$TEST_CMD"; then
  echo ""
  echo -e "${GREEN}"
  echo "╔════════════════════════════════════════════════╗"
  echo "║  ✓ Smoke Tests Completed Successfully         ║"
  echo "╚════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # Show report location
  if [ -f "tests/e2e/results/smoke/index.html" ]; then
    echo -e "${GREEN}Report: tests/e2e/results/smoke/index.html${NC}"
  fi
else
  echo ""
  echo -e "${RED}"
  echo "╔════════════════════════════════════════════════╗"
  echo "║  ✗ Smoke Tests Failed                         ║"
  echo "╚════════════════════════════════════════════════╝"
  echo -e "${NC}"

  if [ -f "tests/e2e/results/smoke/index.html" ]; then
    echo -e "${YELLOW}View report: tests/e2e/results/smoke/index.html${NC}"
  fi
  exit 1
fi
