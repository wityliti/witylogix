/**
 * Cold-Chain Temperature Monitoring API — WIT-91
 *
 * POST   /cold-chain/readings                    — Ingest sensor reading(s)
 * GET    /cold-chain/shipments/:id/readings      — Temperature timeline
 * GET    /cold-chain/shipments/:id/alerts        — Alerts for shipment
 * POST   /cold-chain/thresholds                  — Create threshold rule
 * GET    /cold-chain/thresholds                  — List threshold rules
 * PATCH  /cold-chain/thresholds/:id              — Update threshold rule
 * DELETE /cold-chain/thresholds/:id              — Deactivate threshold rule
 * PATCH  /cold-chain/alerts/:id/acknowledge      — Acknowledge an alert
 *
 * Real-time: readings are broadcast on `cold-chain:<shipmentId>` via the
 * existing WebSocket broadcast mechanism (fastify.broadcast).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

// ─── VALIDATION ───────────────────────────────────────────────

const readingSchema = z.object({
  shipmentId: z.string().uuid(),
  temperature: z.number().finite(),
  unit: z.enum(['CELSIUS', 'FAHRENHEIT']).default('CELSIUS'),
  sensorId: z.string().max(100).optional(),
  vehicleId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  recordedAt: z.string().datetime().optional(), // ISO-8601; defaults to now()
});

const batchReadingSchema = z.object({
  readings: z.array(readingSchema).min(1).max(100),
});

const thresholdCreateSchema = z.object({
  name: z.string().min(1).max(200),
  shipmentType: z.string().max(100).optional(),
  minTemp: z.number().finite(),
  maxTemp: z.number().finite(),
  unit: z.enum(['CELSIUS', 'FAHRENHEIT']).default('CELSIUS'),
  gracePeriodMinutes: z.number().int().min(0).max(60).default(2),
  alertContacts: z
    .array(
      z.object({
        type: z.enum(['email', 'sms']),
        value: z.string().min(1),
      }),
    )
    .default([]),
});

const thresholdUpdateSchema = thresholdCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const acknowledgeSchema = z.object({
  notes: z.string().max(1000).optional(),
});

const readingQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  breachedOnly: z.enum(['true', 'false']).optional(),
});

const alertQuerySchema = z.object({
  acknowledged: z.enum(['true', 'false']).optional(),
  severity: z.enum(['WARNING', 'CRITICAL']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// ─── HELPERS ─────────────────────────────────────────────────

/** Convert temperature to Celsius for threshold comparison. */
function toCelsius(value: number, unit: 'CELSIUS' | 'FAHRENHEIT'): number {
  return unit === 'FAHRENHEIT' ? (value - 32) * (5 / 9) : value;
}

/**
 * Find the active threshold for a shop, optionally matched to shipmentType.
 * Prefers the most specific match (with matching shipmentType), then falls
 * back to the general (null shipmentType) rule.
 */
