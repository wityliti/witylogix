-- Witylogix Tenant Configuration & Usage Tracking Migration
-- Handles multi-tenant setup, resource limits, usage monitoring, and webhook secrets

-- ─── TENANT CONFIGS TABLE ───────────────────────────────────────────────────
-- Per-organization tenant configuration including subdomains and feature flags
CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,
  subdomain VARCHAR(255) UNIQUE NOT NULL,
  custom_domain VARCHAR(255) UNIQUE,
  features JSONB DEFAULT '{}',
  limits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_configs_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_configs_org_id ON tenant_configs(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_configs_subdomain ON tenant_configs(subdomain);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_configs_custom_domain
  ON tenant_configs(custom_domain) WHERE custom_domain IS NOT NULL;

-- ─── USAGE RECORDS TABLE ────────────────────────────────────────────────────
-- Raw API usage logs for billing, analytics, and troubleshooting
-- Note: Consider partitioning by time period for large-scale deployments
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  api_key_id UUID,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  request_size_bytes INTEGER DEFAULT 0,
  response_size_bytes INTEGER DEFAULT 0,
  ip_address INET NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usage_records_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_records_api_key_id
    FOREIGN KEY (api_key_id)
    REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Indexes optimized for common queries
CREATE INDEX IF NOT EXISTS idx_usage_records_org_id ON usage_records(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_api_key_id ON usage_records(api_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp ON usage_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_endpoint ON usage_records(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_records_status_code ON usage_records(status_code);
CREATE INDEX IF NOT EXISTS idx_usage_records_org_timestamp
  ON usage_records(org_id, timestamp DESC);

-- Partitioning hint for TimescaleDB (if enabled):
-- SELECT create_hypertable('usage_records', 'timestamp', if_not_exists => TRUE);

-- ─── USAGE SUMMARIES TABLE ──────────────────────────────────────────────────
-- Aggregated daily usage metrics
CREATE TABLE IF NOT EXISTS usage_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  period DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  unique_endpoints INTEGER DEFAULT 0,
  top_endpoints JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usage_summaries_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT unique_usage_summary_org_period
    UNIQUE (org_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_summaries_org_id ON usage_summaries(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_period ON usage_summaries(period DESC);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_org_period ON usage_summaries(org_id, period DESC);

-- ─── RATE LIMIT OVERRIDES TABLE ─────────────────────────────────────────────
-- Custom per-org or per-endpoint rate limits
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  endpoint VARCHAR(255),
  requests_per_minute INTEGER NOT NULL,
  requests_per_hour INTEGER NOT NULL,
  burst_limit INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rate_limit_overrides_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT unique_rate_limit_org_endpoint
    UNIQUE (org_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_org_id ON rate_limit_overrides(org_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_endpoint ON rate_limit_overrides(endpoint);

-- ─── WEBHOOK SECRETS TABLE ──────────────────────────────────────────────────
-- HMAC secrets for signing outbound webhooks
CREATE TABLE IF NOT EXISTS webhook_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  endpoint VARCHAR(512) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'HMAC_SHA256' CHECK (algorithm IN ('HMAC_SHA256', 'HMAC_SHA512')),
  is_active BOOLEAN DEFAULT true,
  rotated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_webhook_secrets_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT unique_webhook_secret_org_endpoint
    UNIQUE (org_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_webhook_secrets_org_id ON webhook_secrets(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_secrets_endpoint ON webhook_secrets(endpoint);

-- ─── RLS POLICIES ───────────────────────────────────────────────────────────

ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_configs_org_isolation ON tenant_configs
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_records_org_isolation ON usage_records
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE usage_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_summaries_org_isolation ON usage_summaries
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE rate_limit_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_limit_overrides_org_isolation ON rate_limit_overrides
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE webhook_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_secrets_org_isolation ON webhook_secrets
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

-- ─── RETENTION POLICIES ─────────────────────────────────────────────────────
-- Comment documenting retention strategy:
-- Usage records are typically archived after 90 days to manage table size.
-- Usage summaries are kept indefinitely for historical reporting.
-- Implement via scheduled jobs (pg_cron, etc.) to clean up old usage_records.
-- Example: DELETE FROM usage_records WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
