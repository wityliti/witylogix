/**
 * Payment API Routes
 * RESTful API endpoints for payment processing and reconciliation
 * Stripe webhook handling, payment recording, and refund management
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from 'fastify';

export default async function paymentsRoutes(app: FastifyInstance) {
  app.get('/status', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      message: 'Payments routes — pending Fastify migration',
    });
  });
}
