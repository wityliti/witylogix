/**
 * Delivery Events API — batch event ingestion for driver offline sync
 *
 * POST /api/v4/deliveries/events/batch
 *
 * Accepts an ordered array of driver-submitted lifecycle events.
 * Enforces a server-side state machine, deduplicates by event id,
 * and stores events for SLA auditing.
 *
 * WIT-141: failed_delivery events create a DeliveryAttempt record and
 * advance the shipment to FAILED_ATTEMPT (retries remaining) or FAILED
 * (max attempts exhausted, auto-return job enqueued).
 *
 * Part of WIT-127 / WIT-94 Driver App Offline Mode Phase 1 MVP.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { batchDeliveryEventsSchema, failedDeliveryPayloadSchema } from '@witylogix/validators';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { getFailedDeliveryQueue } from '../lib/queue.js';
import type { DeliveryEventResult } from '@witylogix/types';

// ── State Machine ─────────────────────────────────────────────────────────────

/** Prisma ShipmentStatus values that accept no further transitions */
const TERMINAL_STATUSES = new Set(['DELIVERED', 'FAILED']);

/**
 * Valid forward transitions.
 * FAILED_ATTEMPT (WIT-141): retries remaining — driver retries via out_for_delivery.
 */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  PICKED_UP: new Set(['IN_TRANSIT']),
  IN_TRANSIT: new Set(['OUT_FOR_DELIVERY']),
  OUT_FOR_DELIVERY: new Set(['DELIVERED', 'FAILED', 'FAILED_ATTEMPT']),
  FAILED_ATTEMPT: new Set(['OUT_FOR_DELIVERY', 'FAILED', 'FAILED_ATTEMPT']),
  // Allow re-submission of same state (idempotent re-delivery of events)
  DELIVERED: new Set(),
  FAILED: new Set(),
  // Pre-pickup statuses that can accept picked_up
  PENDING: new Set(['PICKED_UP']),
  PROCESSING: new Set(['PICKED_UP']),
  READY_FOR_PICKUP: new Set(['PICKED_UP']),
  ASSIGNED: new Set(['PICKED_UP']),
};

/** Map client eventType → Prisma ShipmentStatus (failed_delivery resolved per-event) */
const EVENT_TYPE_TO_STATUS: Record<string, string> = {
  picked_up: 'PICKED_UP',
  in_transit: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  // failed_delivery is handled separately — status depends on attempt count
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

    // Fetch shop config for retry limit (WIT-141)
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { maxDeliveryAttempts: true },
    });
    const maxDeliveryAttempts: number = shop?.maxDeliveryAttempts ?? 3;

    // Sort all events by deviceCapturedAt ascending, grouping per delivery
    const sorted = [...events].sort(
      (a, b) => new Date(a.deviceCapturedAt).getTime() - new Date(b.deviceCapturedAt).getTime(),
    );

    // Collect all unique deliveryIds so we can fetch them in one query
    const deliveryIds = [...new Set(sorted.map((e) => e.deliveryId))];

    // Load current shipment state for all referenced deliveries in one round-trip
    const shipments: Array<{
      id: string;
      status: string;
      shopId: string;
      attemptCount: number;
      driverId: string | null;
    }> = await db.shipment.findMany({
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

    // In-memory running state so we can apply multiple events per delivery
    // within the same batch without re-querying
    const runningState = new Map<string, string>(
      shipments.map((s) => [s.id, s.status]),
    );
    // Track attempt counts in-memory for multi-failed_delivery batches
    const runningAttemptCount = new Map<string, number>(
      shipments.map((s) => [s.id, s.attemptCount]),
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

      // ── failed_delivery: structured retry logic (WIT-141) ─────────────────
      if (event.eventType === 'failed_delivery') {
        // Validate payload contains required failureReason
        const payloadParsed = failedDeliveryPayloadSchema.safeParse(event.payload);
        if (!payloadParsed.success) {
          results.push({
            id: event.id,
            status: 'error',
            message: `Invalid failed_delivery payload: failureReason is required (nobody_home|address_not_found|refused|access_denied|other)`,
          });
          continue;
        }

        // Verify source state allows a failure transition
        const allowedFromCurrent = VALID_TRANSITIONS[currentStatus];
        if (
          !allowedFromCurrent ||
          (!allowedFromCurrent.has('FAILED') && !allowedFromCurrent.has('FAILED_ATTEMPT'))
        ) {
          results.push({
            id: event.id,
            status: 'conflict',
            currentDeliveryStatus: STATUS_TO_CLIENT[currentStatus] ?? currentStatus.toLowerCase(),
            message: `Invalid transition from ${STATUS_TO_CLIENT[currentStatus] ?? currentStatus} via ${event.eventType}`,
          });
          continue;
        }

        const currentAttempts = runningAttemptCount.get(event.deliveryId)!;
        const newAttemptCount = currentAttempts + 1;
        const targetStatus = newAttemptCount >= maxDeliveryAttempts ? 'FAILED' : 'FAILED_ATTEMPT';
        const { failureReason, note, photoUrl } = payloadParsed.data;

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
              status: targetStatus,
              attemptCount: newAttemptCount,
              lastFailureReason: failureReason,
            },
          }),
        ]);

        // Enqueue auto-return job when max attempts exhausted
        if (targetStatus === 'FAILED') {
          await getFailedDeliveryQueue().add(
            'auto-return',
            { shopId, shipmentId: event.deliveryId, attemptCount: newAttemptCount },
            { jobId: `auto-return:${event.deliveryId}`, delay: 0 },
          );
        }

        runningState.set(event.deliveryId, targetStatus);
        runningAttemptCount.set(event.deliveryId, newAttemptCount);
        results.push({ id: event.id, status: 'accepted' });
        continue;
      }
      // ── end failed_delivery handling ───────────────────────────────────────

      // Generic state machine transition check
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
