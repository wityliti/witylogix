-- Witylogix Webhook Reliability & Idempotency Migration
-- Handles webhook delivery tracking, dead-letter queue, and request idempotency

-- ─── WEBHOOK DELIVERIES TABLE ───────────────────────────────────────────────
-- Tracks outbound webhook delivery attempts with retry logic
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING')),
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  completed_at TIMESTAMP,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_webhook_deliveries_webhook_id
    FOREIGN KEY (webhook_id)
    REFERENCES carrier_services(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry_at
  ON webhook_deliveries(next_retry_at)
  WHERE status IN ('PENDING', 'RETRYING');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);

-- ─── WEBHOOK DEAD LETTER QUEUE ──────────────────────────────────────────────
-- Stores failed webhook deliveries for manual review
CREATE TABLE IF NOT EXISTS webhook_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL UNIQUE,
  error TEXT NOT NULL,
  failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  retried_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_webhook_dead_letter_delivery_id
    FOREIGN KEY (delivery_id)
    REFERENCES webhook_deliveries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_delivery_id ON webhook_dead_letter(delivery_id);
CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_failed_at ON webhook_dead_letter(failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_retried_at
  ON webhook_dead_letter(retried_at)
  WHERE retried_at IS NULL;

-- ─── IDEMPOTENCY KEYS TABLE ─────────────────────────────────────────────────
-- Prevents duplicate webhook processing using idempotency keys
-- Clients include X-Idempotency-Key header to deduplicate requests
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- ─── FOREIGN KEY CONSTRAINTS ────────────────────────────────────────────────
-- Note: webhook_deliveries and webhook_dead_letter depend on carrier_services.
-- Ensure carrier_services table exists before applying this migration.

-- ─── RLS POLICIES ───────────────────────────────────────────────────────────

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_deliveries_select_all ON webhook_deliveries
  FOR SELECT
  USING (
    webhook_id IN (
      SELECT id FROM carrier_services
      WHERE shop_id = COALESCE(current_setting('app.current_shop_id', true)::uuid, shop_id)
    )
  );

CREATE POLICY webhook_deliveries_insert_all ON webhook_deliveries
  FOR INSERT
  WITH CHECK (
    webhook_id IN (
      SELECT id FROM carrier_services
      WHERE shop_id = COALESCE(current_setting('app.current_shop_id', true)::uuid, shop_id)
    )
  );

CREATE POLICY webhook_deliveries_update_all ON webhook_deliveries
  FOR UPDATE
  USING (
    webhook_id IN (
      SELECT id FROM carrier_services
      WHERE shop_id = COALESCE(current_setting('app.current_shop_id', true)::uuid, shop_id)
    )
  );

ALTER TABLE webhook_dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_dead_letter_select_all ON webhook_dead_letter
  FOR SELECT
  USING (
    delivery_id IN (
      SELECT id FROM webhook_deliveries
      WHERE webhook_id IN (
        SELECT id FROM carrier_services
        WHERE shop_id = COALESCE(current_setting('app.current_shop_id', true)::uuid, shop_id)
      )
    )
  );

CREATE POLICY webhook_dead_letter_insert_all ON webhook_dead_letter
  FOR INSERT
  WITH CHECK (
    delivery_id IN (
      SELECT id FROM webhook_deliveries
      WHERE webhook_id IN (
        SELECT id FROM carrier_services
        WHERE shop_id = COALESCE(current_setting('app.current_shop_id', true)::uuid, shop_id)
      )
    )
  );

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_keys_all ON idempotency_keys
  FOR ALL
  USING (true);

-- ─── CLEANUP PROCEDURES ────────────────────────────────────────────────────
-- Retention policies for webhook-related tables:
-- 1. Expired idempotency keys (>24 hours) should be purged regularly.
--    Example cron job: DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;
--
-- 2. Successfully delivered webhooks (>30 days) can be archived.
--    Example: DELETE FROM webhook_deliveries WHERE status = 'DELIVERED'
--             AND completed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
--
-- 3. Dead-letter entries (>90 days) should be archived for compliance.
--    Example: DELETE FROM webhook_dead_letter
--             WHERE failed_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
