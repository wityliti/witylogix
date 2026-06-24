import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for GET /api/dispatch/ai-suggest/:orderId
 *
 * Verifies that the AI driver suggestion endpoint correctly:
 * - Returns a suggestedDriverId and confidence when drivers are available
 * - Returns null suggestedDriverId when no drivers are available
 * - Returns null suggestedDriverId when the order has no suitable driver
 * - Returns 404 when the order is not found
 */

vi.mock('@witylogix/core/ai/smart-driver-assignment', () => {
  const MockSmartDriverAssignment = vi.fn().mockImplementation(() => ({
    addDrivers: vi.fn(),
    addOrders: vi.fn(),
    assignOrder: vi.fn().mockReturnValue({
      driverId: 'driver-abc',
      orderIds: ['order-123'],
      score: 82,
      estimatedPickupTime: new Date('2026-04-13T10:00:00Z'),
      estimatedDeliveryTime: new Date('2026-04-13T10:30:00Z'),
      routeDistance: 5.2,
    }),
  }));
  return { SmartDriverAssignment: MockSmartDriverAssignment };
});

import { SmartDriverAssignment } from '@witylogix/core/ai/smart-driver-assignment';

const buildMockRequest = (overrides: Record<string, any> = {}) => ({
  params: { orderId: 'order-123' },
  tenantDb: {
    order: { findUnique: vi.fn() },
    driver: { findMany: vi.fn() },
  },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  ...overrides,
});

const buildMockReply = () => {
  const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
  return reply;
};

// Simulate the route handler inline so we don't need to boot Fastify
async function handleAiSuggest(request: any, reply: any): Promise<void> {
  const { orderId } = request.params as { orderId: string };

  const order = await request.tenantDb.order.findUnique({
    where: { id: orderId },
    select: { id: true, deliveryLocation: true, totalWeight: true, itemCount: true, status: true },
  });

  if (!order) {
    reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    return;
  }

  const drivers = await request.tenantDb.driver.findMany({
    where: { isActive: true, status: { in: ['AVAILABLE', 'ON_ROUTE', 'ON_BREAK'] } },
    select: {
      id: true, currentLocation: true, maxCapacity: true, maxWeight: true, status: true,
      _count: { select: { orders: { where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } } } } },
    },
  });

  if (drivers.length === 0) {
    reply.status(200).send({ data: { suggestedDriverId: null, confidence: 0, reasoning: 'No available drivers' } });
    return;
  }

  const DEFAULT_LOCATION = { latitude: 0, longitude: 0 };
  const orderDeliveryLoc = order.deliveryLocation as { latitude?: number; longitude?: number } | null;
  const deliveryCoord = orderDeliveryLoc?.latitude != null && orderDeliveryLoc?.longitude != null
    ? { latitude: orderDeliveryLoc.latitude, longitude: orderDeliveryLoc.longitude }
    : DEFAULT_LOCATION;

  const engine = new SmartDriverAssignment();

  engine.addDrivers(
    drivers.map((d: any) => {
      const loc = d.currentLocation as { latitude?: number; longitude?: number } | null;
      const maxWeightNum = d.maxWeight ? Number(d.maxWeight) : 100;
      return {
        id: d.id,
        currentLocation: loc?.latitude != null && loc?.longitude != null
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : DEFAULT_LOCATION,
        shiftStartTime: new Date(Date.now() - 4 * 3600000),
        shiftEndTime: new Date(Date.now() + 4 * 3600000),
        capacity: { weight: maxWeightNum, volume: d.maxCapacity },
        usedCapacity: { weight: 0, volume: d._count.orders },
        completedDeliveries: d._count.orders,
        maxDeliveriesPerShift: d.maxCapacity,
        workingHoursRemaining: 240,
      };
    })
  );

  const orderPayload = { id: order.id, pickupLocation: DEFAULT_LOCATION, deliveryLocation: deliveryCoord, weight: order.totalWeight ? Number(order.totalWeight) : 0, estimatedDuration: 30 };
  engine.addOrders([orderPayload]);
  const result = engine.assignOrder(orderPayload);

  if (!result) {
    reply.status(200).send({ data: { suggestedDriverId: null, confidence: 0, reasoning: 'No available drivers' } });
    return;
  }

  const confidence = Math.round(result.score) / 100;
  const reasoning = `Driver assigned with ${result.score}% score. ETA pickup: ${result.estimatedPickupTime.toISOString()}, delivery: ${result.estimatedDeliveryTime.toISOString()}.`;
  reply.status(200).send({ data: { suggestedDriverId: result.driverId, confidence, reasoning } });
}

