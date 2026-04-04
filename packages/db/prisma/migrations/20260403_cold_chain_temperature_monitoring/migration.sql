-- Cold-chain temperature monitoring — WIT-91
-- Adds: temperature_logs, cold_chain_thresholds, cold_chain_alerts
-- Alters: shipments (is_cold_chain flag)

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE "TempUnit" AS ENUM ('CELSIUS', 'FAHRENHEIT');
CREATE TYPE "AlertSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- ─── cold_chain_thresholds ───────────────────────────────────
CREATE TABLE "cold_chain_thresholds" (
    "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
    "shop_id"               UUID        NOT NULL,
    "name"                  TEXT        NOT NULL,
    "shipment_type"         TEXT,
    "min_temp"              DECIMAL(6,2) NOT NULL,
    "max_temp"              DECIMAL(6,2) NOT NULL,
    "unit"                  "TempUnit"  NOT NULL DEFAULT 'CELSIUS',
    "grace_period_minutes"  INTEGER     NOT NULL DEFAULT 2,
    "alert_contacts"        JSONB       NOT NULL DEFAULT '[]',
    "is_active"             BOOLEAN     NOT NULL DEFAULT true,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cold_chain_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cold_chain_thresholds_shop_id_is_active_idx"    ON "cold_chain_thresholds"("shop_id", "is_active");
CREATE INDEX "cold_chain_thresholds_shop_id_shipment_type_idx" ON "cold_chain_thresholds"("shop_id", "shipment_type");

ALTER TABLE "cold_chain_thresholds"
    ADD CONSTRAINT "cold_chain_thresholds_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;

-- ─── temperature_logs ─────────────────────────────────────────
CREATE TABLE "temperature_logs" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "shop_id"      UUID         NOT NULL,
    "shipment_id"  UUID         NOT NULL,
    "vehicle_id"   UUID,
    "temperature"  DECIMAL(6,2) NOT NULL,
    "unit"         "TempUnit"   NOT NULL DEFAULT 'CELSIUS',
    "sensor_id"    TEXT,
    "latitude"     DECIMAL(10,8),
    "longitude"    DECIMAL(11,8),
    "breached"     BOOLEAN      NOT NULL DEFAULT false,
    "recorded_at"  TIMESTAMP(3) NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temperature_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "temperature_logs_shipment_id_recorded_at_idx" ON "temperature_logs"("shipment_id", "recorded_at" DESC);
CREATE INDEX "temperature_logs_shop_id_recorded_at_idx"     ON "temperature_logs"("shop_id", "recorded_at" DESC);
CREATE INDEX "temperature_logs_vehicle_id_recorded_at_idx"  ON "temperature_logs"("vehicle_id", "recorded_at" DESC);
CREATE INDEX "temperature_logs_breached_recorded_at_idx"    ON "temperature_logs"("breached", "recorded_at" DESC);

ALTER TABLE "temperature_logs"
    ADD CONSTRAINT "temperature_logs_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;

ALTER TABLE "temperature_logs"
    ADD CONSTRAINT "temperature_logs_shipment_id_fkey"
    FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE;

ALTER TABLE "temperature_logs"
    ADD CONSTRAINT "temperature_logs_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "fleet_vehicles"("id") ON DELETE SET NULL;

-- ─── cold_chain_alerts ────────────────────────────────────────
CREATE TABLE "cold_chain_alerts" (
    "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
    "shop_id"          UUID           NOT NULL,
    "shipment_id"      UUID           NOT NULL,
    "threshold_id"     UUID           NOT NULL,
    "log_id"           UUID           NOT NULL,
    "actual_temp"      DECIMAL(6,2)   NOT NULL,
    "min_temp"         DECIMAL(6,2)   NOT NULL,
    "max_temp"         DECIMAL(6,2)   NOT NULL,
    "unit"             "TempUnit"     NOT NULL DEFAULT 'CELSIUS',
    "severity"         "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "acknowledged"     BOOLEAN        NOT NULL DEFAULT false,
    "acknowledged_by"  UUID,
    "acknowledged_at"  TIMESTAMP(3),
    "notes"            TEXT,
    "triggered_at"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cold_chain_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cold_chain_alerts_shipment_id_triggered_at_idx"      ON "cold_chain_alerts"("shipment_id", "triggered_at" DESC);
CREATE INDEX "cold_chain_alerts_shop_id_acknowledged_idx"          ON "cold_chain_alerts"("shop_id", "acknowledged");
CREATE INDEX "cold_chain_alerts_shop_id_severity_triggered_at_idx" ON "cold_chain_alerts"("shop_id", "severity", "triggered_at" DESC);

ALTER TABLE "cold_chain_alerts"
    ADD CONSTRAINT "cold_chain_alerts_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;

ALTER TABLE "cold_chain_alerts"
    ADD CONSTRAINT "cold_chain_alerts_shipment_id_fkey"
    FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE;

ALTER TABLE "cold_chain_alerts"
    ADD CONSTRAINT "cold_chain_alerts_threshold_id_fkey"
    FOREIGN KEY ("threshold_id") REFERENCES "cold_chain_thresholds"("id");

ALTER TABLE "cold_chain_alerts"
    ADD CONSTRAINT "cold_chain_alerts_log_id_fkey"
    FOREIGN KEY ("log_id") REFERENCES "temperature_logs"("id");

-- ─── shipments: add is_cold_chain flag ────────────────────────
ALTER TABLE "shipments" ADD COLUMN "is_cold_chain" BOOLEAN NOT NULL DEFAULT false;
