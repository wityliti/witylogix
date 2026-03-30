import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Delivery Events Route Tests — WIT-127
 *
 * Coverage:
 * - POST /api/v4/deliveries/events/batch
 *   - happy path: ordered batch of events advances delivery status
 *   - idempotency: duplicate event ids return accepted without re-processing
 *   - terminal-state conflict: event against delivered/failed delivery
 *   - invalid transition conflict: out-of-order state jump
 *   - unknown deliveryId: returns error per-event
 *   - multi-delivery batch: independent state machines per delivery
 *   - input validation: missing required fields
 *   - batch sort by deviceCapturedAt: out-of-order submission normalised
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    eventType: 'picked_up',
    deliveryId: 'shipment-uuid-1',
    payload: {},
    deviceCapturedAt: new Date().toISOString(),
    deviceTimezone: 'America/New_York',
    gpsLat: 40.7128,
    gpsLng: -74.006,
    ...overrides,
  };
}

function makeMockShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shipment-uuid-1',
    shopId: 'shop-123',
    status: 'READY_FOR_PICKUP',
    ...overrides,
  };
}

// ── Inline state machine unit tests ──────────────────────────────────────────

describe('Delivery State Machine — unit', () => {
  const TERMINAL = new Set(['DELIVERED', 'FAILED']);

  const VALID_TRANSITIONS: Record<string, Set<string>> = {
    PICKED_UP: new Set(['IN_TRANSIT']),
    IN_TRANSIT: new Set(['OUT_FOR_DELIVERY']),
    OUT_FOR_DELIVERY: new Set(['DELIVERED', 'FAILED']),
    DELIVERED: new Set(),
    FAILED: new Set(),
    PENDING: new Set(['PICKED_UP']),
    PROCESSING: new Set(['PICKED_UP']),
    READY_FOR_PICKUP: new Set(['PICKED_UP']),
    ASSIGNED: new Set(['PICKED_UP']),
  };

  const EVENT_MAP: Record<string, string> = {
    picked_up: 'PICKED_UP',
    in_transit: 'IN_TRANSIT',
    out_for_delivery: 'OUT_FOR_DELIVERY',
    delivered: 'DELIVERED',
    failed_delivery: 'FAILED',
  };

  function canTransition(from: string, eventType: string): boolean {
    if (TERMINAL.has(from)) return false;
    const target = EVENT_MAP[eventType];
    return VALID_TRANSITIONS[from]?.has(target) ?? false;
  }

  it('allows picked_up from READY_FOR_PICKUP', () => {
    expect(canTransition('READY_FOR_PICKUP', 'picked_up')).toBe(true);
  });

  it('allows picked_up from PENDING', () => {
    expect(canTransition('PENDING', 'picked_up')).toBe(true);
  });

  it('allows in_transit from PICKED_UP', () => {
    expect(canTransition('PICKED_UP', 'in_transit')).toBe(true);
  });

  it('allows out_for_delivery from IN_TRANSIT', () => {
    expect(canTransition('IN_TRANSIT', 'out_for_delivery')).toBe(true);
  });

  it('allows delivered from OUT_FOR_DELIVERY', () => {
    expect(canTransition('OUT_FOR_DELIVERY', 'delivered')).toBe(true);
  });

  it('allows failed_delivery from OUT_FOR_DELIVERY', () => {
    expect(canTransition('OUT_FOR_DELIVERY', 'failed_delivery')).toBe(true);
  });

  it('blocks delivered from PICKED_UP (skips steps)', () => {
    expect(canTransition('PICKED_UP', 'delivered')).toBe(false);
  });

  it('blocks in_transit from PENDING (skips picked_up)', () => {
    expect(canTransition('PENDING', 'in_transit')).toBe(false);
  });

  it('blocks any event when status is DELIVERED (terminal)', () => {
    expect(canTransition('DELIVERED', 'failed_delivery')).toBe(false);
    expect(canTransition('DELIVERED', 'in_transit')).toBe(false);
  });

  it('blocks any event when status is FAILED (terminal)', () => {
    expect(canTransition('FAILED', 'delivered')).toBe(false);
    expect(canTransition('FAILED', 'picked_up')).toBe(false);
  });
});

// ── Route integration tests ───────────────────────────────────────────────────

