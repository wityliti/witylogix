/**
 * E-Commerce Integration API Routes
 * Handles multi-platform e-commerce operations: connect, sync, orders, webhooks
 * TODO: Convert from Express to Fastify plugin pattern in future sprint
 */

import type { FastifyInstance } from "fastify";

export default async function ecommerceRoutes(app: FastifyInstance) {
  // Placeholder — full e-commerce routes pending Fastify migration
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "E-Commerce integration routes — pending full Fastify migration",
      platforms: ["shopify", "woocommerce", "magento", "bigcommerce"],
    });
  });
}
