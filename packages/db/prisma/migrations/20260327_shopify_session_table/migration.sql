-- CreateTable: Shopify OAuth Session Storage
-- Used by @shopify/shopify-app-session-storage-prisma
-- Global table (not tenant-scoped) — stores Shopify Admin OAuth sessions

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "access_token" TEXT NOT NULL,
    "user_id" BIGINT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "account_owner" BOOLEAN,
    "locale" TEXT,
    "collaborator" BOOLEAN,
    "email_verified" BOOLEAN,
    "refresh_token" TEXT,
    "refresh_token_expires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
