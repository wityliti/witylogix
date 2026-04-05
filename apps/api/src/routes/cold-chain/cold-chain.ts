/**
 * Cold Chain Monitoring API (WIT-91)
 *
 * POST /api/v4/cold-chain/logs              — push a temperature reading (driver app / IoT)
 * GET  /api/v4/cold-chain/shipments/:id/logs — temperature history for a shipment
 * GET  /api/v4/cold-chain/alerts             — list open/resolved breach alerts
 * PATCH /api/v4/cold-chain/alerts/:id/resolve — resolve a breach alert
 * GET  /api/v4/cold-chain/thresholds         — get shop thresholds
 * PUT  /api/v4/cold-chain/thresholds/:category — upsert a threshold
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';

// ── Zod schemas ────────────────────────────────────────────────────────────────

const logReadingBody = z.object({
  shipmentId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
  temperature: z.number(),
  unit: z.enum(['CELSIUS', 'FAHRENHEIT']).default('CELSIUS'),
  source: z.enum(['driver_app', 'iot_gateway', 'manual']).default('driver_app'),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  recordedAt: z.string().datetime().optional(), // ISO-8601; defaults to now()
});

const upsertThresholdBody = z.object({
  minTemp: z.number(),
  maxTemp: z.number(),
  unit: z.enum(['CELSIUS', 'FAHRENHEIT']).default('CELSIUS'),
  alertOnBreach: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  resolved: z.enum(['true', 'false', 'all']).default('false'),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert Fahrenheit to Celsius for threshold comparison. */
function toCelsius(value: number, unit: string): number {
  return unit === 'FAHRENHEIT' ? (value - 32) * (5 / 9) : value;
}

// ── Route plugin ───────────────────────────────────────────────────────────────

