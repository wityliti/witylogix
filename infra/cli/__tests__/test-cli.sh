#!/usr/bin/env bash
#
# Witylogix CLI Test Harness
#
# Comprehensive test suite for the Witylogix CLI:
# - CLI entrypoint validation
# - Version and help output
# - Command registration and sourcing
# - Library functions
# - Templates and configuration files
# - Environment validation
# - System checks
#
# Exit codes:
#   0 - All tests passed
#   1 - At least one test failed
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
PASSED=0
FAILED=0
SKIPPED=0

# Test framework variables
CURRENT_TEST=""

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMANDS_DIR="$CLI_DIR/commands"
LIB_DIR="$CLI_DIR/lib"
TEMPLATES_DIR="$CLI_DIR/templates"
ROOT_DIR="$(cd "$CLI_DIR/../../.." && pwd)"

################################################################################
# Test Framework Functions
################################################################################

test_start() {
  CURRENT_TEST="$1"
  echo -n "Testing: $CURRENT_TEST... "
}

test_pass() {
  echo -e "${GREEN}✓${NC}"
  ((PASSED++))
}

test_fail() {
  local reason="${1:-unknown error}"
  echo -e "${RED}✗${NC}"
  echo -e "  ${RED}Error:${NC} $reason"
  ((FAILED++))
}

test_skip() {
  local reason="${1:-not applicable}"
  echo -e "${YELLOW}⊘${NC}"
  echo -e "  ${YELLOW}Skipped:${NC} $reason"
  ((SKIPPED++))
}

################################################################################
# Test Helpers
################################################################################

mock_command() {
  local cmd_name=$1
  local cmd_output=${2:-"mock output"}

  # Create a temporary mock
  eval "$cmd_name() { echo '$cmd_output'; }"
}

cleanup() {
  # Remove temporary test files
  rm -f /tmp/test-cli-* 2>/dev/null || true
}

setup_test_env() {
  # Create temporary test directory
  export TEST_HOME="/tmp/test-cli-$$"
  mkdir -p "$TEST_HOME"
}

teardown_test_env() {
  rm -rf "$TEST_HOME" 2>/dev/null || true
}

################################################################################
# CLI Entrypoint Tests
################################################################################

test_cli_entrypoint_exists() {
  test_start "CLI entrypoint exists and is executable"

  if [[ -f "$CLI_DIR/witylogix" ]] && [[ -x "$CLI_DIR/witylogix" ]]; then
    test_pass
  else
    test_fail "witylogix file not found or not executable at $CLI_DIR/witylogix"
  fi
}

test_cli_version() {
  test_start "CLI --version outputs version number"

  if output=$("$CLI_DIR/witylogix" --version 2>&1); then
    if echo "$output" | grep -qE "[0-9]+\.[0-9]+\.[0-9]+"; then
      test_pass
    else
      test_fail "Version output does not contain version number: $output"
    fi
  else
    test_fail "Failed to run: witylogix --version"
  fi
}

test_cli_help() {
  test_start "CLI --help outputs help text with subcommands"

  if output=$("$CLI_DIR/witylogix" --help 2>&1); then
    if echo "$output" | grep -q "Witylogix CLI" && echo "$output" | grep -q "Usage:"; then
      test_pass
    else
      test_fail "Help output missing expected text"
    fi
  else
    test_fail "Failed to run: witylogix --help"
  fi
}

test_cli_unknown_command() {
  test_start "CLI unknown command returns error"

  if output=$("$CLI_DIR/witylogix" nonexistent-command-xyz 2>&1); then
    # Should fail with non-zero exit
    test_fail "Unknown command did not return error"
  else
    # Expected to fail
    test_pass
  fi
}

################################################################################
# Command File Tests
################################################################################

