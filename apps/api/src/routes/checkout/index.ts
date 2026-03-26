/**
 * Checkout API Router
 * Combines slots and rates routes under /api/checkout/
 */

import type { FastifyInstance } from "fastify";
import checkoutSlotsRoutes from "./slots.js";
import checkoutRatesRoutes from "./rates.js";

async function checkoutRouter(fastify: FastifyInstance): Promise<void> {
  // Register slot routes
  await fastify.register(checkoutSlotsRoutes);

  // Register rate routes
  await fastify.register(checkoutRatesRoutes);

  // Health check for entire checkout API
  fastify.get("/api/checkout/health", async (request, reply) => {
    return {
      status: "ok",
      service: "checkout-api",
      components: {
        slots: "ok",
        rates: "ok",
      },
      timestamp: new Date().toISOString(),
    };
  });
}

export default checkoutRouter;
