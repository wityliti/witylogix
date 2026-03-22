/**
 * Notification Preferences API Routes
 * Manage user notification preferences, channels, and quiet hours settings.
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from "fastify";

export default async function notificationPreferencesRoutes(
  app: FastifyInstance
) {
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "Notification preferences routes — pending Fastify migration",
    });
  });
}