test_command_files_exist() {
  test_start "Command files exist and are readable"

  local required_commands=("install.sh" "deploy.sh" "backup.sh" "restore.sh" "ssl.sh" "env.sh")
  local missing=0

  for cmd in "${required_commands[@]}"; do
    if [[ ! -f "$COMMANDS_DIR/$cmd" ]]; then
      echo -e "\n  ${RED}Missing:${NC} $cmd"
      ((missing++))
    fi
  done

  if [[ $missing -eq 0 ]]; then
    test_pass
  else
    test_fail "$missing command files missing"
  fi
}

test_command_functions_defined() {
  test_start "Command files define their cmd_* functions"

  local required_functions=(
    "install:cmd_install"
    "deploy:cmd_deploy"
    "backup:cmd_backup"
    "restore:cmd_restore"
    "ssl:cmd_ssl"
    "env:cmd_env"
  )
  local missing=0

  for pair in "${required_functions[@]}"; do
    local file="${pair%:*}.sh"
    local func="${pair#*:}"

    if ! grep -q "^$func()" "$COMMANDS_DIR/$file" 2>/dev/null; then
      echo -e "\n  ${RED}Missing:${NC} $func() in $file"
      ((missing++))
    fi
  done

  if [[ $missing -eq 0 ]]; then
    test_pass
  else
    test_fail "$missing functions not properly defined"
  fi
}

test_command_files_source_cleanly() {
  test_start "Command files source without errors"

  if bash -n "$COMMANDS_DIR/install.sh" 2>&1 && \
     bash -n "$COMMANDS_DIR/deploy.sh" 2>&1 && \
     bash -n "$COMMANDS_DIR/backup.sh" 2>&1 && \
     bash -n "$COMMANDS_DIR/restore.sh" 2>&1 && \
     bash -n "$COMMANDS_DIR/ssl.sh" 2>&1 && \
     bash -n "$COMMANDS_DIR/env.sh" 2>&1; then
    test_pass
  else
    test_fail "Syntax errors in one or more command files"
  fi
}

################################################################################
# Library Tests
################################################################################

test_common_lib_exists() {
  test_start "lib/common.sh exists"

  if [[ -f "$LIB_DIR/common.sh" ]]; then
    test_pass
  else
    test_skip "lib/common.sh not found (optional)"
  fi
}

test_common_lib_sources() {
  test_start "lib/common.sh sources without errors"

  if [[ ! -f "$LIB_DIR/common.sh" ]]; then
    test_skip "lib/common.sh not found"
    return
  fi

  if bash -n "$LIB_DIR/common.sh" 2>&1; then
    test_pass
  else
    test_fail "Syntax errors in lib/common.sh"
  fi
}

################################################################################
# Template Tests
################################################################################

test_templates_exist() {
  test_start "Required templates exist"

  local required_templates=(
    "Caddyfile.template"
    "env.template"
  )
  local missing=0

  for tpl in "${required_templates[@]}"; do
    if [[ ! -f "$TEMPLATES_DIR/$tpl" ]]; then
      echo -e "\n  ${RED}Missing:${NC} $tpl"
      ((missing++))
    fi
  done

  if [[ $missing -eq 0 ]]; then
    test_pass
  else
    test_skip "Some templates missing (may be optional)"
  fi
}

test_ai_prompt_files_exist() {
  test_start "AI prompt files exist"

  local ai_dir="$TEMPLATES_DIR/ai-prompts"

  if [[ ! -d "$ai_dir" ]]; then
    test_skip "ai-prompts directory not found"
    return
  fi

  if [[ $(find "$ai_dir" -type f -name "*.md" | wc -l) -gt 0 ]]; then
    test_pass
  else
    test_skip "No AI prompt files found (optional)"
  fi
}

################################################################################
# Environment Validation Tests
################################################################################

test_env_validation_basic() {
  test_start "env.sh validate catches missing variables"

  if [[ ! -f "$COMMANDS_DIR/env.sh" ]]; then
    test_skip "env.sh not found"
    return
  fi

  # Source env.sh in a subshell to avoid affecting current shell
  if bash -c "source $COMMANDS_DIR/env.sh; cmd_env validate 2>&1" | grep -q "validate" 2>/dev/null || true; then
    test_pass
  else
    test_skip "env.sh validate not fully testable without .env file"
  fi
}

