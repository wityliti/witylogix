-- WIT-502: ELD / HOS / DVIR tables for fleet compliance.
--
-- Adds four new tables:
--   eld_hos_records    — daily Hours-of-Service records per driver
--   dvir_inspections   — pre/post-trip vehicle inspection reports
--   dvir_defects       — individual defects from inspections
--   eld_events         — audit log of ELD state-change events
--
-- All tables are org-scoped and protected by the dual-mode RLS pattern
-- (shop_id lookup OR org_id direct) matching the existing drivers policy.

-- ─── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE "eld_hos_records" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id"                UUID NOT NULL,
    "driver_id"             UUID NOT NULL,
    "current_status"        TEXT NOT NULL DEFAULT 'OFF_DUTY',
    "driving_minutes_today" INTEGER NOT NULL DEFAULT 0,
    "on_duty_minutes_today" INTEGER NOT NULL DEFAULT 0,
    "cycle_minutes_used"    INTEGER NOT NULL DEFAULT 0,
    "break_status"          TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "last_status_change_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "is_violation"          BOOLEAN NOT NULL DEFAULT false,
    "violation_type"        TEXT,
    "personal_conveyance"   BOOLEAN NOT NULL DEFAULT false,
    "yard_move"             BOOLEAN NOT NULL DEFAULT false,
    "record_date"           DATE NOT NULL DEFAULT CURRENT_DATE,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "eld_hos_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dvir_inspections" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id"         UUID NOT NULL,
    "vehicle_number" TEXT NOT NULL,
    "vehicle_id"     UUID,
    "driver_id"      UUID NOT NULL,
    "type"           TEXT NOT NULL,
    "status"         TEXT NOT NULL,
    "items"          JSONB NOT NULL DEFAULT '[]',
    "signature_url"  TEXT,
    "photos"         TEXT[] NOT NULL DEFAULT '{}',
    "inspected_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "dvir_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dvir_defects" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id"         UUID NOT NULL,
    "inspection_id"  UUID,
    "vehicle_number" TEXT NOT NULL,
    "vehicle_id"     UUID,
    "component"      TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "severity"       TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'REPORTED',
    "driver_id"      UUID NOT NULL,
    "mechanic_id"    UUID,
    "mechanic_name"  TEXT,
    "certified_at"   TIMESTAMPTZ,
    "photo_url"      TEXT,
    "reported_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "dvir_defects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eld_events" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id"      UUID NOT NULL,
    "driver_id"   UUID NOT NULL,
    "hos_id"      UUID,
    "type"        TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data"        JSONB NOT NULL DEFAULT '{}',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "eld_events_pkey" PRIMARY KEY ("id")
);

-- ─── Unique Constraints ────────────────────────────────────────────────────────

ALTER TABLE "eld_hos_records" ADD CONSTRAINT "eld_hos_records_org_id_driver_id_record_date_key"
    UNIQUE ("org_id", "driver_id", "record_date");

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX "eld_hos_records_org_id_current_status_idx"  ON "eld_hos_records"("org_id", "current_status");
CREATE INDEX "eld_hos_records_org_id_record_date_idx"     ON "eld_hos_records"("org_id", "record_date");
CREATE INDEX "eld_hos_records_driver_id_record_date_idx"  ON "eld_hos_records"("driver_id", "record_date");

CREATE INDEX "dvir_inspections_org_id_vehicle_number_idx" ON "dvir_inspections"("org_id", "vehicle_number");
CREATE INDEX "dvir_inspections_org_id_inspected_at_idx"   ON "dvir_inspections"("org_id", "inspected_at");

CREATE INDEX "dvir_defects_org_id_status_idx"             ON "dvir_defects"("org_id", "status");
CREATE INDEX "dvir_defects_org_id_severity_idx"           ON "dvir_defects"("org_id", "severity");
CREATE INDEX "dvir_defects_org_id_vehicle_number_idx"     ON "dvir_defects"("org_id", "vehicle_number");

CREATE INDEX "eld_events_org_id_created_at_idx"           ON "eld_events"("org_id", "created_at");
CREATE INDEX "eld_events_driver_id_created_at_idx"        ON "eld_events"("driver_id", "created_at");

-- ─── Foreign Keys ──────────────────────────────────────────────────────────────

ALTER TABLE "eld_hos_records"
    ADD CONSTRAINT "eld_hos_records_org_id_fkey"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "eld_hos_records_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")       ON DELETE CASCADE;

ALTER TABLE "dvir_inspections"
    ADD CONSTRAINT "dvir_inspections_org_id_fkey"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "dvir_inspections_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")       ON DELETE CASCADE;

ALTER TABLE "dvir_defects"
    ADD CONSTRAINT "dvir_defects_org_id_fkey"        FOREIGN KEY ("org_id")         REFERENCES "organizations"("id")   ON DELETE CASCADE,
    ADD CONSTRAINT "dvir_defects_driver_id_fkey"     FOREIGN KEY ("driver_id")      REFERENCES "drivers"("id")          ON DELETE CASCADE,
    ADD CONSTRAINT "dvir_defects_inspection_id_fkey" FOREIGN KEY ("inspection_id")  REFERENCES "dvir_inspections"("id") ON DELETE SET NULL;

ALTER TABLE "eld_events"
    ADD CONSTRAINT "eld_events_org_id_fkey"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id")   ON DELETE CASCADE,
    ADD CONSTRAINT "eld_events_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")          ON DELETE CASCADE,
    ADD CONSTRAINT "eld_events_hos_id_fkey"    FOREIGN KEY ("hos_id")    REFERENCES "eld_hos_records"("id")  ON DELETE SET NULL;

-- ─── Row-Level Security ────────────────────────────────────────────────────────
-- All four tables are org-scoped. Follow the dual-mode pattern:
--   shop context  → lookup org via shops table
--   org context   → direct org_id match

ALTER TABLE eld_hos_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE eld_hos_records  FORCE ROW LEVEL SECURITY;
ALTER TABLE dvir_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvir_inspections FORCE ROW LEVEL SECURITY;
ALTER TABLE dvir_defects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvir_defects     FORCE ROW LEVEL SECURITY;
ALTER TABLE eld_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE eld_events       FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "eld_hos_records"
    FOR ALL TO app_user
    USING (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    )
    WITH CHECK (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    );

CREATE POLICY tenant_isolation ON "dvir_inspections"
    FOR ALL TO app_user
    USING (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    )
    WITH CHECK (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    );

CREATE POLICY tenant_isolation ON "dvir_defects"
    FOR ALL TO app_user
    USING (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    )
    WITH CHECK (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    );

CREATE POLICY tenant_isolation ON "eld_events"
    FOR ALL TO app_user
    USING (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    )
    WITH CHECK (
        (current_setting('app.current_shop_id', TRUE) != '' AND
            org_id = (SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
            org_id = current_setting('app.current_org_id', TRUE)::UUID)
    );
