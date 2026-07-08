/**
 * Demand Prediction API Routes
 *
 * Complete API endpoints for demand forecasting, anomaly detection, and smart scheduling
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from "fastify";

export default async function demandPredictionsRoutes(app: FastifyInstance) {
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "Demand predictions routes — pending Fastify migration",
    });
  });
}