async function findActiveThreshold(
  db: any,
  shopId: string,
  shipmentType?: string | null,
): Promise<any | null> {
  const thresholds = await db.coldChainThreshold.findMany({
    where: { shopId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!thresholds.length) return null;

  const specific = shipmentType
    ? thresholds.find((t: any) => t.shipmentType === shipmentType)
    : null;
  const fallback = thresholds.find((t: any) => !t.shipmentType) ?? null;

  return specific ?? fallback;
}

/**
 * Check whether a temperature reading breaches the threshold
 * (after normalising both to Celsius).
 */
function isBreach(
  readingTemp: number,
  readingUnit: 'CELSIUS' | 'FAHRENHEIT',
  threshold: { minTemp: any; maxTemp: any; unit: string },
): boolean {
  const readingC = toCelsius(readingTemp, readingUnit);
  const minC = toCelsius(
    Number(threshold.minTemp),
    threshold.unit as 'CELSIUS' | 'FAHRENHEIT',
  );
  const maxC = toCelsius(
    Number(threshold.maxTemp),
    threshold.unit as 'CELSIUS' | 'FAHRENHEIT',
  );
  return readingC < minC || readingC > maxC;
}

// ─── ROUTE HANDLER ───────────────────────────────────────────

async function coldChainRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── POST /readings ─────────────────────────────────────────
  // Accept a batch of sensor readings. For each reading that breaches
  // the active threshold, create a ColdChainAlert and broadcast via WS.
  fastify.post(
    '/readings',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;

      const body = batchReadingSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError(body.error.issues[0]?.message ?? 'Invalid body');
      }

      const { readings } = body.data;

      // Verify all referenced shipments belong to this shop
      const shipmentIds = [...new Set(readings.map((r) => r.shipmentId))];
      const shipments = await db.shipment.findMany({
        where: { id: { in: shipmentIds }, shopId },
        select: { id: true, isColdChain: true, status: true },
      });
      const shipmentMap = new Map(shipments.map((s: any) => [s.id, s]));

      const missingId = shipmentIds.find((id) => !shipmentMap.has(id));
      if (missingId) {
        throw new NotFoundError(`Shipment ${missingId} not found`);
      }

      const createdLogs: any[] = [];

      for (const r of readings) {
        const recordedAt = r.recordedAt ? new Date(r.recordedAt) : new Date();

        // Determine breach
        const threshold = await findActiveThreshold(db, shopId);
        const breached = threshold ? isBreach(r.temperature, r.unit, threshold) : false;

        const log = await db.temperatureLog.create({
          data: {
            shopId,
            shipmentId: r.shipmentId,
            vehicleId: r.vehicleId ?? null,
            temperature: r.temperature,
            unit: r.unit,
            sensorId: r.sensorId ?? null,
            latitude: r.latitude ?? null,
            longitude: r.longitude ?? null,
            breached,
            recordedAt,
          },
        });

        createdLogs.push(log);

        // Create alert if threshold was breached
        if (breached && threshold) {
          await db.coldChainAlert.create({
            data: {
              shopId,
              shipmentId: r.shipmentId,
              thresholdId: threshold.id,
              logId: log.id,
              actualTemp: r.temperature,
              minTemp: threshold.minTemp,
              maxTemp: threshold.maxTemp,
              unit: r.unit,
              severity: 'CRITICAL',
            },
          });
        }

        // Broadcast real-time reading
        if ((fastify as any).broadcast) {
          (fastify as any).broadcast(
            `cold-chain:${r.shipmentId}`,
            'temperature_reading',
            {
              logId: log.id,
              shipmentId: r.shipmentId,
              temperature: r.temperature,
              unit: r.unit,
              breached,
              recordedAt: recordedAt.toISOString(),
              sensorId: r.sensorId ?? null,
            },
          );
        }
      }

      reply.status(201).send({ created: createdLogs.length, logs: createdLogs });
    },
  );

  // ── GET /shipments/:id/readings ────────────────────────────
  fastify.get(
    '/shipments/:id/readings',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { id } = request.params as { id: string };

      const query = readingQuerySchema.safeParse(request.query);
      if (!query.success) {
        throw new ValidationError(query.error.issues[0]?.message ?? 'Invalid query');
      }

      const { startDate, endDate, page, limit, breachedOnly } = query.data;
      const skip = (page - 1) * limit;

      // Verify shipment ownership
      const shipment = await db.shipment.findFirst({
        where: { id, shopId },
        select: { id: true, isColdChain: true, shipmentNumber: true },
      });
      if (!shipment) throw new NotFoundError('Shipment not found');

      const where: any = { shipmentId: id, shopId };
      if (startDate) where.recordedAt = { ...where.recordedAt, gte: new Date(startDate) };
      if (endDate) where.recordedAt = { ...where.recordedAt, lte: new Date(endDate) };
      if (breachedOnly === 'true') where.breached = true;

      const [logs, total] = await Promise.all([
        db.temperatureLog.findMany({
          where,
          orderBy: { recordedAt: 'asc' },
          skip,
          take: limit,
          select: {
            id: true,
            temperature: true,
            unit: true,
            sensorId: true,
            latitude: true,
            longitude: true,
            breached: true,
            recordedAt: true,
          },
        }),
        db.temperatureLog.count({ where }),
      ]);

      reply.send({
        shipment: {
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          isColdChain: shipment.isColdChain,
        },
        readings: logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    },
  );

  // ── GET /shipments/:id/alerts ──────────────────────────────
  fastify.get(
    '/shipments/:id/alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { id } = request.params as { id: string };

      const query = alertQuerySchema.safeParse(request.query);
      if (!query.success) {
        throw new ValidationError(query.error.issues[0]?.message ?? 'Invalid query');
      }

      const { acknowledged, severity, page, limit } = query.data;
      const skip = (page - 1) * limit;

      const shipment = await db.shipment.findFirst({
        where: { id, shopId },
        select: { id: true },
      });
      if (!shipment) throw new NotFoundError('Shipment not found');

      const where: any = { shipmentId: id, shopId };
      if (acknowledged !== undefined) where.acknowledged = acknowledged === 'true';
      if (severity) where.severity = severity;

      const [alerts, total] = await Promise.all([
        db.coldChainAlert.findMany({
          where,
          orderBy: { triggeredAt: 'desc' },
          skip,
          take: limit,
        }),
        db.coldChainAlert.count({ where }),
      ]);

      reply.send({
        alerts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    },
  );

  // ── POST /thresholds ───────────────────────────────────────
  fastify.post(
    '/thresholds',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;

      const body = thresholdCreateSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError(body.error.issues[0]?.message ?? 'Invalid body');
      }

      if (body.data.minTemp >= body.data.maxTemp) {
        throw new ValidationError('minTemp must be less than maxTemp');
      }

      const threshold = await db.coldChainThreshold.create({
        data: {
          shopId,
          name: body.data.name,
          shipmentType: body.data.shipmentType ?? null,
          minTemp: body.data.minTemp,
          maxTemp: body.data.maxTemp,
          unit: body.data.unit,
          gracePeriodMinutes: body.data.gracePeriodMinutes,
          alertContacts: body.data.alertContacts,
        },
      });

      reply.status(201).send(threshold);
    },
  );

  // ── GET /thresholds ────────────────────────────────────────
  fastify.get(
    '/thresholds',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;

      const query = request.query as any;
      const isActive = query.isActive === 'false' ? false : undefined; // default: all active

      const thresholds = await db.coldChainThreshold.findMany({
        where: { shopId, ...(isActive !== undefined ? { isActive } : {}) },
        orderBy: { createdAt: 'desc' },
      });

      reply.send({ thresholds });
    },
  );

  // ── PATCH /thresholds/:id ──────────────────────────────────
  fastify.patch(
    '/thresholds/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { id } = request.params as { id: string };

      const existing = await db.coldChainThreshold.findFirst({
        where: { id, shopId },
      });
      if (!existing) throw new NotFoundError('Threshold not found');

      const body = thresholdUpdateSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError(body.error.issues[0]?.message ?? 'Invalid body');
      }

      const { minTemp, maxTemp } = body.data;
      const effectiveMin = minTemp ?? Number(existing.minTemp);
      const effectiveMax = maxTemp ?? Number(existing.maxTemp);
      if (effectiveMin >= effectiveMax) {
        throw new ValidationError('minTemp must be less than maxTemp');
      }

      const updated = await db.coldChainThreshold.update({
        where: { id },
        data: {
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.shipmentType !== undefined && { shipmentType: body.data.shipmentType }),
          ...(minTemp !== undefined && { minTemp }),
          ...(maxTemp !== undefined && { maxTemp }),
          ...(body.data.unit !== undefined && { unit: body.data.unit }),
          ...(body.data.gracePeriodMinutes !== undefined && {
            gracePeriodMinutes: body.data.gracePeriodMinutes,
          }),
          ...(body.data.alertContacts !== undefined && {
            alertContacts: body.data.alertContacts,
          }),
          ...(body.data.isActive !== undefined && { isActive: body.data.isActive }),
        },
      });

      reply.send(updated);
    },
  );

  // ── DELETE /thresholds/:id ─────────────────────────────────
  // Soft-delete: sets isActive = false. Historical alerts are preserved.
  fastify.delete(
    '/thresholds/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { id } = request.params as { id: string };

      const existing = await db.coldChainThreshold.findFirst({
        where: { id, shopId },
      });
      if (!existing) throw new NotFoundError('Threshold not found');

      await db.coldChainThreshold.update({
        where: { id },
        data: { isActive: false },
      });

      reply.status(204).send();
    },
  );

  // ── PATCH /alerts/:id/acknowledge ─────────────────────────
  fastify.patch(
    '/alerts/:id/acknowledge',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { id } = request.params as { id: string };

      const alert = await db.coldChainAlert.findFirst({
        where: { id, shopId },
      });
      if (!alert) throw new NotFoundError('Alert not found');
      if (alert.acknowledged) {
        reply.send(alert);
        return;
      }

      const body = acknowledgeSchema.safeParse(request.body);
      if (!body.success) {
        throw new ValidationError(body.error.issues[0]?.message ?? 'Invalid body');
      }

      const userId = (request as any).auth?.userId ?? null;

      const updated = await db.coldChainAlert.update({
        where: { id },
        data: {
          acknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
          notes: body.data.notes ?? null,
        },
      });

      reply.send(updated);
    },
  );
}

export default coldChainRoutes;
