#!/usr/bin/env bash
# Witylogix Bench — sandbox cycle driver. Runs LOCALLY.
# Usage:
#   ./tools/bench-sandbox/cycle.sh            # reset + execute
#   ./tools/bench-sandbox/cycle.sh reset      # only tear down remote state
#   ./tools/bench-sandbox/cycle.sh execute    # only push + run (no reset)
#   ./tools/bench-sandbox/cycle.sh shell      # ssh into sandbox dir
#   ./tools/bench-sandbox/cycle.sh logs <svc> # tail service logs
set -euo pipefail

HOST="${BENCH_SANDBOX_HOST:-Hetzner_Server}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARBALL="/tmp/bench-packages.tgz"
REMOTE_TARBALL="/tmp/bench-packages.tgz"
DOGFOOD_SCRIPT="$REPO_ROOT/tools/bench-sandbox/dogfood.sh"

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; NC=$'\033[0m'

log() { printf "${BOLD}[cycle]${NC} %s\n" "$1"; }
err() { printf "${RED}[cycle]${NC} %s\n" "$1" >&2; }

reset() {
  log "reset remote sandbox state on $HOST"
  ssh "$HOST" 'bash -s' <<'REMOTE'
set -e
SANDBOX="/opt/bench-sandbox"
if [ -d "$SANDBOX/demo/.bench" ] && [ -f "$SANDBOX/demo/.bench/compose.yaml" ]; then
  (cd "$SANDBOX/demo" && docker compose -f .bench/compose.yaml down -v --remove-orphans 2>/dev/null) || true
fi
# Fallback cleanup for anything named demo-*
docker ps -aq --filter "name=^demo-" | xargs -r docker rm -f >/dev/null 2>&1 || true
docker volume ls -q --filter "name=^demo_" | xargs -r docker volume rm -f >/dev/null 2>&1 || true
docker network ls --format '{{.Name}}' | grep -E '^demo_' | xargs -r docker network rm >/dev/null 2>&1 || true
rm -rf "$SANDBOX/demo"
rm -f /tmp/bench-packages.tgz
echo "reset: ok"
REMOTE
}

pack() {
  log "pack bench packages → $TARBALL"
  cd "$REPO_ROOT"
  # --no-xattrs: strip macOS metadata that GNU tar on Linux warns about
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
    tsconfig.json
  printf "${DIM}  → %s bytes${NC}\n" "$(stat -f%z "$TARBALL" 2>/dev/null || stat -c%s "$TARBALL")"
}

push() {
  log "upload tarball to $HOST"
  scp -q "$TARBALL" "$HOST:$REMOTE_TARBALL"
}

execute() {
  pack
  push
  log "run dogfood.sh on $HOST"
  # Stream remote stdout live, preserve its exit code
  if ssh "$HOST" 'bash -s' < "$DOGFOOD_SCRIPT"; then
    log "${GREEN}cycle: PASS${NC}"
    return 0
  else
    rc=$?
    err "cycle: FAIL (exit $rc)"
    return $rc
  fi
}

case "${1:-full}" in
  reset)
    reset
    ;;
  execute)
    execute
    ;;
  shell)
    exec ssh -t "$HOST" 'cd /opt/bench-sandbox/demo 2>/dev/null || cd /opt/bench-sandbox; exec bash'
    ;;
  logs)
    shift
    [ -n "${1:-}" ] || { err "usage: cycle.sh logs <service>"; exit 1; }
    svc="$1"
    ssh -t "$HOST" "cd /opt/bench-sandbox/demo && docker compose -f .bench/compose.yaml logs -f $svc"
    ;;
  full|'')
    reset
    execute
    ;;
  *)
    err "unknown command: $1"
    echo "usage: $0 [reset|execute|shell|logs <svc>|full]" >&2
    exit 1
    ;;
esac
