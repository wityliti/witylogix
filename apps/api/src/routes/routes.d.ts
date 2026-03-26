/**
 * Routes & Route Stops — route planning and execution.
 *
 * Routes:
 *   GET    /              List routes (paginated, filterable by date/driver/status)
 *   GET    /:id           Get route with stops and orders
 *   POST   /              Create route (draft)
 *   PATCH  /:id           Update route metadata
 *   PATCH  /:id/status    Update route status
 *   POST   /:id/stops     Add stops to a route
 *   PATCH  /:id/stops/:stopId  Update stop status
 *   POST   /:id/optimize  Trigger route optimization
 *   DELETE /:id           Cancel route
 */
import type { FastifyInstance } from "fastify";
declare function routesRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof routesRoutes;
export default _default;
//# sourceMappingURL=routes.d.ts.map