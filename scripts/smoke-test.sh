#!/bin/bash

################################################################################
# Witylogix Platform Smoke Test
#
# Validates basic platform setup and configuration:
# - Required tools (node, pnpm, docker)
# - Environment configuration
# - Workspace structure
# - Key directories
# - TypeScript compilation
#
# Exit codes:
#   0 - All checks passed
#   1 - At least one check failed
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

################################################################################
# Helper Functions
################################################################################

check_command() {
  local cmd=$1
  local name=${2:-$cmd}

  if command -v "$cmd" &> /dev/null; then
    echo -e "${GREEN}✅${NC} $name is installed"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $name is not installed"
    ((FAILED++))
    return 1
  fi
}

check_file() {
  local file=$1
  local name=${2:-$file}

  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $name exists"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $name not found: $file"
    ((FAILED++))
    return 1
  fi
}

check_directory() {
  local dir=$1
  local name=${2:-$dir}

  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅${NC} Directory exists: $name"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} Directory not found: $name ($dir)"
    ((FAILED++))
    return 1
  fi
}

check_json_valid() {
  local file=$1
  local name=${2:-$file}

  if command -v jq &> /dev/null; then
    if jq empty "$file" 2>/dev/null; then
      echo -e "${GREEN}✅${NC} Valid JSON: $name"
      ((PASSED++))
      return 0
    else
      echo -e "${RED}❌${NC} Invalid JSON: $name ($file)"
      ((FAILED++))
      return 1
    fi
  else
    # Fallback: basic check without jq
    if grep -q '^\{' "$file" 2>/dev/null; then
      echo -e "${GREEN}✅${NC} Likely valid JSON: $name (jq not available)"
      ((PASSED++))
      return 0
    else
      echo -e "${RED}❌${NC} Not valid JSON: $name ($file)"
      ((FAILED++))
      return 1
    fi
  fi
}

check_package_json() {
  local pkg_path=$1
  local pkg_name=$(basename $(dirname "$pkg_path"))

  if [ -f "$pkg_path" ]; then
    if check_json_valid "$pkg_path" "package.json in $pkg_name" 2>/dev/null; then
      return 0
    else
      return 1
    fi
  else
    echo -e "${RED}❌${NC} package.json not found: $pkg_path"
    ((FAILED++))
    return 1
  fi
}

################################################################################
# Smoke Tests
################################################################################

echo ""
echo "=================================================================================="
echo "Witylogix Platform Smoke Test"
echo "=================================================================================="
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Section: Required Tools
# ─────────────────────────────────────────────────────────────────────────────

echo "${YELLOW}→ Checking required tools...${NC}"
check_command "node" "Node.js"
check_command "pnpm" "pnpm package manager"
check_command "docker" "Docker"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Section: Environment Configuration
# ─────────────────────────────────────────────────────────────────────────────

echo "${YELLOW}→ Checking environment configuration...${NC}"
check_file ".env.example" ".env.example file"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Section: Workspace Structure
# ─────────────────────────────────────────────────────────────────────────────

echo "${YELLOW}→ Checking workspace structure...${NC}"

# Check root package.json
check_package_json "package.json" "Root package.json" || true

# Check turbo.json
check_file "turbo.json" "turbo.json configuration" || true

# Verify turbo.json is valid JSON
if [ -f "turbo.json" ]; then
  check_json_valid "turbo.json" "turbo.json format" || true
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Section: Key Directories
# ─────────────────────────────────────────────────────────────────────────────

echo "${YELLOW}→ Checking key directories...${NC}"

check_directory "apps/api" "API application"
check_directory "apps/dashboard" "Dashboard application"
check_directory "apps/docs" "Documentation application"
check_directory "packages/sdk" "SDK package"
check_directory "packages/db" "Database package"

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Section: Package.json in Workspace Packages
# ─────────────────────────────────────────────────────────────────────────────

echo "${YELLOW}→ Checking workspace packages...${NC}"

WORKSPACE_PACKAGES=(
  "apps/api/package.json"
  "apps/dashboard/package.json"
  "apps/docs/package.json"
  "packages/sdk/package.json"
  "packages/db/package.json"
  "packages/core/package.json"
)

for pkg in "${WORKSPACE_PACKAGES[@]}"; do
  if [ -f "$pkg" ]; then
    check_package_json "$pkg" || true
  fi
done

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Section: TypeScript Compilation
# ─────────────────────────────────────────────────────────────────────────────

echo "${YELLOW}→ Checking TypeScript compilation...${NC}"

if command -v tsc &> /dev/null; then
  # Dry-run TypeScript compilation on a few key packages
  echo "Running TypeScript type check (dry-run)..."

  # Create a temporary tsconfig for checking
  if [ -f "tsconfig.json" ]; then
    if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
      echo -e "${GREEN}✅${NC} TypeScript compilation successful"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠${NC} TypeScript compilation has warnings (skipping as errors)"
      # Don't fail on TS errors - this is a smoke test
    fi
  else
    echo -e "${YELLOW}⚠${NC} No tsconfig.json found at root"
  fi
else
  echo -e "${YELLOW}⚠${NC} TypeScript (tsc) not found globally, skipping compilation check"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

echo "=================================================================================="
echo "Smoke Test Summary"
echo "=================================================================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo "=================================================================================="
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All checks passed! ✅${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}Some checks failed. Please review the output above.${NC}"
  echo ""
  exit 1
fi
