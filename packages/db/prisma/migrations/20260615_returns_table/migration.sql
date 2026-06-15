-- ReturnRequest + ReturnRequestItem tables + RLS policies (WIT-354)

CREATE TABLE IF NOT EXISTS "return_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT,
    "customer_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "refund_amount" DECIMAL(10,2),
    "notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "received_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "return_request_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "return_request_id" UUID NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "return_request_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "return_requests_shop_id_idx" ON "return_requests"("shop_id");
CREATE INDEX IF NOT EXISTS "return_requests_order_id_idx" ON "return_requests"("order_id");
CREATE INDEX IF NOT EXISTS "return_requests_status_idx" ON "return_requests"("status");
CREATE INDEX IF NOT EXISTS "return_request_items_return_request_id_idx" ON "return_request_items"("return_request_id");

ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_return_request_id_fkey"
    FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON return_requests
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

ALTER TABLE return_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_request_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON return_request_items
    FOR ALL TO app_user
    USING (
        return_request_id IN (
            SELECT id FROM return_requests
            WHERE shop_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    )
    WITH CHECK (
        return_request_id IN (
            SELECT id FROM return_requests
            WHERE shop_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    );
