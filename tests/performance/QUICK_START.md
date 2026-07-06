# Quick Start Guide - Performance Testing

## 5-Minute Setup

### 1. Install K6

```bash
# macOS
brew install k6

# Ubuntu/Linux
sudo apt-get install k6

# Or visit: https://k6.io/docs/getting-started/installation/
```

### 2. Verify Installation

```bash
k6 version
```

### 3. Run First Test

```bash
cd tests/performance
./scripts/run-perf-suite.sh --test-type auth
```

### 4. View Results

Open the HTML report in `results/report-*.html`

---

## Common Commands

### Run All Tests

```bash
./scripts/run-perf-suite.sh
```

### Run Specific Test

```bash
# Auth only
./scripts/run-perf-suite.sh --test-type auth

# Onboarding only
./scripts/run-perf-suite.sh --test-type onboarding

# CRUD only
./scripts/run-perf-suite.sh --test-type crud

# Webhooks only
./scripts/run-perf-suite.sh --test-type webhook

# Tenant isolation only
./scripts/run-perf-suite.sh --test-type tenant
```

### Against Staging

```bash
./scripts/run-perf-suite.sh \
  --environment staging \
  --api-url https://api-staging.example.com \
  --email test@staging.example.com \
  --password StagePassword123!
```

### Direct K6 Run

```bash
# Basic run
k6 run k6/auth-load.js

# With custom VUs and duration
k6 run --vus 100 --duration 5m k6/auth-load.js

# Export JSON results
k6 run -o json=results.json k6/auth-load.js

# With environment variables
k6 run -e API_BASE_URL=https://api.example.com k6/auth-load.js
```

---

## Test Scenarios at a Glance

| Test       | File                     | VUs | Duration | Focus                       |
| ---------- | ------------------------ | --- | -------- | --------------------------- |
| Auth       | auth-load.js             | 50  | 3m       | Login, tokens, registration |
| Onboarding | onboarding-load.js       | 20  | 3m       | 5-step wizard completion    |
| CRUD       | api-crud-load.js         | 50  | 3m       | Read/write operations       |
| Webhooks   | webhook-load.js          | 100 | 6m       | Event delivery & retries    |
| Tenant     | tenant-isolation-load.js | 50  | 4m       | Multi-tenant isolation      |

---

## Troubleshooting

### "k6: command not found"

Install k6: https://k6.io/docs/getting-started/installation/

### "Connection refused"

Verify API is running:

```bash
curl http://localhost:3000/api/v4/health
```

### "Unauthorized (401)"

Update test credentials:

```bash
export TEST_EMAIL=valid@example.com
export TEST_PASSWORD=YourPassword123!
./scripts/run-perf-suite.sh
```

### "Script errors"

Check K6 version:

```bash
k6 version
# Should be v0.45.0 or higher
```

---

## Key Files

- **Test scenarios**: `k6/*.js` (5 production-ready tests)
- **Helpers**: `k6/helpers/` (auth + data generators)
- **Config**: `config/` (thresholds, environments)
- **Scripts**: `scripts/` (test runner, report generator)
- **Docs**: `README.md` (comprehensive guide)

---

## Next Steps

1. Install K6
2. Set environment variables or use defaults
3. Run `./scripts/run-perf-suite.sh`
4. Review HTML report
5. Check thresholds in `config/thresholds.json`
6. Read full docs in `README.md`

---

## Help

```bash
# Show usage
./scripts/run-perf-suite.sh --help

# View file manifest
cat MANIFEST.md

# Read full documentation
cat README.md
```

---

**Status**: Ready to use
**Latest**: Sprint 6.2
**Maintainer**: QA Team
