# ADR-022: CLI Deployment & Management Tool

**Date:** 2026-03-10
**Status:** Accepted
**Author:** Aarav (CTO)
**Reviewers:** Platform Engineering Team

## Title

CLI Deployment & Management Tool for One-Line VM Deployment

## Context

Witylogix platform currently requires multi-step manual deployment to production VMs. DevOps teams and customers need:

1. **One-line deployment** to any Ubuntu 20.04+, Debian, or Amazon Linux instance
2. **Lifecycle management** (deploy, upgrade, rollback, status, logs, backup/restore)
3. **Zero external dependencies** — no reliance on SaaS platforms (unlike current Railway workflow)
4. **Cross-environment support** — development, staging, production
5. **SSL/TLS automation** via Caddy reverse proxy
6. **Configuration persistence** — remember user settings across sessions
7. **Self-healing capabilities** — health checks, auto-restart, dependency validation

Current Railway-based deployment (infra/deploy-scripts/railway.sh) is cloud-locked and requires Railway CLI installation. We need a universal CLI tool that works on any VM infrastructure.

## Problem Statement

**Current Pain Points:**

- Railway deployment requires external service account and Railway CLI
- No local control over infrastructure lifecycle
- Cannot deploy to customer VMs, private datacenters, or air-gapped environments
- Limited visibility into running services (logs, health, resource usage)
- Manual SSL certificate renewal
- Difficult to scale horizontally (multiple API instances)
- No integrated backup/restore workflow

**Target Use Cases:**

1. DevOps: `witylogix install --domain api.example.com --env production`
2. One-Click Customer Deployment: provide single installer script
3. Multi-Environment: dev, staging, prod configurations
4. Horizontal Scaling: launch multiple API instances on different ports
5. Disaster Recovery: backup data, restore to new VM

## Decision

We will build a **pure Bash CLI tool** (`infra/cli/witylogix`) with modular subcommand architecture for universal VM deployment and lifecycle management.

### Rationale

**Why Bash over Go/Node:**

- **Zero runtime dependencies**: Every Linux distro includes bash; Go/Node add deployment complexity
- **Simplicity for DevOps**: bash is native skill for ops teams
- **Small footprint**: Single executable vs runtime overhead
- **Rapid iteration**: no compilation step
- **Docker/curl only external deps**: both ubiquitous in container environments

**Trade-off**: bash is less type-safe than Go and harder to test; mitigated by:

- Heavy use of shellcheck for static analysis
- Comprehensive validation functions
- Modular command structure for testability
- Clear naming conventions (`cmd_`, `require_`, `log_`)

## Architecture

### Directory Structure

```
infra/cli/
├── witylogix              # Main entrypoint (350 lines)
├── lib/
│   └── common.sh          # Shared utilities (150 lines)
├── commands/
│   ├── install.sh         # Initial VM setup & Docker
│   ├── deploy.sh          # Deploy/redeploy services
│   ├── upgrade.sh         # Upgrade to new version
│   ├── status.sh          # Health check & service status
│   ├── logs.sh            # Stream/fetch service logs
│   ├── backup.sh          # Backup database & configs
│   ├── restore.sh         # Restore from backup
│   ├── ssl.sh             # SSL certificate management
│   ├── env.sh             # Environment variable management
│   ├── doctor.sh          # Diagnostic & troubleshooting
│   ├── dev.sh             # Development mode (hot reload)
│   ├── init.sh            # Initialize config on new machine
│   ├── scale.sh           # Horizontal scaling (multi-node)
│   ├── destroy.sh         # Teardown all services
│   └── ai.sh              # AI-assisted setup & diagnosis
├── templates/
│   ├── Caddyfile          # Reverse proxy configuration
│   ├── docker-compose.yml # Service orchestration template
│   ├── .env.template      # Environment variables template
│   ├── health-check.sh    # Health check script
│   └── prompt.txt         # AI prompt for diagnosis
└── README.md              # CLI documentation
```

### Main Entrypoint: `infra/cli/witylogix`

**Responsibilities:**

1. Parse global flags (`--yes`, `--verbose`, `--quiet`, `--version`, `--help`)
2. Detect WITYLOGIX_HOME directory (default: `~/.witylogix`)
3. Source configuration file if exists
4. Load shared library (`infra/cli/lib/common.sh`)
5. Route subcommand to `infra/cli/commands/$COMMAND.sh`
6. Handle global error cases with meaningful messages

**Key Functions:**

