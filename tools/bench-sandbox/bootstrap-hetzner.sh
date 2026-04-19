#!/usr/bin/env bash
# One-time bootstrap for the bench sandbox on Hetzner_Server.
# Runs LOCALLY. SSH-with-TTY so `gh auth login` can be interactive.
#
# Usage: ./tools/bench-sandbox/bootstrap-hetzner.sh
set -euo pipefail

HOST="${BENCH_SANDBOX_HOST:-Hetzner_Server}"
REPO="wityliti/witylogix"
BRANCH="feat/WIT-bench-scaffold"
SANDBOX_DIR="/opt/bench-sandbox"

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; NC=$'\033[0m'
log()  { printf "${BOLD}[bootstrap]${NC} %s\n" "$1"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
err()  { printf "${RED}✗${NC} %s\n" "$1" >&2; }

log "bootstrapping $HOST for Witylogix Bench sandbox"
log "repo: $REPO | branch: $BRANCH | dir: $SANDBOX_DIR"

# ── Install gh CLI if missing, then run interactive auth ────────────────────

ssh -t "$HOST" "bash -c '
set -e

# install gh CLI if missing
if ! command -v gh >/dev/null; then
  echo \"installing gh CLI...\"
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
  echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main\" \
    > /etc/apt/sources.list.d/github-cli.list
  apt update -qq && apt install -y gh >/dev/null
  echo \"gh installed\"
fi

# auth (idempotent — skips if already authed)
if gh auth status >/dev/null 2>&1; then
  echo \"gh already authenticated\"
else
  echo \"launching gh auth login — follow the device code flow in your browser\"
  gh auth login
fi

gh auth status
'"

log "gh auth complete"

# ── Clone / update the repo on remote ───────────────────────────────────────

ssh "$HOST" "bash -s" <<REMOTE
set -e
mkdir -p $SANDBOX_DIR
cd $SANDBOX_DIR

if [ -d repo/.git ]; then
  echo "repo already cloned — fetching"
  cd repo
  git fetch --all --prune
else
  echo "cloning $REPO → $SANDBOX_DIR/repo"
  gh repo clone $REPO repo
  cd repo
fi

# checkout target branch (remote tracking)
git checkout $BRANCH 2>/dev/null || git checkout -b $BRANCH origin/$BRANCH
git reset --hard origin/$BRANCH

echo
echo "HEAD:"
git log --oneline -5
REMOTE

ok "$SANDBOX_DIR/repo is ready on $HOST"
log "next: run ./tools/bench-sandbox/cycle.sh"
