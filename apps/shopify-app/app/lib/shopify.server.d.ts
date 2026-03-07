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
declare const shopify: any;
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
export declare const authenticate: any;
/**
 * Shopify session management utilities.
 */
export declare const sessionStorage: any;
/**
 * Login helper — redirects unauthenticated users to Shopify OAuth.
 */
export declare const login: any;
/**
 * Register webhook handlers.
 */
export declare const registerWebhooks: any;
export default shopify;
//# sourceMappingURL=shopify.server.d.ts.map