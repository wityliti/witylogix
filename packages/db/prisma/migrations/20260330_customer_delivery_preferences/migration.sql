-- CreateTable: customer_delivery_preferences
-- Part of WIT-142 — Customer Self-Service Delivery Portal

CREATE TABLE "customer_delivery_preferences" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id"       UUID NOT NULL,
    "shop_id"        UUID NOT NULL,
    "instructions"   TEXT,
    "dropoff_note"   TEXT,
    "dropoff_lat"    DOUBLE PRECISION,
    "dropoff_lng"    DOUBLE PRECISION,
    "contact_pref"   TEXT,
    "rescheduled_to" TIMESTAMPTZ,
    "time_slot_id"   UUID,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_delivery_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_delivery_preferences_order_id_key"
    ON "customer_delivery_preferences"("order_id");

CREATE INDEX "customer_delivery_preferences_shop_id_idx"
    ON "customer_delivery_preferences"("shop_id");

-- AddForeignKey
ALTER TABLE "customer_delivery_preferences"
    ADD CONSTRAINT "customer_delivery_preferences_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_delivery_preferences"
    ADD CONSTRAINT "customer_delivery_preferences_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_delivery_preferences"
    ADD CONSTRAINT "customer_delivery_preferences_time_slot_id_fkey"
    FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
