-- OAuth2 App Platform + Operations (Activity Flows).
--
-- Adds the foundation for third-party app installs (ADR-029) and
-- tenant-defined order/shipment activity flows (ADR-030). Both are
-- additive / non-destructive:
--   • New tables for OAuth and activity flows
--   • Nullable FK columns on shipments, orders, webhook_endpoints
--
-- No data backfill is required. Existing rows keep working because
-- activity_flow_id / current_stage_key / installation_id default to NULL
-- and the engines fall back to the pre-existing STATUS_TRANSITIONS
-- behaviour when no activity flow is attached.

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE "OAuthClientType" AS ENUM ('CONFIDENTIAL', 'PUBLIC');
CREATE TYPE "OAuthClientStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "AppInstallationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'SUSPENDED');
CREATE TYPE "ActivityEntityType" AS ENUM ('SHIPMENT', 'ORDER');
CREATE TYPE "ActivityFlowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- ─── OAUTH CLIENTS ────────────────────────────────────────────────────────────

CREATE TABLE "oauth_clients" (
    "id"                 UUID              NOT NULL DEFAULT gen_random_uuid(),
    "name"               TEXT              NOT NULL,
    "description"        TEXT,
    "logo_url"           TEXT,
    "homepage_url"       TEXT,
    "redirect_uris"      TEXT[]            NOT NULL DEFAULT ARRAY[]::TEXT[],
    "allowed_scopes"     TEXT[]            NOT NULL DEFAULT ARRAY[]::TEXT[],
    "client_type"        "OAuthClientType" NOT NULL DEFAULT 'CONFIDENTIAL',
    "client_secret_hash" TEXT,
    "secret_prefix"      TEXT,
    "owner_user_id"      UUID              NOT NULL,
    "status"             "OAuthClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at"         TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "oauth_clients_owner_user_id_idx" ON "oauth_clients" ("owner_user_id");
CREATE INDEX "oauth_clients_status_idx" ON "oauth_clients" ("status");

ALTER TABLE "oauth_clients"
    ADD CONSTRAINT "oauth_clients_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── APP INSTALLATIONS ────────────────────────────────────────────────────────

CREATE TABLE "app_installations" (
    "id"              UUID                    NOT NULL DEFAULT gen_random_uuid(),
    "oauth_client_id" UUID                    NOT NULL,
    "org_id"          UUID                    NOT NULL,
    "shop_id"         UUID,
    "scopes"          TEXT[]                  NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status"          "AppInstallationStatus" NOT NULL DEFAULT 'ACTIVE',
    "webhook_url"     TEXT,
    "installed_by"    UUID                    NOT NULL,
    "installed_at"    TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"      TIMESTAMP(3),
    "metadata"        JSONB,

    CONSTRAINT "app_installations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_installations_oauth_client_id_org_id_shop_id_key"
    ON "app_installations" ("oauth_client_id", "org_id", "shop_id");
CREATE INDEX "app_installations_org_id_idx"  ON "app_installations" ("org_id");
CREATE INDEX "app_installations_shop_id_idx" ON "app_installations" ("shop_id");
CREATE INDEX "app_installations_status_idx"  ON "app_installations" ("status");

ALTER TABLE "app_installations"
    ADD CONSTRAINT "app_installations_oauth_client_id_fkey"
    FOREIGN KEY ("oauth_client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_installations"
    ADD CONSTRAINT "app_installations_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_installations"
    ADD CONSTRAINT "app_installations_installed_by_fkey"
    FOREIGN KEY ("installed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── AUTHORIZATION CODES ──────────────────────────────────────────────────────

CREATE TABLE "oauth_authorization_codes" (
    "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code_hash"             TEXT         NOT NULL,
    "installation_id"       UUID         NOT NULL,
    "redirect_uri"          TEXT         NOT NULL,
    "scopes"                TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "code_challenge"        TEXT         NOT NULL,
    "code_challenge_method" TEXT         NOT NULL DEFAULT 'S256',
    "expires_at"            TIMESTAMP(3) NOT NULL,
    "consumed_at"           TIMESTAMP(3),
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_authorization_codes_code_hash_key"
    ON "oauth_authorization_codes" ("code_hash");
CREATE INDEX "oauth_authorization_codes_installation_id_idx"
    ON "oauth_authorization_codes" ("installation_id");
CREATE INDEX "oauth_authorization_codes_expires_at_idx"
    ON "oauth_authorization_codes" ("expires_at");

ALTER TABLE "oauth_authorization_codes"
    ADD CONSTRAINT "oauth_authorization_codes_installation_id_fkey"
    FOREIGN KEY ("installation_id") REFERENCES "app_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ACCESS TOKENS ────────────────────────────────────────────────────────────

CREATE TABLE "oauth_access_tokens" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "token_hash"      TEXT         NOT NULL,
    "prefix"          TEXT         NOT NULL,
    "installation_id" UUID         NOT NULL,
    "scopes"          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at"      TIMESTAMP(3) NOT NULL,
    "revoked_at"      TIMESTAMP(3),
    "last_used_at"    TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_key"
    ON "oauth_access_tokens" ("token_hash");
CREATE INDEX "oauth_access_tokens_prefix_idx"
    ON "oauth_access_tokens" ("prefix");
CREATE INDEX "oauth_access_tokens_installation_id_idx"
    ON "oauth_access_tokens" ("installation_id");
CREATE INDEX "oauth_access_tokens_expires_at_idx"
    ON "oauth_access_tokens" ("expires_at");

ALTER TABLE "oauth_access_tokens"
    ADD CONSTRAINT "oauth_access_tokens_installation_id_fkey"
    FOREIGN KEY ("installation_id") REFERENCES "app_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── REFRESH TOKENS ───────────────────────────────────────────────────────────

CREATE TABLE "oauth_refresh_tokens" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "token_hash"      TEXT         NOT NULL,
    "prefix"          TEXT         NOT NULL,
    "installation_id" UUID         NOT NULL,
    "scopes"          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rotated_from_id" UUID,
    "expires_at"      TIMESTAMP(3) NOT NULL,
    "revoked_at"      TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_refresh_tokens_token_hash_key"
    ON "oauth_refresh_tokens" ("token_hash");
CREATE INDEX "oauth_refresh_tokens_prefix_idx"
    ON "oauth_refresh_tokens" ("prefix");
CREATE INDEX "oauth_refresh_tokens_installation_id_idx"
    ON "oauth_refresh_tokens" ("installation_id");
CREATE INDEX "oauth_refresh_tokens_expires_at_idx"
    ON "oauth_refresh_tokens" ("expires_at");

ALTER TABLE "oauth_refresh_tokens"
    ADD CONSTRAINT "oauth_refresh_tokens_installation_id_fkey"
    FOREIGN KEY ("installation_id") REFERENCES "app_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ACTIVITY FLOWS (ADR-030) ─────────────────────────────────────────────────

CREATE TABLE "activity_flows" (
    "id"          UUID                 NOT NULL DEFAULT gen_random_uuid(),
    "shop_id"     UUID                 NOT NULL,
    "entity_type" "ActivityEntityType" NOT NULL,
    "key"         TEXT                 NOT NULL,
    "name"        TEXT                 NOT NULL,
    "description" TEXT,
    "is_default"  BOOLEAN              NOT NULL DEFAULT false,
    "status"      "ActivityFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "version"     INTEGER              NOT NULL DEFAULT 1,
    "graph"       JSONB                NOT NULL DEFAULT '{"stages":[]}'::jsonb,
    "created_at"  TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)         NOT NULL,

    CONSTRAINT "activity_flows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_flows_shop_id_entity_type_key_key"
    ON "activity_flows" ("shop_id", "entity_type", "key");
CREATE INDEX "activity_flows_shop_id_entity_type_status_idx"
    ON "activity_flows" ("shop_id", "entity_type", "status");

ALTER TABLE "activity_flows"
    ADD CONSTRAINT "activity_flows_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── LINK SHIPMENTS / ORDERS TO FLOWS ─────────────────────────────────────────

ALTER TABLE "shipments"
    ADD COLUMN "activity_flow_id"  UUID,
    ADD COLUMN "current_stage_key" TEXT;

ALTER TABLE "shipments"
    ADD CONSTRAINT "shipments_activity_flow_id_fkey"
    FOREIGN KEY ("activity_flow_id") REFERENCES "activity_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders"
    ADD COLUMN "activity_flow_id"  UUID,
    ADD COLUMN "current_stage_key" TEXT;

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_activity_flow_id_fkey"
    FOREIGN KEY ("activity_flow_id") REFERENCES "activity_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── LINK WEBHOOK ENDPOINTS TO APP INSTALLATIONS (ADR-029) ────────────────────

ALTER TABLE "webhook_endpoints"
    ADD COLUMN "installation_id" UUID;

CREATE INDEX "webhook_endpoints_installation_id_idx"
    ON "webhook_endpoints" ("installation_id");

ALTER TABLE "webhook_endpoints"
    ADD CONSTRAINT "webhook_endpoints_installation_id_fkey"
    FOREIGN KEY ("installation_id") REFERENCES "app_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
