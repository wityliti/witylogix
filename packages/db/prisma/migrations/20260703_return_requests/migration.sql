-- CreateTable: return_requests
-- Backs the Returns/RMA workflow (GET/POST /api/v4/returns/*)

CREATE TABLE "return_requests" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "shop_id"              UUID         NOT NULL,
    "order_id"             UUID         NOT NULL,
    "customer_id"          UUID,
    "customer_name"        TEXT,
    "customer_email"       TEXT,
    "status"               TEXT         NOT NULL DEFAULT 'pending',
    "reason"               TEXT         NOT NULL,
    "reason_details"       TEXT,
    "description"          TEXT,
    "items"                JSONB        NOT NULL DEFAULT '[]',
    "total_refund_amount"  DECIMAL(12,2),
    "refund_amount"        DECIMAL(12,2),
    "restocking_fee"       DECIMAL(12,2),
    "refund_status"        TEXT,
    "refund_date"          TIMESTAMPTZ,
    "shipping_label_url"   TEXT,
    "tracking_number"      TEXT,
    "pickup_date"          TIMESTAMPTZ,
    "approved_at"          TIMESTAMPTZ,
    "approved_by"          TEXT,
    "received_at"          TIMESTAMPTZ,
    "inspected_at"         TIMESTAMPTZ,
    "refunded_at"          TIMESTAMPTZ,
    "rejected_at"          TIMESTAMPTZ,
    "rejection_reason"     TEXT,
    "notes"                TEXT,
    "metadata"             JSONB        NOT NULL DEFAULT '{}',
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "return_requests"
    ADD CONSTRAINT "return_requests_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_requests"
    ADD CONSTRAINT "return_requests_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Optional customer FK (nullable)
ALTER TABLE "return_requests"
    ADD CONSTRAINT "return_requests_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "return_requests_shop_id_status_created_at_idx"
    ON "return_requests"("shop_id", "status", "created_at" DESC);

CREATE INDEX "return_requests_shop_id_order_id_idx"
    ON "return_requests"("shop_id", "order_id");

CREATE INDEX "return_requests_shop_id_customer_id_idx"
    ON "return_requests"("shop_id", "customer_id");

-- RLS: enable row-level security matching existing pattern
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_return_requests" ON return_requests
    USING (
        "shop_id" = current_setting('app.current_shop_id', TRUE)::uuid
        OR current_setting('app.current_org_id', TRUE) IS NOT NULL
    );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_return_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_return_requests_updated_at
    BEFORE UPDATE ON "return_requests"
    FOR EACH ROW EXECUTE FUNCTION update_return_requests_updated_at();
