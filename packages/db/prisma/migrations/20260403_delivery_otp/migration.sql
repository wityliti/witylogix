-- WIT-92: OTP delivery confirmation for high-value and regulated parcels
-- Adds requireOTPConfirmation flag to orders, and creates delivery_otp and delivery_audit_log tables.

-- Add OTP confirmation flag to orders
ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "require_otp_confirmation" BOOLEAN NOT NULL DEFAULT FALSE;

-- CreateTable: delivery_otp
CREATE TABLE IF NOT EXISTS "delivery_otp" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "order_id"        UUID        NOT NULL,
    "code"            TEXT        NOT NULL,
    "channel"         TEXT        NOT NULL,
    "recipient_phone" TEXT        NOT NULL,
    "verified"        BOOLEAN     NOT NULL DEFAULT FALSE,
    "verified_at"     TIMESTAMPTZ,
    "expires_at"      TIMESTAMPTZ NOT NULL,
    "attempts"        INTEGER     NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "delivery_otp_pkey" PRIMARY KEY ("id")
);

-- FK: delivery_otp → orders
ALTER TABLE "delivery_otp"
    ADD CONSTRAINT "delivery_otp_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;

-- Index for order lookups
CREATE INDEX IF NOT EXISTS "delivery_otp_order_id_idx"
    ON "delivery_otp" ("order_id");

-- CreateTable: delivery_audit_log
CREATE TABLE IF NOT EXISTS "delivery_audit_log" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "order_id"   UUID        NOT NULL,
    "action"     TEXT        NOT NULL,
    "actor_id"   TEXT        NOT NULL,
    "actor_role" TEXT        NOT NULL,
    "metadata"   JSONB       NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "delivery_audit_log_pkey" PRIMARY KEY ("id")
);

-- FK: delivery_audit_log → orders
ALTER TABLE "delivery_audit_log"
    ADD CONSTRAINT "delivery_audit_log_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;

-- Index for order lookups
CREATE INDEX IF NOT EXISTS "delivery_audit_log_order_id_idx"
    ON "delivery_audit_log" ("order_id");
