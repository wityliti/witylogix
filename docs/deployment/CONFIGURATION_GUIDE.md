# Configuration & Secrets Management Guide

## Overview

The Witylogix platform provides a comprehensive, production-ready configuration and secrets management system organized into four main modules:

1. **env-validator.ts** — Zod-based environment variable validation
2. **config-service.ts** — Centralized configuration management
3. **secrets-manager.ts** — Multi-provider secrets storage
4. **feature-flags.ts** — Feature flag system with tenant/user overrides

## Quick Start

### 1. Set Up Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
# Edit .env with your local/staging/production values
```

### 2. Import Configuration

```typescript
// Use validated environment variables
import { env } from '@witylogix/core/config';

const PORT = env.PORT; // 8000 (number)
const dbUrl = env.DATABASE_URL; // postgresql://...
```

### 3. Access Nested Configuration

```typescript
import { getConfig } from '@witylogix/core/config';

const config = getConfig();

// Typed nested access
const poolSize = config.get('database.poolSize'); // number
const jwtSecret = config.get('jwt.secret'); // string
```

### 4. Enable/Disable Features

```typescript
import { isFeatureEnabled, FeatureFlag } from '@witylogix/core/config';

if (isFeatureEnabled(FeatureFlag.MFA_REQUIRED)) {
  // Enforce MFA for all users
}

if (isFeatureEnabled(FeatureFlag.WEBHOOK_V2, { tenantId: 'org-123' })) {
  // Use v2 webhook format for this tenant
}
```

### 5. Manage Secrets

```typescript
import { SecretsManager } from '@witylogix/core/config';

const secrets = new SecretsManager('environment');

// Get a secret (with caching)
const apiKey = await secrets.getSecret('STRIPE_SECRET_KEY');

// Rotate a secret (zero downtime)
await secrets.rotateSecret('JWT_SECRET', newSecretValue);
```

## Module Details

### env-validator.ts

Provides Zod-based validation with these features:

- **Type coercion**: Strings automatically converted to numbers where needed
- **Default values**: PORT defaults to 8000, LOG_LEVEL to 'info'
- **Environment-aware**: Different required fields per NODE_ENV
- **Redacted errors**: Error messages never leak secret values
- **Full type safety**: Exported `Env` type for TypeScript

**Schema includes:**
- Server: `PORT`, `NODE_ENV`, `LOG_LEVEL`
- Database: `DATABASE_URL`, `DATABASE_POOL_SIZE`, `DATABASE_READ_REPLICA_URL`
- Redis: `REDIS_URL`, `REDIS_PASSWORD`
- JWT: `JWT_SECRET` (min 32 chars), `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- Twilio: `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Sentry: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- Geo: `MAPBOX_TOKEN`, `GOOGLE_MAPS_KEY`
- Shopify: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- S3: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- URLs: `APP_URL`, `API_URL`, `DASHBOARD_URL`

### config-service.ts

Singleton configuration service providing:

- **Typed nested access**: `config.get('database.poolSize')`
- **Environment-aware defaults**: Different values per `NODE_ENV`
- **Feature flags**: Built-in `isFeatureEnabled(flag, context)`
- **Hot reload**: Watches `config.local.json` for local overrides
- **Debug snapshot**: `config.getSnapshot()` with secrets redacted
- **Percentage rollout**: Deterministic feature rollout by tenant/user

```typescript
const config = getConfig();

// Nested access
config.get('database.url');
config.get('jwt.secret');
config.get('smtp.host');

// Feature flags
config.isFeatureEnabled('MFA_REQUIRED');
config.setFeatureFlag('WEBHOOK_V2', true);

// Debug (secrets redacted)
console.log(config.getSnapshot());
```

### secrets-manager.ts

Multi-provider secrets management with:

- **Multiple backends**: Environment, file, Vault, AWS Secrets Manager
- **Caching with TTL**: Reduce provider calls, configurable TTL
- **Secret rotation**: Zero-downtime secret updates
- **Provider interface**: Implement `SecretsProvider` for custom backends

```typescript
// Use environment variables
const mgr = new SecretsManager('environment');

// Or file-based (.env.vault format)
const mgr = new SecretsManager('file', { filePath: '.env.vault' });

// Or HashiCorp Vault
const mgr = new SecretsManager('vault', {
  vaultUrl: 'https://vault.example.com',
  vaultToken: process.env.VAULT_TOKEN
});

// Or AWS Secrets Manager
const mgr = new SecretsManager('aws', { awsRegion: 'us-east-1' });

// Get secret (with caching)
const secret = await mgr.getSecret('STRIPE_SECRET_KEY');

// Rotate secret
await mgr.rotateSecret('JWT_SECRET', newValue);

// Invalidate cache
mgr.invalidateCache('JWT_SECRET');
```

### feature-flags.ts

Production-ready feature flagging:

```typescript
import {
  FeatureFlag,
  isFeatureEnabled,
  enableFeatureForTenant,
  getEnabledFlagsForTenant
} from '@witylogix/core/config';

