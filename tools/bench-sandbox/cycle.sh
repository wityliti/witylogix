#!/usr/bin/env bash
# Witylogix Bench — sandbox cycle driver. Runs LOCALLY.
#
# Modes:
#   ./cycle.sh                # git mode (default): push, remote pulls + runs
#   ./cycle.sh --dirty        # tar mode: push uncommitted local tree
#   ./cycle.sh reset          # only tear down remote demo state
#   ./cycle.sh shell          # ssh into sandbox repo
#   ./cycle.sh logs <svc>     # tail service logs from current demo
set -euo pipefail

HOST="${BENCH_SANDBOX_HOST:-Hetzner_Server}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SANDBOX_DIR="/opt/bench-sandbox"
REMOTE_REPO="$SANDBOX_DIR/repo"
REMOTE_DIRTY="$SANDBOX_DIR/workspace-dirty"
TARBALL="/tmp/bench-packages.tgz"
REMOTE_TARBALL="/tmp/bench-packages.tgz"

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; NC=$'\033[0m'
log() { printf "${BOLD}[cycle]${NC} %s\n" "$1"; }
warn(){ printf "${YELLOW}[cycle]${NC} %s\n" "$1"; }
err() { printf "${RED}[cycle]${NC} %s\n" "$1" >&2; }

# ── Shared ────────────────────────────────────────────────────────────────

current_branch() { git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD; }
has_uncommitted() { ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; }
has_unpushed()    {
  local branch; branch="$(current_branch)"
  git -C "$REPO_ROOT" fetch -q origin "$branch" 2>/dev/null || true
  [ "$(git -C "$REPO_ROOT" rev-list --count "@{u}..HEAD" 2>/dev/null || echo 0)" != "0" ]
}

reset_remote() {
  log "reset demo state on $HOST"
  ssh "$HOST" 'bash -s' <<'REMOTE'
set -e
SANDBOX=/opt/bench-sandbox
if [ -d "$SANDBOX/demo/.bench" ] && [ -f "$SANDBOX/demo/.bench/compose.yaml" ]; then
  (cd "$SANDBOX/demo" && docker compose -f .bench/compose.yaml down -v --remove-orphans 2>/dev/null) || true
fi
docker ps -aq --filter "name=^demo-" | xargs -r docker rm -f >/dev/null 2>&1 || true
docker volume ls -q --filter "name=^demo_" | xargs -r docker volume rm -f >/dev/null 2>&1 || true
docker network ls --format '{{.Name}}' | grep -E '^demo_' | xargs -r docker network rm >/dev/null 2>&1 || true
rm -rf "$SANDBOX/demo"
rm -f /tmp/bench-packages.tgz
echo "reset: ok"
REMOTE
}

# ── Git mode: push, pull, run ─────────────────────────────────────────────

execute_git() {
  local branch; branch="$(current_branch)"

  if has_uncommitted; then
    warn "uncommitted changes present — they won't be tested. Use './cycle.sh --dirty' for WIP testing."
  fi

  if has_unpushed; then
    log "pushing unpushed commits on $branch"
    git -C "$REPO_ROOT" push origin "$branch"
  fi

  log "remote git pull + dogfood (branch: $branch)"
  ssh "$HOST" "bash -s '$branch'" <<'REMOTE'
set -euo pipefail
BRANCH="$1"
cd /opt/bench-sandbox/repo
git fetch --quiet --all --prune
git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH" "origin/$BRANCH"
git reset --quiet --hard "origin/$BRANCH"
echo "HEAD: $(git log -1 --oneline)"
export WORKSPACE_DIR=/opt/bench-sandbox/repo
bash ./tools/bench-sandbox/dogfood.sh
REMOTE
}

# ── Dirty mode: tar the working tree, push, run ───────────────────────────

execute_dirty() {
  log "pack working tree → $TARBALL (--dirty mode)"
  cd "$REPO_ROOT"
  tar --no-xattrs -czf "$TARBALL" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.turbo' \
    packages/bench-cli \
    packages/bench-core \
    packages/bench-provider-docker-compose \
    pnpm-workspace.yaml \
    pnpm-lock.yaml \
    package.json \
    tsconfig.json \
    tools/bench-sandbox

  log "upload tarball"
  scp -q "$TARBALL" "$HOST:$REMOTE_TARBALL"

  log "remote extract + dogfood"
  ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
DIRTY=/opt/bench-sandbox/workspace-dirty
mkdir -p "$DIRTY"
cd "$DIRTY"
find . -maxdepth 1 -mindepth 1 ! -name 'node_modules' ! -name '.pnpm-store' -exec rm -rf {} +
tar -xzf /tmp/bench-packages.tgz
echo "HEAD (dirty): (uncommitted working tree)"
export WORKSPACE_DIR="$DIRTY"
bash ./tools/bench-sandbox/dogfood.sh
REMOTE
}

# ── Dispatch ──────────────────────────────────────────────────────────────

MODE="${1:-}"
case "$MODE" in
  --dirty)
    reset_remote
    execute_dirty
    ;;
  reset)
    reset_remote
    ;;
  shell)
    exec ssh -t "$HOST" "cd $REMOTE_REPO && exec bash"
    ;;
  logs)
    shift
    [ -n "${1:-}" ] || { err "usage: cycle.sh logs <service>"; exit 1; }
    ssh -t "$HOST" "cd $SANDBOX_DIR/demo && docker compose -f .bench/compose.yaml logs -f $1"
    ;;
  ''|git|full)
    reset_remote
    execute_git
    ;;
  *)
    err "unknown command: $MODE"
    echo "usage: $0 [--dirty|reset|shell|logs <svc>]" >&2
    exit 1
    ;;
esac
