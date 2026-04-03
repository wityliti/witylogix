-- WIT-141: Failed delivery workflow — retry, reason capture, auto-return

-- Add FAILED_ATTEMPT to ShipmentStatus enum
-- (non-terminal: delivery failed but retries remain)
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'FAILED_ATTEMPT';

-- Add retry tracking columns to shipments
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "attempt_count"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_failure_reason"  TEXT;

-- Add per-shop max retry configuration
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "max_delivery_attempts" INTEGER NOT NULL DEFAULT 3;

-- Create delivery_attempts table
CREATE TABLE IF NOT EXISTS "delivery_attempts" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "shipment_id"    UUID        NOT NULL,
  "shop_id"        UUID        NOT NULL,
  "attempt_number" INTEGER     NOT NULL,
  "failure_reason" TEXT        NOT NULL,
  "failed_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "photo_url"      TEXT,
  "driver_id"      UUID,
  "notes"          VARCHAR(500),

  CONSTRAINT "delivery_attempts_pkey"
    PRIMARY KEY ("id"),
  CONSTRAINT "delivery_attempts_shipment_id_attempt_number_key"
    UNIQUE ("shipment_id", "attempt_number"),
  CONSTRAINT "delivery_attempts_shipment_id_fkey"
    FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE,
  CONSTRAINT "delivery_attempts_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "delivery_attempts_shop_id_shipment_id_idx"
  ON "delivery_attempts"("shop_id", "shipment_id");

CREATE INDEX IF NOT EXISTS "delivery_attempts_shop_id_failure_reason_idx"
  ON "delivery_attempts"("shop_id", "failure_reason");
