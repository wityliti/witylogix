/**
 * Carrier Service — Shopify Carrier Service API endpoint.
 *
 * This is the performance-critical endpoint that Shopify calls during checkout
 * to get shipping rates. Target: p95 < 500ms response time.
 *
 * Routes:
 *   POST /rates         Calculate shipping rates (called by Shopify)
 *   GET  /services      List carrier services for the tenant
 *   POST /services      Register a new carrier service
 */
import type { FastifyInstance } from "fastify";
declare function carriersRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof carriersRoutes;
export default _default;
//# sourceMappingURL=carriers.d.ts.map