/**
 * Demand Dashboard API Routes
 *
 * Complete API endpoints for real-time demand monitoring, rebalancing, and alerts:
 * - GET /demand/dashboard/snapshot — current demand snapshot all zones
 * - GET /demand/dashboard/timeline/:zoneId — zone demand timeline
 * - GET /demand/dashboard/anomalies — top anomalies
 * - GET /demand/dashboard/model-accuracy — model performance
 * - GET /demand/dashboard/zone-rankings — zone rankings
 * - POST /demand/rebalance/suggest — get rebalancing suggestion
 * - POST /demand/rebalance/execute — execute rebalancing plan
 * - GET /demand/alerts — active alerts
 * - POST /demand/alerts/acknowledge/:id — acknowledge alert
 * - POST /demand/models/retrain — trigger retraining
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from "fastify";

export default async function demandDashboardRoutes(app: FastifyInstance) {
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "Demand dashboard routes — pending Fastify migration",
    });
  });
}
