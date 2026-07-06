/**
 * Demand Prediction Feature Store API Routes
 *
 * Provides endpoints for accessing demand prediction features,
 * zone profiles, and triggering feature aggregation jobs.
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from "fastify";

export default async function demandFeaturesRoutes(app: FastifyInstance) {
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "Demand features routes — pending Fastify migration",
    });
  });
}
