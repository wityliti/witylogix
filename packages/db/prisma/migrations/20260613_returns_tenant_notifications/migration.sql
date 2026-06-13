-- Migration: return_requests + tenant_notifications
-- WIT-344: Returns & Notifications production-readiness sprint

-- ─── ENUMS ────────────────────────────────────────────────────

CREATE TYPE "ReturnRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'INSPECTED',
  'REFUNDED'
);

CREATE TYPE "ReturnReason" AS ENUM (
  'DEFECTIVE',
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'OTHER'
);

CREATE TYPE "TenantNotificationCategory" AS ENUM (
  'ORDERS',
  'DELIVERIES',
  'DRIVERS',
  'PAYMENTS',
  'SYSTEM',
  'ALERTS'
);

CREATE TYPE "TenantNotificationChannel" AS ENUM (
  'EMAIL',
  'SMS',
  'PUSH',
  'WHATSAPP',
  'WEBHOOK',
  'SLACK'
);

CREATE TYPE "TenantNotificationStatus" AS ENUM (
  'UNREAD',
  'READ',
  'ARCHIVED',
  'DISMISSED'
);

-- ─── RETURN REQUESTS ──────────────────────────────────────────

CREATE TABLE "return_requests" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "shop_id"          UUID NOT NULL,
  "tenant_id"        UUID NOT NULL,
  "order_id"         UUID NOT NULL,
  "customer_id"      UUID,
  "status"           "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason"           "ReturnReason" NOT NULL,
  "reason_details"   TEXT,
  "notes"            TEXT,
  "items"            JSONB NOT NULL DEFAULT '[]',
  "refund_amount"    DECIMAL(10,2),
  "refund_status"    TEXT,
  "refunded_at"      TIMESTAMPTZ,
  "approved_at"      TIMESTAMPTZ,
  "rejected_at"      TIMESTAMPTZ,
  "rejection_reason" TEXT,
  "received_at"      TIMESTAMPTZ,
  "inspected_at"     TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_requests_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE,
  CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id")
);

CREATE INDEX "return_requests_shop_id_status_idx"      ON "return_requests"("shop_id", "status");
CREATE INDEX "return_requests_shop_id_created_at_idx"  ON "return_requests"("shop_id", "created_at" DESC);
CREATE INDEX "return_requests_order_id_idx"            ON "return_requests"("order_id");

-- RLS
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_return_requests" ON "return_requests"
  USING (shop_id = COALESCE(
    current_setting('app.current_shop_id', TRUE)::UUID,
    shop_id  -- fallback: system-level access
  ));

-- ─── TENANT NOTIFICATIONS ─────────────────────────────────────

CREATE TABLE "tenant_notifications" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "shop_id"    UUID NOT NULL,
  "title"      TEXT NOT NULL,
  "message"    TEXT NOT NULL,
  "category"   "TenantNotificationCategory" NOT NULL DEFAULT 'SYSTEM',
  "channel"    "TenantNotificationChannel"  NOT NULL DEFAULT 'PUSH',
  "status"     "TenantNotificationStatus"   NOT NULL DEFAULT 'UNREAD',
  "action_url" TEXT,
  "metadata"   JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "read_at"    TIMESTAMPTZ,

  CONSTRAINT "tenant_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_notifications_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE
);

CREATE INDEX "tenant_notifications_shop_id_status_idx"     ON "tenant_notifications"("shop_id", "status");
CREATE INDEX "tenant_notifications_shop_id_created_at_idx" ON "tenant_notifications"("shop_id", "created_at" DESC);

-- RLS
ALTER TABLE tenant_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_tenant_notifications" ON "tenant_notifications"
  USING (shop_id = COALESCE(
    current_setting('app.current_shop_id', TRUE)::UUID,
    shop_id
  ));
