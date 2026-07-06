/**
 * Shop management — tenant configuration + multi-provider routing + notifications.
 *
 * Routes:
 *   GET    /me                       Get current shop profile
 *   PATCH  /me                       Update shop settings
 *   GET    /me/stats                 Get shop dashboard stats
 *   GET    /me/routing               Get routing config (provider registry + tenant state)
 *   PATCH  /me/routing               Update tenant routing credentials (BYOK only)
 *   GET    /me/routing/meter         Get routing metering stats (deployer fallback usage)
 *   GET    /me/notifications         Get notification config (per-channel registries + tenant state)
 *   PATCH  /me/notifications/:channel Update tenant notification credentials per channel (BYOK only)
 *   GET    /me/notifications/meter   Get notification metering stats (deployer fallback usage)
 */
import type { FastifyInstance } from "fastify";
declare function shopsRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof shopsRoutes;
export default _default;
//# sourceMappingURL=shops.d.ts.map
