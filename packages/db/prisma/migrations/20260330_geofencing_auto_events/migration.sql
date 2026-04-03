-- Add geofence_triggered_at to shipments for idempotency guard (WIT-140)
-- Tracks when a geofence auto-event was last emitted for a delivery.
-- NULL = not yet triggered. Non-null = already fired, prevents duplicates.

ALTER TABLE "shipments"
    ADD COLUMN IF NOT EXISTS "geofence_triggered_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "shipments_geofence_active_idx"
    ON "shipments" ("driver_id", "status")
    WHERE "geofence_triggered_at" IS NULL
      AND "driver_id" IS NOT NULL
      AND "status" IN ('IN_TRANSIT', 'OUT_FOR_DELIVERY');
