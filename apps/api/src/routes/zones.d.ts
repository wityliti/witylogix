/**
 * Delivery Zones — PostGIS polygon management.
 *
 * Routes:
 *   GET    /              List all zones for the tenant
 *   GET    /:id           Get zone details
 *   POST   /              Create zone with polygon boundary
 *   PATCH  /:id           Update zone (name, rates, boundary)
 *   DELETE /:id           Deactivate zone
 *   GET    /check         Check which zone covers a point (lat/lng)
 */
import type { FastifyInstance } from "fastify";
declare function zonesRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof zonesRoutes;
export default _default;
//# sourceMappingURL=zones.d.ts.map