```bash
banner()              # Print ASCII logo + version
load_config()         # Load ~/.witylogix/config
parse_options()       # Parse --yes, --verbose, etc.
route_command()       # Source and call cmd_$COMMAND
show_help()           # Print help with all subcommands
trap_error()          # Global error handler
```

**Exit Codes:**

- 0: Success
- 1: General error
- 2: Usage error (wrong arguments)
- 127: Command not found

### Shared Library: `infra/cli/lib/common.sh`

**Validation Functions:**

```bash
require_root()         # Check root or sudo access
require_docker()       # Check Docker installed & running
require_command(cmd)   # Check if command exists
```

**Service Management:**

```bash
wait_for_healthy(container, timeout)  # Poll until healthy
get_container_logs(container, lines)  # Fetch recent logs
container_exists(name)                # Check if running
```

**User Interaction:**

```bash
confirm(prompt, default)  # Interactive yes/no (respects --yes)
spinner(pid)              # Animated spinner for long operations
```

**Output Formatting:**

```bash
table_header()            # Print table header row
table_row(cols...)        # Print aligned table row
progress(current, total)  # Progress bar
```

**Configuration:**

```bash
get_config(key)           # Read config value
set_config(key, value)    # Write config value
```

**System Detection:**

```bash
detect_os()               # Returns: ubuntu / debian / amzn / centos
detect_arch()             # Returns: amd64 / arm64 / arm
```

### Port Assignments (Fixed)

| Service       | Port | Purpose                      |
| ------------- | ---- | ---------------------------- |
| API Server    | 3001 | RESTful API (Caddy upstream) |
| Dashboard     | 3002 | Web UI (Caddy upstream)      |
| Documentation | 3003 | API docs (Caddy upstream)    |
| PostgreSQL    | 5432 | Primary database             |
| Redis         | 6379 | Cache & session store        |
| Caddy HTTP    | 80   | HTTP reverse proxy           |
| Caddy HTTPS   | 443  | HTTPS reverse proxy          |

### Config File Format: `~/.witylogix/config`

```bash
# Shell-sourced key=value file
INSTALL_DIR="/opt/witylogix"
DOMAIN="api.example.com"
ENVIRONMENT="production"
API_PORT=3001
DASHBOARD_PORT=3002
DOCS_PORT=3003
DB_HOST="localhost"
DB_PORT=5432
REDIS_HOST="localhost"
REDIS_PORT=6379
BACKUP_RETENTION_DAYS=30
AUTO_UPGRADE="true"
LOG_LEVEL="info"
```

### Subcommand Reference

#### 1. `witylogix install [OPTIONS]`

**Purpose:** One-time VM setup, install Docker, pull images

**Options:**

- `--domain DOMAIN` — Set primary domain
- `--env PROD|STAGE|DEV` — Set environment
- `--install-dir PATH` — Custom install directory (default: /opt/witylogix)
- `--skip-docker` — Assume Docker already installed
- `--yes` — Non-interactive mode

**Behavior:**

- Check OS (Ubuntu 20.04+, Debian 10+, Amazon Linux 2)
- Install Docker & Docker Compose if missing
- Create install directory
- Pull latest service images
- Save config to ~/.witylogix/config
- Run doctor to verify installation

#### 2. `witylogix deploy [OPTIONS]`

**Purpose:** Start/restart services with current config

**Options:**

- `--build` — Rebuild Docker images from source
- `--force` — Kill existing containers first
- `--yes` — Skip confirmation prompts

**Behavior:**

- Validate config exists
- Check Docker running
- Stop existing containers (if --force)
- Run docker-compose up -d
- Wait for services healthy
- Show access URLs
- Save deployment timestamp

#### 3. `witylogix upgrade [OPTIONS]`

**Purpose:** Upgrade to newer Witylogix version

**Options:**

- `--to VERSION` — Specific version (default: latest)
- `--dryrun` — Show what would be upgraded

**Behavior:**

- Fetch latest version from releases
- Backup current state (if --backup)
- Download new images
- Run database migrations
- Restart services
- Verify health
- Show changelog

#### 4. `witylogix status [--json]`

**Purpose:** Show health of all services

**Output (human):**

```
Witylogix Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service     │ Status   │ Port  │ CPU   │ Memory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API         │ ✓ Running│ 3001  │ 2.1%  │ 256 MB
Dashboard   │ ✓ Running│ 3002  │ 1.8%  │ 198 MB
Postgres    │ ✓ Running│ 5432  │ 1.3%  │ 512 MB
Redis       │ ✓ Running│ 6379  │ 0.8%  │ 128 MB
Caddy       │ ✓ Running│ 443   │ 0.2%  │ 32 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
System: Ubuntu 20.04 (x86_64) | Uptime: 45d 3h | Load: 0.45
```

