/**
 * Time Slots — delivery window management.
 *
 * Routes:
 *   GET    /              List time slots (filterable by zone)
 *   GET    /:id           Get time slot
 *   POST   /              Create time slot
 *   PATCH  /:id           Update time slot
 *   DELETE /:id           Deactivate time slot
 *   GET    /available     Get available time slots for a date/zone (checkout API)
 */
import type { FastifyInstance } from "fastify";
declare function timeSlotsRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof timeSlotsRoutes;
export default _default;
//# sourceMappingURL=time-slots.d.ts.map
