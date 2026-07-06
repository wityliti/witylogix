/**
 * Invoice API Routes
 * RESTful API endpoints for invoice management
 * GET/POST/PUT for invoices, PDF generation, payments, and reminders
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from "fastify";

export default async function invoicesRoutes(app: FastifyInstance) {
  app.get("/status", async (_req, reply) => {
    return reply.send({
      status: "ok",
      message: "Invoices routes — pending Fastify migration",
    });
  });
}