**Output (JSON):**

```json
{
  "system": { "uptime": "45d 3h", "load": 0.45 },
  "services": [
    {
      "name": "API",
      "status": "running",
      "port": 3001,
      "cpu": 2.1,
      "memory_mb": 256
    }
  ]
}
```

#### 5. `witylogix logs [SERVICE] [OPTIONS]`

**Purpose:** Stream or fetch service logs

**Options:**

- `--lines N` — Show last N lines (default: 100)
- `--follow` — Stream in real-time (default for terminal)
- `--since DURATION` — Show logs since (e.g., 1h, 30m)
- `--level LEVEL` — Filter by level (debug, info, warn, error)

**Services:** api, dashboard, postgres, redis, caddy, all

#### 6. `witylogix backup [OPTIONS]`

**Purpose:** Backup database, configs, and user data

**Options:**

- `--name LABEL` — Custom backup name
- `--destination PATH` — Save backup to path (default: ~/.witylogix/backups)
- `--compress` — gzip compression (default: true)

**Output:** `backup-2026-03-10T14:30:45Z.tar.gz`

#### 7. `witylogix restore BACKUP_FILE [OPTIONS]`

**Purpose:** Restore from backup

**Options:**

- `--force` — Overwrite existing database

**Behavior:**

- Validate backup integrity
- Stop services
- Restore database
- Restore configs
- Restart services
- Verify restored state

#### 8. `witylogix ssl [SUBCOMMAND]`

**Purpose:** SSL/TLS certificate management via Caddy

**Subcommands:**

- `ssl status` — Show current certificate and expiry
- `ssl renew` — Force certificate renewal
- `ssl set-domain DOMAIN` — Update Caddy domain config

**Behavior:**

- Uses Caddy's automatic ACME (Let's Encrypt) integration
- Handles certificate renewal automatically
- Falls back to self-signed if ACME fails

#### 9. `witylogix env [SUBCOMMAND]`

**Purpose:** Manage environment variables

**Subcommands:**

- `env list` — Show all variables
- `env get KEY` — Get single variable
- `env set KEY VALUE` — Set variable (persists to ~/.witylogix/config)
- `env unset KEY` — Remove variable
- `env export` — Export as shell-sourceable file

#### 10. `witylogix doctor [--verbose]`

**Purpose:** Diagnostic tool for troubleshooting

**Checks:**

- OS compatibility
- Docker installation & version
- Disk space available
- Network connectivity
- Port availability (80, 443, 3001-3003, 5432, 6379)
- Service health
- Certificate validity
- Recent errors in logs
- Config file integrity

**Output Example:**

```
Witylogix Doctor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ OS: Ubuntu 20.04 LTS (amd64)
✓ Docker: 24.0.6
✓ Disk space: 156 GB available
✓ Network: Connected
✓ Port 80: Available
✓ Port 443: Available
✓ Port 3001: In use (API)
⚠ Certificate: Expires in 15 days
✗ Redis: Connection timeout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fix: witylogix logs redis
```

#### 11. `witylogix dev [OPTIONS]`

**Purpose:** Development mode with hot reload

**Options:**

- `--service SERVICE` — Watch specific service
- `--watch-dir PATH` — Watch custom directory

**Behavior:**

- Mount source code as volume
- Enable debug logging
- Rebuild on file change
- Fast restart (no image pull)
- Open browser to dashboard

#### 12. `witylogix init [OPTIONS]`

**Purpose:** Initialize configuration on new machine

**Options:**

- `--interactive` — Step-by-step wizard
- `--config-file PATH` — Load config from file

**Behavior:**

- Prompt for domain, environment, install dir
- Validate inputs
- Save to ~/.witylogix/config
- Create necessary directories

#### 13. `witylogix scale [OPTIONS]`

**Purpose:** Horizontal scaling — multiple API instances

**Options:**

- `--api-replicas N` — Number of API instances (default: 1)
- `--dashboard-replicas N` — Number of dashboard instances

**Behavior:**

- Update docker-compose.yml with service replicas
- Reconfigure Caddy load balancing
- Restart services
- Verify all healthy

#### 14. `witylogix destroy [OPTIONS]`

**Purpose:** Complete teardown of all services

**Options:**

- `--keep-data` — Preserve database & backups
- `--force` — Skip confirmation

**Behavior:**

