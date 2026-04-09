-- CreateTable: delivery_events
-- Stores driver-submitted delivery lifecycle events for offline sync (WIT-127).
-- id is client-generated (UUID) and serves as the idempotency key.

CREATE TABLE IF NOT EXISTS "delivery_events" (
    "id"                  TEXT        NOT NULL,
    "shop_id"             UUID        NOT NULL,
    "shipment_id"         UUID        NOT NULL,
    "event_type"          TEXT        NOT NULL,
    "payload"             JSONB       NOT NULL DEFAULT '{}',
    "device_captured_at"  TIMESTAMPTZ NOT NULL,
    "device_timezone"     TEXT        NOT NULL,
    "server_received_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "gps_lat"             DOUBLE PRECISION,
    "gps_lng"             DOUBLE PRECISION,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- FK to shipments (cascade on shipment delete)
ALTER TABLE "delivery_events"
    ADD CONSTRAINT "delivery_events_shipment_id_fkey"
    FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE;

-- FK to shops
ALTER TABLE "delivery_events"
    ADD CONSTRAINT "delivery_events_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "delivery_events_shop_shipment_idx"
    ON "delivery_events" ("shop_id", "shipment_id", "device_captured_at" DESC);

CREATE INDEX IF NOT EXISTS "delivery_events_shipment_type_idx"
    ON "delivery_events" ("shipment_id", "event_type");