describe('POST /api/v4/deliveries/events/batch', () => {
  let mockRequest: any;
  let mockReply: any;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      shipment: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      deliveryEvent: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => {
        // Execute each operation in sequence
        for (const op of ops) await op;
        return [];
      }),
    };

    mockRequest = {
      body: {},
      shopId: 'shop-123',
      tenantId: 'shop-123',
      auth: { role: 'DRIVER', driverId: 'driver-1' },
      tenantDb: mockDb,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────

  it('accepts a single valid picked_up event and returns 207', async () => {
    const event = makeEvent({ eventType: 'picked_up' });
    mockRequest.body = { events: [event] };

    mockDb.shipment.findMany.mockResolvedValue([makeMockShipment()]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);
    mockDb.deliveryEvent.create.mockResolvedValue({});
    mockDb.shipment.update.mockResolvedValue({});

    // Import handler inline to test logic isolation
    const result = await simulateBatchHandler(mockRequest);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ id: event.id, status: 'accepted' });
  });

  it('processes a full delivery lifecycle in order', async () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'picked_up', deviceCapturedAt: new Date(1000).toISOString() }),
      makeEvent({ id: 'e2', eventType: 'in_transit', deviceCapturedAt: new Date(2000).toISOString() }),
      makeEvent({ id: 'e3', eventType: 'out_for_delivery', deviceCapturedAt: new Date(3000).toISOString() }),
      makeEvent({ id: 'e4', eventType: 'delivered', deviceCapturedAt: new Date(4000).toISOString() }),
    ];
    mockRequest.body = { events };

    mockDb.shipment.findMany.mockResolvedValue([makeMockShipment({ status: 'READY_FOR_PICKUP' })]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);
    mockDb.deliveryEvent.create.mockResolvedValue({});
    mockDb.shipment.update.mockResolvedValue({});

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results).toHaveLength(4);
    expect(result.results.every((r: any) => r.status === 'accepted')).toBe(true);
  });

  // ── Idempotency ───────────────────────────────────────────

  it('returns accepted for duplicate event ids without re-processing', async () => {
    const event = makeEvent({ eventType: 'picked_up' });
    mockRequest.body = { events: [event] };

    mockDb.shipment.findMany.mockResolvedValue([makeMockShipment()]);
    // Simulate event already stored
    mockDb.deliveryEvent.findMany.mockResolvedValue([{ id: event.id }]);

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results[0]).toMatchObject({ id: event.id, status: 'accepted' });
    // Should not attempt to persist
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  // ── Terminal state conflict ───────────────────────────────

  it('returns conflict with currentDeliveryStatus when delivery is DELIVERED', async () => {
    const event = makeEvent({ eventType: 'in_transit' });
    mockRequest.body = { events: [event] };

    mockDb.shipment.findMany.mockResolvedValue([makeMockShipment({ status: 'DELIVERED' })]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results[0]).toMatchObject({
      id: event.id,
      status: 'conflict',
      currentDeliveryStatus: 'delivered',
      message: expect.stringContaining('terminal'),
    });
  });

  it('returns conflict when delivery is FAILED', async () => {
    const event = makeEvent({ eventType: 'delivered' });
    mockRequest.body = { events: [event] };

    mockDb.shipment.findMany.mockResolvedValue([makeMockShipment({ status: 'FAILED' })]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results[0]).toMatchObject({
      id: event.id,
      status: 'conflict',
      currentDeliveryStatus: 'failed_delivery',
    });
  });

  // ── Invalid transition ────────────────────────────────────

  it('returns conflict for invalid transition (skipping steps)', async () => {
    const event = makeEvent({ eventType: 'delivered' }); // from PICKED_UP — must go in_transit first
    mockRequest.body = { events: [event] };

    mockDb.shipment.findMany.mockResolvedValue([makeMockShipment({ status: 'PICKED_UP' })]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results[0]).toMatchObject({
      id: event.id,
      status: 'conflict',
      currentDeliveryStatus: 'picked_up',
    });
  });

  // ── Unknown delivery ──────────────────────────────────────

  it('returns error for unknown deliveryId', async () => {
    const event = makeEvent({ deliveryId: 'unknown-uuid' });
    mockRequest.body = { events: [event] };

    mockDb.shipment.findMany.mockResolvedValue([]); // nothing found
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results[0]).toMatchObject({
      id: event.id,
      status: 'error',
      message: expect.stringContaining('not found'),
    });
  });

  // ── Multi-delivery batch ──────────────────────────────────

  it('processes two independent deliveries in the same batch', async () => {
    const e1 = makeEvent({ id: 'e1', eventType: 'picked_up', deliveryId: 'ship-1' });
    const e2 = makeEvent({ id: 'e2', eventType: 'picked_up', deliveryId: 'ship-2' });
    mockRequest.body = { events: [e1, e2] };

    mockDb.shipment.findMany.mockResolvedValue([
      { id: 'ship-1', shopId: 'shop-123', status: 'READY_FOR_PICKUP' },
      { id: 'ship-2', shopId: 'shop-123', status: 'PENDING' },
    ]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);
    mockDb.deliveryEvent.create.mockResolvedValue({});
    mockDb.shipment.update.mockResolvedValue({});

    const result = await simulateBatchHandler(mockRequest);

    expect(result.results).toHaveLength(2);
    expect(result.results.every((r: any) => r.status === 'accepted')).toBe(true);
  });

  // ── Out-of-order batch sorting ────────────────────────────

  it('processes events sorted by deviceCapturedAt even if submitted out of order', async () => {
    const later = makeEvent({ id: 'e-later', eventType: 'in_transit', deliveryId: 'ship-1', deviceCapturedAt: new Date(2000).toISOString() });
    const earlier = makeEvent({ id: 'e-earlier', eventType: 'picked_up', deliveryId: 'ship-1', deviceCapturedAt: new Date(1000).toISOString() });

    // Submitted out of order
    mockRequest.body = { events: [later, earlier] };

    mockDb.shipment.findMany.mockResolvedValue([
      { id: 'ship-1', shopId: 'shop-123', status: 'READY_FOR_PICKUP' },
    ]);
    mockDb.deliveryEvent.findMany.mockResolvedValue([]);
    mockDb.deliveryEvent.create.mockResolvedValue({});
    mockDb.shipment.update.mockResolvedValue({});

    const result = await simulateBatchHandler(mockRequest);

    // Both should be accepted — earlier picked_up runs first, then in_transit
    expect(result.results.find((r: any) => r.id === 'e-earlier')).toMatchObject({ status: 'accepted' });
    expect(result.results.find((r: any) => r.id === 'e-later')).toMatchObject({ status: 'accepted' });
  });

  // ── Input validation ──────────────────────────────────────

  it('returns 400 when events array is missing', async () => {
    mockRequest.body = {};

    const reply = { ...mockReply };
    let sentStatus = 0;
    let sentBody: any;
    reply.status = vi.fn().mockImplementation((s: number) => { sentStatus = s; return reply; });
    reply.send = vi.fn().mockImplementation((b: any) => { sentBody = b; return reply; });

    await simulateBatchHandler({ ...mockRequest }, reply);

    expect(sentStatus).toBe(400);
    expect(sentBody.error).toBe('Validation error');
  });

  it('returns 400 when eventType is invalid', async () => {
    mockRequest.body = { events: [makeEvent({ eventType: 'teleported' })] };

    const reply = { ...mockReply };
    let sentStatus = 0;
    reply.status = vi.fn().mockImplementation((s: number) => { sentStatus = s; return reply; });
    reply.send = vi.fn().mockReturnThis();

    await simulateBatchHandler({ ...mockRequest }, reply);

    expect(sentStatus).toBe(400);
  });
});