- Confirm action (unless --force)
- Stop all containers
- Remove volumes (unless --keep-data)
- Remove config (ask user)

#### 15. `witylogix ai setup [OPTIONS]`

**Purpose:** AI-assisted initial setup

**Behavior:**

- Ask natural language questions about deployment
- Guide through installation with AI
- Generate optimized config

#### 16. `witylogix ai diagnose [OPTIONS]`

**Purpose:** AI-powered troubleshooting

**Behavior:**

- Collect system state, logs, error messages
- Send to Claude API (optional, requires API key)
- Suggest fixes based on symptoms

### Design Principles

1. **Zero External Dependencies** — Only bash + Docker + curl
   - No package manager dependencies
   - No runtime (Go, Node, Python)
   - Works on any Linux distro

2. **Idempotent Operations** — Safe to run multiple times
   - Check state before taking action
   - `install` doesn't fail if Docker exists
   - `deploy` handles existing containers gracefully

3. **Colored Output** — Consistent, scannable logs
   - `[witylogix]` prefix on all logs
   - Color coding: green (success), yellow (warn), red (error), cyan (cmd)
   - BOLD for headers, DIM for secondary info

4. **Respects --yes Flag** — CI/CD friendly
   - All confirmations check `--yes` mode
   - Skip human interaction in scripts
   - Emit valid exit codes

5. **Fail Fast with Clear Errors** — Not silent failure
   - Check preconditions upfront
   - Give actionable error messages
   - Suggest next steps

6. **Configuration Persistence** — Remember user choices
   - One `install` per machine
   - Config file drives all operations
   - Easy to edit manually if needed

7. **Progress Visibility** — Show what's happening
   - Spinners for long operations
   - Progress bars for file operations
   - Timestamped logs for debugging

### ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User: witylogix install --domain api.example.com           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  infra/cli/witylogix  │  Main entrypoint
         │  - Parse args         │  - Route commands
         │  - Load config        │  - Global error handling
         │  - Source lib/common  │  - Version/help
         └───────┬───────────────┘
                 │
    ┌────────────┴─────────────────────────┐
    │ Global Flags: --yes, --verbose, etc. │
    └─────────────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────┐
    │  Source: lib/common.sh       │  Shared library
    │  - require_docker()          │  - Utilities
    │  - wait_for_healthy()        │  - Logging
    │  - get_config()              │  - System detection
    │  - confirm()                 │
    └──────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────┐
    │  Route to: commands/*.sh     │  Modular commands
    │  - cmd_install()             │  (each in own file)
    │  - cmd_deploy()              │
    │  - cmd_upgrade()             │
    │  - cmd_status()              │
    │  - ... 12 more               │
    └──────────┬───────────────────┘
               │
    ┌──────────┴──────────────────────────────┐
    │ Docker / System Operations              │
    │ - docker-compose up/down                │
    │ - Health checks                         │
    │ - Config validation                     │
    └─────────────────────────────────────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │  Running Services           │
    │  - API (port 3001)          │
    │  - Dashboard (port 3002)    │
    │  - Postgres (port 5432)     │
    │  - Redis (port 6379)        │
    │  - Caddy proxy (80/443)     │
    └─────────────────────────────┘
```

### Data Flow: `witylogix deploy`

```
User Input
  ▼
Parse Arguments (--build, --force, --yes)
  ▼
Load Config from ~/.witylogix/config
  ▼
require_root() → Check sudo access
  ▼
require_docker() → Check Docker running
  ▼
[Optional] docker-compose build (if --build)
  ▼
docker-compose down (if --force)
  ▼
docker-compose up -d
  ▼
Loop: wait_for_healthy(api, 60s)
  ▼
print_access_urls()
  ▼
Save deployment timestamp
  ▼
Return exit code 0
```

## Trade-offs and Alternatives

### 1. Bash vs Go vs Node

| Criterion          | Bash            | Go                   | Node             |
| ------------------ | --------------- | -------------------- | ---------------- |
| Runtime deps       | None (built-in) | None (single binary) | Node.js required |
| Type safety        | None            | Excellent            | Medium           |
| Learning curve     | Low             | Medium               | Low              |
| Dev speed          | Fast            | Medium               | Fast             |
| Container friendly | Excellent       | Good                 | Good             |
| Package size       | Minimal         | ~10 MB               | ~200 MB          |
| Testability        | Hard            | Easy                 | Easy             |
| Cross-platform     | Linux-focused   | Excellent            | Excellent        |

**Decision:** Bash for simplicity and zero runtime. Go if we need type safety + distribution later.

### 2. Caddy vs Nginx vs Traefik

| Feature                | Caddy               | Nginx                | Traefik         |
| ---------------------- | ------------------- | -------------------- | --------------- |
| Automatic HTTPS        | ✓ Built-in          | Manual/plugin        | ✓ Native        |
| Docker integration     | ✓ Good              | Requires templating  | ✓ Native labels |
| Zero-config            | ✓ Yes               | No                   | Partial         |
| Learning curve         | Low                 | Medium               | Medium          |
| Container-light        | ~80 MB              | ~130 MB              | ~100 MB         |
| Configuration language | Caddyfile (simple)  | nginx.conf (complex) | TOML/YAML       |
| Use case               | Single host, simple | High performance     | Orchestration   |

**Decision:** Caddy for this single-host deployment scenario.

### 3. Configuration Persistence

**Alternatives Considered:**

- JSON file: Too verbose, harder to edit manually
- TOML: Requires parser, overkill
- YAML: Requires parser, indentation-prone
- Shell sourced: Simple, native bash, easily edited

**Decision:** Shell sourced key=value file (easy parsing, human-editable).

### 4. Error Handling Strategy

**Alternatives:**

- Silent failure with exit codes only: Poor UX
- Exception-style with traceback: Verbose, noisy
- Structured logging with levels: Good but complex

**Decision:** Colored, human-readable errors with `log_error()` + actionable suggestions.

## Implementation Timeline

### Phase 1 (Sprint 4.3): MVP

- ADR-022 (this document)
- `infra/cli/witylogix` main entrypoint
- `infra/cli/lib/common.sh` shared library
- `commands/install.sh` and `commands/deploy.sh`
- Basic tests with shellcheck

### Phase 2 (Sprint 4.4):

- Remaining core commands (status, logs, upgrade, ssl)
- Docker Compose templates
- Integration tests

### Phase 3 (Sprint 4.5):

- Advanced commands (backup, restore, scale)
- AI-assisted commands (ai setup, ai diagnose)
- Production hardening

### Phase 4 (Future):

- Cloud provider integrations (AWS EC2, DigitalOcean, Hetzner)
- Distributed deployment (multi-node)
- Web UI for CLI commands

## Risks and Mitigation

| Risk                                 | Likelihood | Impact | Mitigation                                           |
| ------------------------------------ | ---------- | ------ | ---------------------------------------------------- |
| Bash portability                     | Medium     | High   | Test on Ubuntu, Debian, Amazon Linux; use shellcheck |
| Docker dependency                    | Low        | Medium | Clear install instructions; check in `install`       |
| Config corruption                    | Low        | Medium | Atomic writes; backup before modify                  |
| Race conditions (concurrent deploys) | Medium     | High   | Lock file (`~/.witylogix/.deploy.lock`)              |
| Silent failures                      | Medium     | High   | Explicit error logging; fail fast                    |
| Scaling complexity                   | Medium     | Medium | Start with manual scaling; add auto-scale later      |

## Future Enhancements

1. **Plugin System** — Load custom commands from `~/.witylogix/plugins/`
2. **Distributed Deployment** — Manage multiple nodes (clustering, load balancing)
3. **Web Dashboard** — Browser-based UI for CLI commands
4. **Cloud Provider Integration** — Provision VMs on AWS, Azure, DigitalOcean
5. **GitOps Integration** — Deploy from Git repositories
6. **Metrics Export** — Prometheus integration
7. **Automated Backups** — S3/backup service integration
8. **Multi-region** — Coordinate deployments across regions

## Checklist for Implementation

- [ ] Create `infra/cli/witylogix` (350 lines)
- [ ] Create `infra/cli/lib/common.sh` (150 lines)
- [ ] Create `infra/cli/commands/install.sh`
- [ ] Create `infra/cli/commands/deploy.sh`
- [ ] Create `infra/cli/commands/status.sh`
- [ ] Create `infra/cli/commands/logs.sh`
- [ ] Create `infra/cli/commands/doctor.sh`
- [ ] Create `infra/cli/templates/Caddyfile`
- [ ] Create `infra/cli/templates/docker-compose.yml`
- [ ] Run shellcheck on all scripts
- [ ] Write integration tests
- [ ] Update main README.md with CLI usage
- [ ] Document each subcommand with examples
- [ ] Create installation guide for end users

## Approval Sign-off

- **CTO (Aarav):** Approved
- **Date:** 2026-03-10
- **Version:** 1.0
