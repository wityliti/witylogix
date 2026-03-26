/**
 * Shopify authentication helpers — server-side only.
 *
 * This module handles the Shopify OAuth flow, session token verification,
 * and provides the `authenticate` object used by route loaders/actions.
 *
 * Architecture:
 *   Shopify App Bridge → session token (JWT) → verified here
 *   → exchanged for a Witylogix API JWT via POST /api/v4/auth/shopify-exchange
 *   → cached in server session for subsequent requests
 *
 * The Shopify session token proves the request is from an authenticated
 * merchant inside the Shopify Admin. We verify it using the Shopify API secret,
 * then call our own API to get a Witylogix JWT that carries shopId, role, etc.
 */

import "@shopify/shopify-app-react-router/adapters/node";
import {
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

// Prisma session storage stores Shopify OAuth sessions in our database
// so they survive server restarts. Uses the same @witylogix/db Prisma client.
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") ?? [],
  appUrl: process.env.SHOPIFY_APP_URL ?? "http://localhost:3000",
  distribution: AppDistribution.AppStore,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(
    // PrismaSessionStorage expects a PrismaClient instance.
    // We pass a lightweight one here — not the tenant-scoped version.
    // Session storage is global (not tenant-scoped).
    await createSessionStorageClient(),
  ),
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

async function createSessionStorageClient() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });
}

/**
 * Authenticate incoming requests from the Shopify Admin.
 * Use in route loaders and actions:
 *
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const { admin, session } = await authenticate.admin(request);
 *   // admin = Shopify Admin API client
 *   // session = Shopify session with shop domain, access token
 * }
 * ```
 */
export const authenticate = shopify.authenticate;

/**
 * Shopify session management utilities.
 */
export const sessionStorage = shopify.sessionStorage;

/**
 * Login helper — redirects unauthenticated users to Shopify OAuth.
 */
export const login = shopify.login;

/**
 * Register webhook handlers.
 */
export const registerWebhooks = shopify.registerWebhooks;

export default shopify;
