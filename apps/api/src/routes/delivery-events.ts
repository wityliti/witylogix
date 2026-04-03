/**
 * Delivery Events API — batch event ingestion for driver offline sync
 *
 * POST /api/v4/deliveries/events/batch
 *
 * Accepts an ordered array of driver-submitted lifecycle events.
 * Enforces a server-side state machine, deduplicates by event id,
 * and stores events for SLA auditing.
 *
 * WIT-127: Initial batch ingest + state machine.
 * WIT-141: failed_delivery extended with structured retry logic, DeliveryAttempt
 *          creation, and auto-return BullMQ job after max attempts exhausted.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { batchDeliveryEventsSchema, failedDeliveryPayloadSchema } from '@witylogix/validators';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { getFailedDeliveryQueue } from '../lib/queue.js';
import type { DeliveryEventResult } from '@witylogix/types';

// ── State Machine ─────────────────────────────────────────────────────────────

/**
 * Terminal statuses — no further transitions allowed.
 * FAILED_ATTEMPT is NOT terminal; it can receive picked_up for retry.
 */
const TERMINAL_STATUSES = new Set(['DELIVERED', 'FAILED']);

/**
 * Valid forward transitions.
 * FAILED_ATTEMPT accepts picked_up so the driver can re-attempt delivery.
 */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  PICKED_UP: new Set(['IN_TRANSIT']),
  IN_TRANSIT: new Set(['OUT_FOR_DELIVERY']),
  OUT_FOR_DELIVERY: new Set(['ARRIVED', 'DELIVERED', 'FAILED', 'FAILED_ATTEMPT']),
  ARRIVED: new Set(['DELIVERED', 'FAILED', 'FAILED_ATTEMPT']), // WIT-140: geofence auto-event
  FAILED_ATTEMPT: new Set(['PICKED_UP']), // retry: driver re-picks up
  // Terminal — no further transitions
  DELIVERED: new Set(),
  FAILED: new Set(),
  // Pre-pickup statuses that can accept picked_up
  PENDING: new Set(['PICKED_UP']),
  PROCESSING: new Set(['PICKED_UP']),
  READY_FOR_PICKUP: new Set(['PICKED_UP']),
  ASSIGNED: new Set(['PICKED_UP']),
};