// Simple check
if (isFeatureEnabled(FeatureFlag.MFA_REQUIRED)) {
  // ...
}

// Context-aware (tenant/user)
if (isFeatureEnabled(FeatureFlag.WEBHOOK_V2, { tenantId: 'org-123' })) {
  // Use v2 webhooks for this tenant
}

// Percentage rollout (deterministic)
if (isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
  tenantId: 'org-123',
  percentageRollout: 10  // Roll out to 10% of tenants
})) {
  // Use v2 for selected 10%
}

// Tenant overrides
enableFeatureForTenant(FeatureFlag.SSO_PROVIDERS, 'org-123');
const enabledFlags = getEnabledFlagsForTenant('org-123');

// Get all definitions (for admin UI)
const definitions = getAllFlagDefinitions();
```

**Available flags:**
- `ONBOARDING_AI_DEFAULTS` — AI-assisted onboarding
- `MFA_REQUIRED` — Enforce multi-factor auth
- `WEBHOOK_V2` — New webhook payload structure
- `API_VERSIONING` — Multi-version API support
- `REAL_TIME_TRACKING` — WebSocket tracking updates
- `ADVANCED_ANALYTICS` — Advanced reporting features
- `MULTI_CURRENCY` — Multi-currency support
- `SSO_PROVIDERS` — SAML/OAuth integrations

## Environment Configuration

### Development

```bash
NODE_ENV=development
DATABASE_URL="postgresql://user:pass@localhost:5432/witylogix"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-secret-32-chars-minimum" # or use `openssl rand -base64 32`
APP_URL="http://localhost:3000"
LOG_LEVEL="debug"
```

### Staging

```bash
NODE_ENV=staging
DATABASE_URL="postgresql://staging-user:pass@staging-db.example.com/witylogix"
REDIS_URL="redis://staging-redis.example.com:6379"
JWT_SECRET="<strong random secret from AWS Secrets Manager>"
APP_URL="https://staging.example.com"
LOG_LEVEL="info"
```

### Production

```bash
NODE_ENV=production
DATABASE_URL="postgresql://prod-user:pass@prod-db.example.com/witylogix"
REDIS_URL="redis://prod-redis.example.com:6379"
JWT_SECRET="<strong random secret from AWS Secrets Manager>"
APP_URL="https://app.example.com"
LOG_LEVEL="warn"
SENTRY_DSN="<Sentry project DSN>"
SENTRY_ENVIRONMENT="production"
# All external service keys...
```

## Deployment Checklist

Before deploying to production, verify:

```typescript
import { DeploymentChecker, formatDeploymentReport } from '@witylogix/core/config';

const checker = new DeploymentChecker();
const report = await checker.runAllChecks();

console.log(formatDeploymentReport(report));

if (!report.canDeploy) {
  process.exit(1);
}
```

This checks:
- ✓ Database connectivity
- ✓ Redis availability
- ✓ External service API keys
- ✓ Disk space availability
- ✓ SSL certificate validity
- ✓ DNS resolution

## Secrets Rotation

See [SECRETS_ROTATION.md](./SECRETS_ROTATION.md) for detailed procedures:

- JWT secret rotation (dual-key validation)
- Database password rotation
- API key rotation (Stripe, Twilio, etc.)
- Webhook secret rotation
- SSL certificate renewal

## Testing

Run tests for configuration modules:

```bash
npm test -- packages/core/src/config/__tests__/env-validator.test.ts
npm test -- packages/core/src/config/__tests__/feature-flags.test.ts
```

## Monitoring & Alerting

Set up alerts for configuration issues:

```typescript
// Alert on validation errors
process.on('uncaughtException', (error) => {
  if (error.name === 'EnvironmentValidationError') {
    sendAlert('Configuration validation failed', error.message);
    process.exit(1);
  }
});

// Alert on external service failures
const report = await checker.runAllChecks();
if (report.failed > 0) {
  sendAlert('Deployment checks failed', report.summary);
}
```

## Troubleshooting

### "JWT_SECRET must be at least 32 characters"

Generate a new secret:
```bash
openssl rand -base64 32
```

### "DATABASE_URL must be a valid URL"

Check your connection string format:
```
postgresql://user:password@host:5432/database?schema=public
```

### "Unknown provider type"

Only these are supported: `environment`, `file`, `vault`, `aws`

### Configuration not reloading

Ensure `config.local.json` exists and is valid JSON. File watcher watches this file.

## API Reference

See inline TypeScript documentation for complete API:

```bash
# Generate TypeScript types for IDE autocomplete
npm run generate-types
```

## Contributing

New configuration variables should:

1. Be added to env-validator.ts schema
2. Be documented in .env.example
3. Include clear descriptions and defaults
4. Have validation rules
5. Be included in tests

New feature flags should:

1. Be added to FeatureFlag enum
2. Include metadata in FEATURE_FLAG_DEFINITIONS
3. Have environment-specific defaults
4. Be tested for percentage rollout
5. Be documented in this guide
