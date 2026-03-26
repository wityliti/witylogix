/**
 * Organization management — multi-shop tenant grouping.
 *
 * These routes allow merchants with multiple Shopify stores to:
 * - Create an organization
 * - Link shops to the org (post-install, never during Shopify OAuth)
 * - Manage org members and their shop access
 * - View cross-shop stats
 *
 * Routes:
 *   POST   /                  Create organization
 *   GET    /me                Get current user's org
 *   PATCH  /me                Update org settings
 *   GET    /me/shops          List shops in org
 *   POST   /me/shops          Link a shop to the org
 *   DELETE /me/shops/:shopId  Unlink a shop from the org
 *   GET    /me/members        List org members
 *   POST   /me/members        Invite a user to the org
 *   PATCH  /me/members/:id    Update member role/shop access
 *   DELETE /me/members/:id    Remove member from org
 *   GET    /me/stats          Cross-shop aggregate stats
 */
import type { FastifyInstance } from "fastify";
declare function orgsRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof orgsRoutes;
export default _default;
//# sourceMappingURL=orgs.d.ts.map