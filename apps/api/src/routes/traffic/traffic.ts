/**
 * Traffic API Routes
 *
 * Endpoints:
 * - GET /traffic/eta - Calculate traffic-aware ETA
 * - GET /traffic/route - Get route with traffic overlay
 * - GET /traffic/matrix - Distance matrix with traffic
 * - GET /traffic/conditions - Area traffic conditions
 * - GET /traffic/incidents - Traffic incidents in area
 * - POST /traffic/optimal-departure - Find best departure time
 *
 * All endpoints use Zod for request validation.
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from "fastify";

export default async function trafficRoutes(app: FastifyInstance) {
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "Traffic routes — pending Fastify migration",
    });
  });
}