/** Map client eventType → Prisma ShipmentStatus (static mapping for non-failed events) */
const EVENT_TYPE_TO_STATUS: Record<string, string> = {
  picked_up: 'PICKED_UP',
  in_transit: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  arrived: 'ARRIVED', // WIT-140: geofence auto-event
  delivered: 'DELIVERED',
  // failed_delivery is resolved dynamically based on attempt count (see handler below)
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
  FAILED_ATTEMPT: 'failed_attempt',
  FAILED: 'failed_delivery',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

const DEFAULT_MAX_ATTEMPTS = 3;

// ── Route ─────────────────────────────────────────────────────────────────────

async function deliveryEventsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  /**
   * POST /events/batch
   *
   * Body: { events: DeliveryEventInput[] }
   * Returns: { results: DeliveryEventResult[] }
   *
   * For failed_delivery events the payload must contain:
   *   { failureReason: 'nobody_home' | 'address_not_found' | 'refused' | 'access_denied' | 'other',
   *     note?: string, photoUrl?: string }
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

    // Load current shipment state — include attemptCount and driverId for WIT-141
    const shipments: Array<{ id: string; status: string; shopId: string; attemptCount: number; driverId: string | null }> =
      await db.shipment.findMany({
        where: { id: { in: deliveryIds }, shopId },
        select: { id: true, status: true, shopId: true, attemptCount: true, driverId: true },
      });

    const shipmentMap = new Map(shipments.map((s) => [s.id, s]));

    // Check which event ids already exist (idempotency deduplication)
    const eventIds = sorted.map((e) => e.id);
    const existing: Array<{ id: string }> = await db.deliveryEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));

    // Fetch shop's maxDeliveryAttempts once if batch contains any failed_delivery events
    let maxDeliveryAttempts = DEFAULT_MAX_ATTEMPTS;
    if (sorted.some((e) => e.eventType === 'failed_delivery')) {
      const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: { maxDeliveryAttempts: true },
      });
      if (shop?.maxDeliveryAttempts != null) {
        maxDeliveryAttempts = shop.maxDeliveryAttempts;
      }
    }

    // In-memory running state per delivery (avoids re-querying within the same batch)
    const runningState = new Map<string, string>(shipments.map((s) => [s.id, s.status]));
    const runningAttemptCount = new Map<string, number>(shipments.map((s) => [s.id, s.attemptCount]));

    const results: DeliveryEventResult[] = [];

    for (const event of sorted) {
      // Already processed — idempotent accept
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

      // ── failed_delivery: retry / auto-return logic (WIT-141) ─────────────────
      if (event.eventType === 'failed_delivery') {
        // Validate structured payload
        const payloadParsed = failedDeliveryPayloadSchema.safeParse(event.payload);
        if (!payloadParsed.success) {
          results.push({
            id: event.id,
            status: 'error',
            message: `failed_delivery requires payload.failureReason: nobody_home | address_not_found | refused | access_denied | other`,
          });
          continue;
        }

        // Source must be OUT_FOR_DELIVERY or FAILED_ATTEMPT (retry that fails again)
        if (currentStatus !== 'OUT_FOR_DELIVERY' && currentStatus !== 'FAILED_ATTEMPT') {
          results.push({
            id: event.id,
            status: 'conflict',
            currentDeliveryStatus: STATUS_TO_CLIENT[currentStatus] ?? currentStatus.toLowerCase(),
            message: `Invalid transition from ${STATUS_TO_CLIENT[currentStatus] ?? currentStatus} via failed_delivery`,
          });
          continue;
        }

        const { failureReason, note, photoUrl } = payloadParsed.data;
        const currentAttemptCount = runningAttemptCount.get(event.deliveryId) ?? 0;
        const newAttemptCount = currentAttemptCount + 1;
        const retriesExhausted = newAttemptCount >= maxDeliveryAttempts;
        const newStatus = retriesExhausted ? 'FAILED' : 'FAILED_ATTEMPT';

        // Persist atomically: DeliveryEvent + DeliveryAttempt + Shipment update
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
          db.deliveryAttempt.create({
            data: {
              shipmentId: event.deliveryId,
              shopId,
              attemptNumber: newAttemptCount,
              failureReason,
              failedAt: new Date(event.deviceCapturedAt),
              photoUrl: photoUrl ?? null,
              driverId: shipment.driverId ?? null,
              notes: note ?? null,
            },
          }),
          db.shipment.update({
            where: { id: event.deliveryId },
            data: {
              status: newStatus,
              attemptCount: newAttemptCount,
              lastFailureReason: failureReason,
            },
          }),
        ]);

        // Enqueue auto-return job when all retries exhausted
        if (retriesExhausted) {
          try {
            await getFailedDeliveryQueue().add('auto-return', {
              shipmentId: event.deliveryId,
              shopId,
              failureReason,
              attemptCount: newAttemptCount,
            });
          } catch (err) {
            // Non-fatal — dashboard allows manual return trigger as fallback
            fastify.log.error(
              `[WIT-141] Failed to enqueue auto-return for shipment ${event.deliveryId}: ${(err as Error).message}`,
            );
          }
        }

        runningState.set(event.deliveryId, newStatus);
        runningAttemptCount.set(event.deliveryId, newAttemptCount);
        results.push({ id: event.id, status: 'accepted' });
        continue;
      }

      // ── Standard event: state machine transition ───────────────────────────────
      const targetStatus = EVENT_TYPE_TO_STATUS[event.eventType];
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

      runningState.set(event.deliveryId, targetStatus);
      results.push({ id: event.id, status: 'accepted' });
    }

    return reply.status(207).send({ results });
  });
}

export default deliveryEventsRoutes;