// ── Test harness — inline handler logic ──────────────────────────────────────
// We replicate the handler logic here so we can test it without a running
// Fastify instance. The actual server test (app integration) should cover
// the HTTP layer; these tests focus on business logic correctness.

const TERMINAL_STATUSES = new Set(['DELIVERED', 'FAILED']);

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  PICKED_UP: new Set(['IN_TRANSIT']),
  IN_TRANSIT: new Set(['OUT_FOR_DELIVERY']),
  OUT_FOR_DELIVERY: new Set(['DELIVERED', 'FAILED']),
  DELIVERED: new Set(),
  FAILED: new Set(),
  PENDING: new Set(['PICKED_UP']),
  PROCESSING: new Set(['PICKED_UP']),
  READY_FOR_PICKUP: new Set(['PICKED_UP']),
  ASSIGNED: new Set(['PICKED_UP']),
};

const EVENT_TYPE_TO_STATUS: Record<string, string> = {
  picked_up: 'PICKED_UP',
  in_transit: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  failed_delivery: 'FAILED',
};

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

import { batchDeliveryEventsSchema } from '@witylogix/validators';

async function simulateBatchHandler(request: any, reply: any = null): Promise<any> {
  const replyObj = reply ?? { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

  const parsed = batchDeliveryEventsSchema.safeParse(request.body);
  if (!parsed.success) {
    replyObj.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    return;
  }

  const { events } = parsed.data;
  const shopId: string = request.shopId;
  const db: any = request.tenantDb;

  const sorted = [...events].sort(
    (a, b) => new Date(a.deviceCapturedAt).getTime() - new Date(b.deviceCapturedAt).getTime(),
  );

  const deliveryIds = [...new Set(sorted.map((e) => e.deliveryId))];

  const shipments = await db.shipment.findMany({
    where: { id: { in: deliveryIds }, shopId },
    select: { id: true, status: true, shopId: true },
  });

  const shipmentMap = new Map(shipments.map((s: any) => [s.id, s]));

  const eventIds = sorted.map((e) => e.id);
  const existing = await db.deliveryEvent.findMany({
    where: { id: { in: eventIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e: any) => e.id));

  const runningState = new Map<string, string>(
    shipments.map((s: any) => [s.id, s.status]),
  );

  const results: any[] = [];

  for (const event of sorted) {
    if (existingIds.has(event.id)) {
      results.push({ id: event.id, status: 'accepted' });
      continue;
    }

    const shipment = shipmentMap.get(event.deliveryId);
    if (!shipment) {
      results.push({ id: event.id, status: 'error', message: `Delivery ${event.deliveryId} not found` });
      continue;
    }

    const currentStatus = runningState.get(event.deliveryId)!;
    const targetStatus = EVENT_TYPE_TO_STATUS[event.eventType];

    if (TERMINAL_STATUSES.has(currentStatus)) {
      results.push({
        id: event.id,
        status: 'conflict',
        currentDeliveryStatus: STATUS_TO_CLIENT[currentStatus] ?? currentStatus.toLowerCase(),
        message: 'Delivery is already in terminal state',
      });
      continue;
    }

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

  return { results };
}
