/**
 * Notification API Routes v2 — Multi-channel notifications
 * TODO: Convert from Express to Fastify plugin pattern
 */

import type { FastifyInstance } from 'fastify';

export default async function notificationsV2Routes(app: FastifyInstance) {
  app.get('/status', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      message: 'Notifications v2 routes — pending Fastify migration',
    });
  });
}
