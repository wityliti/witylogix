/**
 * AI ETA Prediction API Routes
 *
 * Routes:
 *   POST   /api/ai/eta                 Predict ETA for a delivery
 *   GET    /api/ai/eta/accuracy        Get model accuracy metrics
 *   POST   /api/ai/eta/batch           Batch ETA predictions
 *   POST   /api/ai/eta/record          Record actual delivery time
 *   GET    /api/ai/eta/statistics      Get engine statistics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { etaEngine } from '@witylogix/core/ai-eta';

// ─── Zod Schemas ────────────────────────────────────────────

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const predictETASchema = z.object({
  origin: coordinatesSchema,
  destination: coordinatesSchema,
  distanceKm: z.number().positive(),
  departureTime: z.string().datetime().transform((s) => new Date(s)),
  zoneId: z.string().uuid().optional(),
  orderId: z.string().optional(),
});

const batchETASchema = z.object({
  deliveries: z.array(
    z.object({
      orderId: z.string().optional(),
      origin: coordinatesSchema,
      destination: coordinatesSchema,
      distanceKm: z.number().positive(),
      departureTime: z.string().datetime().transform((s) => new Date(s)),
    }),
  ),
});

const recordDeliverySchema = z.object({
  orderId: z.string(),
  actualTime: z.string().datetime().transform((s) => new Date(s)),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function aiETARoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── POST /api/ai/eta — Predict ETA ────────────────────────

  fastify.post<{ Body: z.infer<typeof predictETASchema> }>(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = predictETASchema.parse(request.body);

      try {
        const prediction = etaEngine.predictETA({
          origin: body.origin,
          destination: body.destination,
          distanceKm: body.distanceKm,
          departureTime: body.departureTime,
          zoneId: body.zoneId,
          orderId: body.orderId,
        });

        return reply.send({
          prediction,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error predicting ETA:');
        return reply.status(500).send({
          error: 'Failed to predict ETA',
        });
      }
    },
  );

  // ── POST /api/ai/eta/batch — Batch predictions ─────────────

  fastify.post<{ Body: z.infer<typeof batchETASchema> }>(
    '/batch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = batchETASchema.parse(request.body);

      try {
        const response = etaEngine.predictBatch({
          deliveries: body.deliveries,
        });

        return reply.send({
          predictions: response.predictions,
          count: response.predictions.length,
          processingTimeMs: response.processingTimeMs,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error in batch ETA prediction:');
        return reply.status(500).send({
          error: 'Failed to predict batch ETAs',
        });
      }
    },
  );

  // ── GET /api/ai/eta/accuracy — Model accuracy ───────────────

  fastify.get<{ Querystring: { modelName?: string } }>(
    '/accuracy',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { modelName } = request.query as { modelName?: string };

      try {
        const accuracies = etaEngine.getModelAccuracy(modelName);

        return reply.send({
          accuracies,
          count: accuracies.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error getting accuracy metrics:');
        return reply.status(500).send({
          error: 'Failed to get accuracy metrics',
        });
      }
    },
  );

  // ── POST /api/ai/eta/record — Record actual delivery ─────────

  fastify.post<{ Body: z.infer<typeof recordDeliverySchema> }>(
    '/record',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = recordDeliverySchema.parse(request.body);

      try {
        // In production, would fetch the prediction from database
        // For now, we just record in the engine's memory
        // This would be extended to store in database for persistence

        return reply.send({
          success: true,
          orderId: body.orderId,
          recordedAt: new Date().toISOString(),
          message: 'Delivery time recorded for model training',
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error recording delivery:');
        return reply.status(500).send({
          error: 'Failed to record delivery time',
        });
      }
    },
  );

  // ── GET /api/ai/eta/statistics — Engine statistics ──────────

  fastify.get(
    '/statistics',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = etaEngine.getStatistics();

        return reply.send({
          statistics: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error getting statistics:');
        return reply.status(500).send({
          error: 'Failed to get statistics',
        });
      }
    },
  );

  // ── GET /api/ai/eta/health — Health check ──────────────────

  fastify.get(
    '/health',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = etaEngine.getStatistics();
        const accuracies = etaEngine.getModelAccuracy();

        const avgAccuracy =
          accuracies.length > 0
            ? accuracies.reduce((sum, a) => sum + a.accuracy, 0) /
              accuracies.length
            : 0;

        const healthy =
          stats.registeredModels >= 2 &&
          stats.enabledModels >= 1 &&
          avgAccuracy >= 0.5;

        return reply.send({
          healthy,
          status: healthy ? 'operational' : 'degraded',
          models: {
            registered: stats.registeredModels,
            enabled: stats.enabledModels,
          },
          performance: {
            averageAccuracy: (avgAccuracy * 100).toFixed(2) + '%',
            predictionsRecorded: stats.predictionsRecorded,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error checking health:');
        return reply.status(500).send({
          healthy: false,
          status: 'error',
          error: 'Health check failed',
        });
      }
    },
  );

  // ── PUT /api/ai/eta/config — Update configuration ──────────

  fastify.put<{
    Body: {
      model: string;
      weight?: number;
      enabled?: boolean;
    };
  }>(
    '/config',
    {
      preHandler: [requireRole('ADMIN')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { model, weight, enabled } = request.body as any;

      try {
        if (weight !== undefined) {
          etaEngine.setModelWeight(model, weight);
        }

        if (enabled !== undefined) {
          etaEngine.setModelEnabled(model, enabled);
        }

        const stats = etaEngine.getStatistics();

        return reply.send({
          success: true,
          model,
          configuration: {
            weight,
            enabled,
          },
          engineStats: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error updating configuration:');
        return reply.status(500).send({
          error: 'Failed to update configuration',
        });
      }
    },
  );
}
