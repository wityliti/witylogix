/**
 * Orders CRUD — full lifecycle management.
 *
 * Routes:
 *   GET    /              List orders (paginated, filterable)
 *   GET    /:id           Get single order
 *   POST   /              Create order
 *   PATCH  /:id           Update order fields
 *   PATCH  /:id/status    Update order status (with state machine)
 *   PATCH  /:id/assign    Assign order to driver
 *   DELETE /:id           Soft-cancel order
 *   GET    /:id/timeline  Get order status history (via notification logs)
 */
import type { FastifyInstance } from "fastify";
declare function ordersRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof ordersRoutes;
export default _default;
//# sourceMappingURL=orders.d.ts.map