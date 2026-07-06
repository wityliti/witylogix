/**
 * Drivers CRUD + spatial operations.
 *
 * Routes:
 *   GET    /              List drivers (paginated, filterable by status)
 *   GET    /:id           Get single driver with current orders
 *   POST   /              Create driver
 *   PATCH  /:id           Update driver profile
 *   PATCH  /:id/status    Update driver availability status
 *   POST   /:id/location  Update driver GPS location (from mobile app)
 *   GET    /nearby        Find nearby available drivers (PostGIS + Redis GEO)
 *   DELETE /:id           Deactivate driver (soft delete)
 */
import type { FastifyInstance } from "fastify";
declare function driversRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof driversRoutes;
export default _default;
//# sourceMappingURL=drivers.d.ts.map
