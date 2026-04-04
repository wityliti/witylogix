/**
 * Server-side WooCommerce credential validation and connection storage.
 *
 * Uses HTTP Basic Auth (Consumer Key + Consumer Secret) over HTTPS to verify
 * credentials against the WooCommerce system_status endpoint, which returns
 * the store name and active currency — used to populate the success screen.
 *
 * Credentials are encrypted at rest using @witylogix/core/encryption before
 * being written to `woocommerce_connections`.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@witylogix/db";
import { createCryptoService } from "@witylogix/core/encryption";

// ─── Types ──────────────────────────────────────────────────

export interface WCSystemStatus {
  store: {
    name: string;
    url: string;
  };
  settings: {
    currency: string;
    currency_symbol: string;
  };
}

export interface ConnectParams {
  shopId: string;
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface ConnectResult {
  storeName: string;
  currency: string;
  connectionId: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function normaliseStoreUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  return url.startsWith("http") ? url : `https://${url}`;
}

function getCryptoService() {
  return createCryptoService(process.env.ENCRYPTION_MASTER_KEY);
}

// ─── Validate credentials against WooCommerce API ────────────

export async function verifyWooCommerceCredentials(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<WCSystemStatus> {
  const base = normaliseStoreUrl(storeUrl);
  const endpoint = `${base}/wp-json/wc/v3/system_status`;

  const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    // 10-second timeout via AbortSignal
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Invalid Consumer Key or Consumer Secret.");
  }

  if (!response.ok) {
    throw new Error(
      `WooCommerce API returned ${response.status}. Check that the Store URL is correct and the REST API is enabled.`,
    );
  }

  const json = (await response.json()) as WCSystemStatus;

  if (!json?.store?.name) {
    throw new Error("Unexpected response from WooCommerce. Verify the Store URL.");
  }

  return json;
}

// ─── Save connection to DB ────────────────────────────────────

export async function saveWooCommerceConnection(
  params: ConnectParams,
  status: WCSystemStatus,
): Promise<ConnectResult> {
  const { shopId, storeUrl, consumerKey, consumerSecret } = params;
  const crypto = getCryptoService();

  const encryptedKey = crypto.encrypt(consumerKey);
  const encryptedSecret = crypto.encrypt(consumerSecret);

  const webhookSecret = randomBytes(32).toString("hex");
  const encryptedWebhookSecret = crypto.encrypt(webhookSecret);

  const base = normaliseStoreUrl(storeUrl);

  const existing = await prisma.wooCommerceConnection.findFirst({
    where: { tenantId: shopId, storeUrl: base },
    select: { id: true },
  });

  let connectionId: string;

  if (existing) {
    await prisma.wooCommerceConnection.update({
      where: { id: existing.id },
      data: {
        consumerKey: JSON.stringify(encryptedKey),
        consumerSecret: JSON.stringify(encryptedSecret),
        webhookSecret: JSON.stringify(encryptedWebhookSecret),
        status: "active",
      },
    });
    connectionId = existing.id;
  } else {
    const conn = await prisma.wooCommerceConnection.create({
      data: {
        tenantId: shopId,
        storeUrl: base,
        consumerKey: JSON.stringify(encryptedKey),
        consumerSecret: JSON.stringify(encryptedSecret),
        webhookSecret: JSON.stringify(encryptedWebhookSecret),
        status: "active",
      },
    });
    connectionId = conn.id;
  }

  return {
    storeName: status.store.name,
    currency: status.settings.currency,
    connectionId,
  };
}
