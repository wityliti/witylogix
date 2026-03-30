/**
 * Delivery Events API — batch event ingestion for driver offline sync
 *
 * POST /api/v4/deliveries/events/batch
 *
 * Accepts an ordered array of driver-submitted lifecycle events.
 * Enforces a server-side state machine, deduplicates by event id,
 * and stores events for SLA auditing.
 *
 * Part of WIT-127 / WIT-94 Driver App Offline Mode Phase 1 MVP.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { batchDeliveryEventsSchema } from '@witylogix/validators';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import type { DeliveryEventResult } from '@witylogix/types';

// ── State Machine ─────────────────────────────────────────────────────────────

/** Prisma ShipmentStatus values used for delivery lifecycle */
const TERMINAL_STATUSES = new Set(['DELIVERED', 'FAILED']);

/**
 * Valid forward transitions.
 * null key = any non-terminal status may accept picked_up (first event after assignment).
 */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  PICKED_UP: new Set(['IN_TRANSIT']),
  IN_TRANSIT: new Set(['OUT_FOR_DELIVERY']),
  OUT_FOR_DELIVERY: new Set(['DELIVERED', 'FAILED']),
  // Allow re-submission of same state (idempotent re-delivery of events)
  DELIVERED: new Set(),
  FAILED: new Set(),
  // Pre-pickup statuses that can accept picked_up
  PENDING: new Set(['PICKED_UP']),
  PROCESSING: new Set(['PICKED_UP']),
  READY_FOR_PICKUP: new Set(['PICKED_UP']),
  ASSIGNED: new Set(['PICKED_UP']),
};

/** Map client eventType → Prisma ShipmentStatus */
const EVENT_TYPE_TO_STATUS: Record<string, string> = {
  picked_up: 'PICKED_UP',
  in_transit: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  failed_delivery: 'FAILED',
};

/** Map Prisma ShipmentStatus → client-facing string */
const STATUS_TO_CLIENT: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  FAILED: 'failed_delivery',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

// ── Route ─────────────────────────────────────────────────────────────────────

async function deliveryEventsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  /**
   * POST /events/batch
   *
   * Body: { events: DeliveryEventInput[] }
   * Returns: { results: DeliveryEventResult[] }
   */
  fastify.post('/events/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = batchDeliveryEventsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const { events } = parsed.data;
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;

    // Sort all events by deviceCapturedAt ascending, grouping per delivery
    const sorted = [...events].sort(
      (a, b) => new Date(a.deviceCapturedAt).getTime() - new Date(b.deviceCapturedAt).getTime(),
    );

    // Collect all unique deliveryIds so we can fetch them in one query
    const deliveryIds = [...new Set(sorted.map((e) => e.deliveryId))];

    // Load current shipment state for all referenced deliveries in one round-trip
    const shipments: Array<{ id: string; status: string; shopId: string }> =
      await db.shipment.findMany({
        where: { id: { in: deliveryIds }, shopId },
        select: { id: true, status: true, shopId: true },
      });

    const shipmentMap = new Map(shipments.map((s) => [s.id, s]));

    // Check which event ids already exist (idempotency deduplication)
    const eventIds = sorted.map((e) => e.id);
    const existing: Array<{ id: string }> = await db.deliveryEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));

    // In-memory running state so we can apply multiple events per delivery
    // within the same batch without re-querying
    const runningState = new Map<string, string>(
      shipments.map((s) => [s.id, s.status]),
    );

    const results: DeliveryEventResult[] = [];

    for (const event of sorted) {
      // Already processed — return accepted without re-processing
      if (existingIds.has(event.id)) {
        results.push({ id: event.id, status: 'accepted' });
        continue;
      }

      const shipment = shipmentMap.get(event.deliveryId);
      if (!shipment) {
        results.push({
          id: event.id,
          status: 'error',
          message: `Delivery ${event.deliveryId} not found`,
        });
        continue;
      }

      const currentStatus = runningState.get(event.deliveryId)!;
      const targetStatus = EVENT_TYPE_TO_STATUS[event.eventType];

      // Terminal state check
      if (TERMINAL_STATUSES.has(currentStatus)) {
        results.push({
          id: event.id,
          status: 'conflict',
          currentDeliveryStatus: STATUS_TO_CLIENT[currentStatus] ?? currentStatus.toLowerCase(),
          message: `Delivery is already in terminal state`,
        });
        continue;
      }

      // State machine transition check
      const allowed = VALID_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.has(targetStatus)) {
        results.push({
          id: event.id,
          status: 'conflict',
          currentDeliveryStatus: STATUS_TO_CLIENT[currentStatus] ?? currentStatus.toLowerCase(),
          message: `Invalid transition from ${STATUS_TO_CLIENT[currentStatus] ?? currentStatus} via ${event.eventType}`,
        });
        continue;
      }

      // Persist event and advance shipment status atomically
      await db.$transaction([
        db.deliveryEvent.create({
          data: {
            id: event.id,
            shopId,
            shipmentId: event.deliveryId,
            eventType: event.eventType,
            payload: event.payload ?? {},
            deviceCapturedAt: new Date(event.deviceCapturedAt),
            deviceTimezone: event.deviceTimezone,
            gpsLat: event.gpsLat ?? null,
            gpsLng: event.gpsLng ?? null,
          },
        }),
        db.shipment.update({
          where: { id: event.deliveryId },
          data: {
            status: targetStatus,
            ...(targetStatus === 'PICKED_UP' ? { pickedUpAt: new Date(event.deviceCapturedAt) } : {}),
            ...(targetStatus === 'DELIVERED' ? { actualDelivery: new Date(event.deviceCapturedAt) } : {}),
          },
        }),
      ]);

      // Advance in-memory state for subsequent events in same batch
      runningState.set(event.deliveryId, targetStatus);

      results.push({ id: event.id, status: 'accepted' });
    }

    return reply.status(207).send({ results });
  });
}

export default deliveryEventsRoutes;
