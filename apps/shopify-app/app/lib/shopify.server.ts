/**
 * Shopify authentication helpers — server-side only.
 *
 * This module handles the Shopify OAuth flow, session token verification,
 * and provides the `authenticate` object used by route loaders/actions.
 *
 * Architecture:
 *   Shopify App Bridge → session token (JWT) → verified by `authenticate.admin`
 *   Loaders call the Witylogix API with `Authorization: Bearer <session token>`;
 *   the API verifies that JWT with `SHOPIFY_API_SECRET` and resolves the shop tenant.
 */

import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

// Prisma session storage stores Shopify OAuth sessions in our database.
// @prisma/client is patched (via patches/@prisma__client.patch) so that
// .prisma/client/default.js delegates to packages/db/src/generated/prisma.
// Vite's SSR runner loads @prisma/client as CJS and only exposes module.exports
// via the default import — destructure PrismaClient from that default.
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import _prismaClientPkg from "@prisma/client";
const { PrismaClient } = _prismaClientPkg as typeof import("@prisma/client");

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: ApiVersion.January25,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") ?? [],
  appUrl: process.env.SHOPIFY_APP_URL ?? "https://localhost:9293",
  distribution: AppDistribution.AppStore,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(
    // PrismaSessionStorage expects a PrismaClient instance.
    // We pass a dedicated client here — not the tenant-scoped version.
    // Session storage is global (not tenant-scoped).
    new PrismaClient({ datasourceUrl: process.env.DATABASE_URL }),
  ),
});

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

/** CSP + App Bridge preloads for embedded iframes (used by `entry.server.tsx`). */
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

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
