/**
 * Customer-facing tracking endpoint — public (no auth required).
 *
 * Accessed via tracking token (not order ID) for security.
 * Powers the customer tracking page with delivery status + driver location.
 *
 * Routes:
 *   GET /token/:trackingToken  Get delivery status by tracking token
 */
import type { FastifyInstance } from "fastify";
declare function trackingRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof trackingRoutes;
export default _default;
//# sourceMappingURL=tracking.d.ts.map