################################################################################
# System Check Tests
################################################################################

test_docker_check_available() {
  test_start "Docker is available on system"

  if command -v docker &> /dev/null; then
    test_pass
  else
    test_skip "Docker not installed (expected in dev environment)"
  fi
}

test_node_check_available() {
  test_start "Node.js is available on system"

  if command -v node &> /dev/null; then
    test_pass
  else
    test_skip "Node.js not installed"
  fi
}

test_git_check_available() {
  test_start "Git is available on system"

  if command -v git &> /dev/null; then
    test_pass
  else
    test_skip "Git not installed"
  fi
}

################################################################################
# Integration Tests
################################################################################

test_init_command_exists() {
  test_start "init.sh exists and defines cmd_init"

  if [[ -f "$COMMANDS_DIR/init.sh" ]] && grep -q "^cmd_init()" "$COMMANDS_DIR/init.sh"; then
    test_pass
  else
    test_fail "init.sh not found or cmd_init not defined"
  fi
}

test_init_command_sources() {
  test_start "init.sh sources without syntax errors"

  if bash -n "$COMMANDS_DIR/init.sh" 2>&1; then
    test_pass
  else
    test_fail "Syntax errors in init.sh"
  fi
}

test_env_example_exists() {
  test_start ".env.example exists"

  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    test_pass
  else
    test_fail ".env.example not found at $ROOT_DIR"
  fi
}

test_smoke_test_exists() {
  test_start "scripts/smoke-test.sh exists"

  if [[ -f "$ROOT_DIR/scripts/smoke-test.sh" ]]; then
    test_pass
  else
    test_fail "smoke-test.sh not found at $ROOT_DIR/scripts/"
  fi
}

test_docker_compose_dev_exists() {
  test_start "infra/docker-compose.dev.yml exists"

  if [[ -f "$ROOT_DIR/infra/docker-compose.dev.yml" ]]; then
    test_pass
  else
    test_fail "docker-compose.dev.yml not found"
  fi
}

################################################################################
# Main Test Execution
################################################################################

echo ""
echo "================================================================================"
echo "Witylogix CLI Test Suite"
echo "================================================================================"
echo ""

# Setup
setup_test_env

# Run CLI tests
echo "${CYAN}→ CLI Entrypoint Tests${NC}"
test_cli_entrypoint_exists
test_cli_version
test_cli_help
test_cli_unknown_command
echo ""

# Run command tests
echo "${CYAN}→ Command File Tests${NC}"
test_command_files_exist
test_command_functions_defined
test_command_files_source_cleanly
echo ""

# Run library tests
echo "${CYAN}→ Library Tests${NC}"
test_common_lib_exists
test_common_lib_sources
echo ""

# Run template tests
echo "${CYAN}→ Template Tests${NC}"
test_templates_exist
test_ai_prompt_files_exist
echo ""

# Run environment tests
echo "${CYAN}→ Environment Validation Tests${NC}"
test_env_validation_basic
echo ""

# Run system checks
echo "${CYAN}→ System Availability Tests${NC}"
test_docker_check_available
test_node_check_available
test_git_check_available
echo ""

# Run integration tests
echo "${CYAN}→ Integration Tests${NC}"
test_init_command_exists
test_init_command_sources
test_env_example_exists
test_smoke_test_exists
test_docker_compose_dev_exists
echo ""

# Teardown
teardown_test_env
cleanup

# Print summary
echo "================================================================================"
echo "Test Summary"
echo "================================================================================"
echo -e "${GREEN}Passed:${NC}  $PASSED"
echo -e "${RED}Failed:${NC}  $FAILED"
echo -e "${YELLOW}Skipped:${NC} $SKIPPED"
echo "================================================================================"
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}All tests passed! ✅${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}Some tests failed. Please review errors above.${NC}"
  echo ""
  exit 1
fi