async function coldChainRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  /**
   * POST /logs
   * Push a temperature sensor reading. Automatically checks against the shop's
   * active threshold and creates a ColdChainAlert if the value is out of range.
   */
  fastify.post('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = logReadingBody.parse(request.body);
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;

    const shipment = await db.shipment.findFirst({
      where: { id: body.shipmentId, shopId },
      select: { id: true, isColdChain: true },
    });

    if (!shipment) {
      reply.status(404);
      return { data: null, error: { code: 'NOT_FOUND', message: 'Shipment not found' } };
    }

    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();

    const log = await db.temperatureLog.create({
      data: {
        shipmentId: body.shipmentId,
        shopId,
        vehicleId: body.vehicleId ?? null,
        temperature: body.temperature,
        unit: body.unit,
        source: body.source,
        gpsLat: body.gpsLat ?? null,
        gpsLng: body.gpsLng ?? null,
        recordedAt,
      },
      select: { id: true, temperature: true, unit: true, recordedAt: true },
    });

    // Check thresholds and raise alert if breached
    const threshold = await db.coldChainThreshold.findFirst({
      where: { shopId, isActive: true, alertOnBreach: true },
      orderBy: [{ category: 'asc' }], // prefer "default"
    });

    let alert = null;
    if (threshold) {
      const tempCelsius = toCelsius(Number(body.temperature), body.unit);
      const minCelsius = toCelsius(Number(threshold.minTemp), threshold.unit);
      const maxCelsius = toCelsius(Number(threshold.maxTemp), threshold.unit);

      let breachType: string | null = null;
      if (tempCelsius < minCelsius) breachType = 'TOO_LOW';
      else if (tempCelsius > maxCelsius) breachType = 'TOO_HIGH';

      if (breachType) {
        alert = await db.coldChainAlert.create({
          data: {
            shipmentId: body.shipmentId,
            shopId,
            temperature: body.temperature,
            minTemp: threshold.minTemp,
            maxTemp: threshold.maxTemp,
            unit: body.unit,
            breachType,
          },
          select: { id: true, breachType: true },
        });
      }
    }

    return reply.status(201).send({ data: { log, alert } });
  });

  /**
   * GET /shipments/:shipmentId/logs
   * Temperature reading history for a single shipment, newest-first.
   */
  fastify.get('/shipments/:shipmentId/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;
    const { shipmentId } = request.params as { shipmentId: string };
    const q = paginationQuery.parse(request.query);

    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, shopId },
      select: { id: true },
    });

    if (!shipment) {
      reply.status(404);
      return { data: null, error: { code: 'NOT_FOUND', message: 'Shipment not found' } };
    }

    const skip = (q.page - 1) * q.limit;
    const [logs, total] = await Promise.all([
      db.temperatureLog.findMany({
        where: { shipmentId, shopId },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: q.limit,
        select: {
          id: true, temperature: true, unit: true, source: true,
          gpsLat: true, gpsLng: true, recordedAt: true, vehicleId: true,
        },
      }),
      db.temperatureLog.count({ where: { shipmentId, shopId } }),
    ]);

    return reply.send({
      data: logs,
      pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    });
  });

  /**
   * GET /alerts
   * List breach alerts for the shop, filtered by resolved status.
   */
  fastify.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;
    const q = paginationQuery.parse(request.query);

    const resolvedFilter =
      q.resolved === 'true' ? { not: null } :
      q.resolved === 'false' ? null :
      undefined;

    const where: any = { shopId };
    if (q.resolved !== 'all') {
      where.resolvedAt = resolvedFilter;
    }

    const skip = (q.page - 1) * q.limit;
    const [alerts, total] = await Promise.all([
      db.coldChainAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
        select: {
          id: true, shipmentId: true, temperature: true, minTemp: true, maxTemp: true,
          unit: true, breachType: true, resolvedAt: true, resolvedBy: true, createdAt: true,
        },
      }),
      db.coldChainAlert.count({ where }),
    ]);

    return reply.send({
      data: alerts,
      pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    });
  });

  /**
   * PATCH /alerts/:alertId/resolve
   * Mark a breach alert as resolved.
   */
  fastify.patch('/alerts/:alertId/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId: string = (request as any).shopId;
    const userId: string = (request as any).auth?.userId;
    const db: any = (request as any).tenantDb;
    const { alertId } = request.params as { alertId: string };

    const alert = await db.coldChainAlert.findFirst({
      where: { id: alertId, shopId },
      select: { id: true, resolvedAt: true },
    });

    if (!alert) {
      reply.status(404);
      return { data: null, error: { code: 'NOT_FOUND', message: 'Alert not found' } };
    }

    if (alert.resolvedAt) {
      return reply.send({ data: { id: alertId, message: 'Alert already resolved' } });
    }

    const updated = await db.coldChainAlert.update({
      where: { id: alertId },
      data: { resolvedAt: new Date(), resolvedBy: userId },
      select: { id: true, resolvedAt: true, resolvedBy: true },
    });

    return reply.send({ data: updated });
  });

  /**
   * GET /thresholds
   * Return all threshold configs for this shop.
   */
  fastify.get('/thresholds', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;

    const thresholds = await db.coldChainThreshold.findMany({
      where: { shopId },
      orderBy: { category: 'asc' },
    });

    return reply.send({ data: thresholds });
  });

  /**
   * PUT /thresholds/:category
   * Upsert a threshold for a product category (use "default" for catch-all).
   */
  fastify.put('/thresholds/:category', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;
    const { category } = request.params as { category: string };
    const body = upsertThresholdBody.parse(request.body);

    if (body.minTemp >= body.maxTemp) {
      reply.status(422);
      return { data: null, error: { code: 'INVALID_RANGE', message: 'minTemp must be less than maxTemp' } };
    }

    const threshold = await db.coldChainThreshold.upsert({
      where: { shopId_category: { shopId, category } },
      create: { shopId, category, ...body },
      update: { ...body, updatedAt: new Date() },
    });

    return reply.send({ data: threshold });
  });
}

export default coldChainRoutes;