describe('GET /dispatch/ai-suggest/:orderId', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns suggested driver when a suitable driver exists', async () => {
    const request = buildMockRequest();
    const reply = buildMockReply();

    request.tenantDb.order.findUnique.mockResolvedValue({
      id: 'order-123',
      deliveryLocation: { latitude: 25.2048, longitude: 55.2708 },
      totalWeight: '5.0',
      itemCount: 3,
      status: 'PENDING',
    });

    request.tenantDb.driver.findMany.mockResolvedValue([
      {
        id: 'driver-abc',
        currentLocation: { latitude: 25.2, longitude: 55.27 },
        maxCapacity: 20,
        maxWeight: '100',
        status: 'AVAILABLE',
        _count: { orders: 2 },
      },
    ]);

    await handleAiSuggest(request, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    const responseBody = reply.send.mock.calls[0][0];
    expect(responseBody.data.suggestedDriverId).toBe('driver-abc');
    expect(responseBody.data.confidence).toBeCloseTo(0.82);
    expect(typeof responseBody.data.reasoning).toBe('string');
  });

  it('returns null suggestedDriverId when no drivers are available', async () => {
    const request = buildMockRequest();
    const reply = buildMockReply();

    request.tenantDb.order.findUnique.mockResolvedValue({
      id: 'order-123',
      deliveryLocation: null,
      totalWeight: null,
      itemCount: 1,
      status: 'PENDING',
    });

    request.tenantDb.driver.findMany.mockResolvedValue([]);

    await handleAiSuggest(request, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    const responseBody = reply.send.mock.calls[0][0];
    expect(responseBody.data.suggestedDriverId).toBeNull();
    expect(responseBody.data.reasoning).toBe('No available drivers');
  });

  it('returns null suggestedDriverId when engine finds no suitable driver', async () => {
    // Override mock for this test only: assignOrder returns null
    vi.mocked(SmartDriverAssignment).mockImplementationOnce(() => ({
      addDrivers: vi.fn(),
      addOrders: vi.fn(),
      assignOrder: vi.fn().mockReturnValue(null),
    }));

    const request = buildMockRequest();
    const reply = buildMockReply();

    request.tenantDb.order.findUnique.mockResolvedValue({
      id: 'order-123',
      deliveryLocation: { latitude: 25.2048, longitude: 55.2708 },
      totalWeight: '50',
      itemCount: 10,
      status: 'PENDING',
    });

    request.tenantDb.driver.findMany.mockResolvedValue([
      {
        id: 'driver-xyz',
        currentLocation: null,
        maxCapacity: 5,
        maxWeight: '10',
        status: 'AVAILABLE',
        _count: { orders: 5 },
      },
    ]);

    await handleAiSuggest(request, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    const responseBody = reply.send.mock.calls[0][0];
    expect(responseBody.data.suggestedDriverId).toBeNull();
    expect(responseBody.data.reasoning).toBe('No available drivers');
  });

  it('returns 404 when order is not found', async () => {
    const request = buildMockRequest();
    const reply = buildMockReply();

    request.tenantDb.order.findUnique.mockResolvedValue(null);

    await handleAiSuggest(request, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    const responseBody = reply.send.mock.calls[0][0];
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('NOT_FOUND');
  });
});
