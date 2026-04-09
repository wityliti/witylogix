/**
 * Geofence Worker Tests — WIT-140
 *
 * Coverage:
 * - haversineMeters: distance calculation correctness
 * - resolveGeofenceRadius: clamping and defaults
 * - geofenceDedupKey: key format
 * - runGeofenceCheck: integration — entry detection, idempotency, dedup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Unit tests: pure functions ────────────────────────────────────────────────

import {
  haversineMeters,
  resolveGeofenceRadius,
  geofenceDedupKey,
  GEOFENCE_DEFAULT_RADIUS_M,
  GEOFENCE_MIN_RADIUS_M,
  GEOFENCE_MAX_RADIUS_M,
} from '../../workers/geofence-worker.js';

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineMeters(51.5, -0.1, 51.5, -0.1)).toBeCloseTo(0, 0);
  });

  it('returns approx 111km per degree of latitude', () => {
    const dist = haversineMeters(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(48.8566, 2.3522, 51.5074, -0.1278);
    const b = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  it('returns ~343km for Paris→London', () => {
    const dist = haversineMeters(48.8566, 2.3522, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(340_000);
    expect(dist).toBeLessThan(345_000);
  });

  it('detects a point 100m north of origin is within 150m radius', () => {
    // 0.001 degree lat ≈ 111m
    const dist = haversineMeters(0, 0, 0.001, 0);
    expect(dist).toBeLessThan(150);
    expect(dist).toBeGreaterThan(50);
  });

  it('detects a point 200m away is outside 150m radius', () => {
    // 0.002 degree lat ≈ 222m
    const dist = haversineMeters(0, 0, 0.002, 0);
    expect(dist).toBeGreaterThan(150);
  });
});

describe('resolveGeofenceRadius', () => {
  it('returns default when settings is null', () => {
    expect(resolveGeofenceRadius(null)).toBe(GEOFENCE_DEFAULT_RADIUS_M);
  });

  it('returns default when settings is empty object', () => {
    expect(resolveGeofenceRadius({})).toBe(GEOFENCE_DEFAULT_RADIUS_M);
  });

  it('returns default when geofenceRadiusMeters is not a number', () => {
    expect(resolveGeofenceRadius({ geofenceRadiusMeters: 'big' })).toBe(GEOFENCE_DEFAULT_RADIUS_M);
  });

  it('returns configured value within valid range', () => {
    expect(resolveGeofenceRadius({ geofenceRadiusMeters: 200 })).toBe(200);
  });

  it('clamps to min when value is below minimum', () => {
    expect(resolveGeofenceRadius({ geofenceRadiusMeters: 10 })).toBe(GEOFENCE_MIN_RADIUS_M);
  });

  it('clamps to max when value is above maximum', () => {
    expect(resolveGeofenceRadius({ geofenceRadiusMeters: 9999 })).toBe(GEOFENCE_MAX_RADIUS_M);
  });

  it('accepts exact min boundary', () => {
    expect(resolveGeofenceRadius({ geofenceRadiusMeters: GEOFENCE_MIN_RADIUS_M })).toBe(GEOFENCE_MIN_RADIUS_M);
  });

  it('accepts exact max boundary', () => {
    expect(resolveGeofenceRadius({ geofenceRadiusMeters: GEOFENCE_MAX_RADIUS_M })).toBe(GEOFENCE_MAX_RADIUS_M);
  });
});

describe('geofenceDedupKey', () => {
  it('returns expected key format', () => {
    expect(geofenceDedupKey('driver-1', 'ship-2')).toBe('geofence:dedup:driver-1:ship-2');
  });

  it('is unique per driver/shipment pair', () => {
    const k1 = geofenceDedupKey('d1', 's1');
    const k2 = geofenceDedupKey('d1', 's2');
    const k3 = geofenceDedupKey('d2', 's1');
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k2).not.toBe(k3);
  });
});

// ── Integration test: runGeofenceCheck ───────────────────────────────────────

const SHIPMENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DRIVER_ID = 'ffffffff-aaaa-bbbb-cccc-dddddddddddd';
const SHOP_ID = '11111111-2222-3333-4444-555555555555';

// Use vi.hoisted to define mocks before module loading (vi.mock is hoisted)
const { mockRedis, mockPrismaShipment, mockPrismaDeliveryEvent, mockPrismaTransaction } = vi.hoisted(() => {
  const mockRedis = {
    geopos: vi.fn(),
    exists: vi.fn(),
    set: vi.fn(),
  };
  const mockPrismaShipment = {
    findMany: vi.fn(),
    update: vi.fn(),
  };
  const mockPrismaDeliveryEvent = {
    create: vi.fn(),
  };
  const mockPrismaTransaction = vi.fn();
  return { mockRedis, mockPrismaShipment, mockPrismaDeliveryEvent, mockPrismaTransaction };
});

vi.mock('../../lib/redis.js', () => ({
  getRedis: () => mockRedis,
}));

vi.mock('@witylogix/db', () => ({
  prisma: {
    get shipment() { return mockPrismaShipment; },
    get deliveryEvent() { return mockPrismaDeliveryEvent; },
    $transaction: (...args: any[]) => mockPrismaTransaction(...args),
  },
}));

vi.mock('../../lib/queue.js', () => ({
  getQueueConnection: vi.fn().mockReturnValue({}),
  registerWorker: vi.fn(),
  getGeofenceQueue: vi.fn(),
}));

describe('runGeofenceCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    });
    mockPrismaDeliveryEvent.create.mockResolvedValue({});
    mockPrismaShipment.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeShipment(overrides: Record<string, unknown> = {}) {
    return {
      id: SHIPMENT_ID,
      shopId: SHOP_ID,
      driverId: DRIVER_ID,
      deliveryLocation: { lat: 48.8566, lng: 2.3522 },
      shop: { settings: {} },
      ...overrides,
    };
  }

  it('returns zero counts when no active shipments', async () => {
    mockPrismaShipment.findMany.mockResolvedValue([]);

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result).toEqual({ checked: 0, triggered: 0, skipped: 0 });
  });

  it('skips shipment when driver has no GPS position in Redis', async () => {
    mockPrismaShipment.findMany.mockResolvedValue([makeShipment()]);
    mockRedis.geopos.mockResolvedValue([[null, null]]);

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips shipment when driver is outside geofence radius', async () => {
    mockPrismaShipment.findMany.mockResolvedValue([makeShipment()]);
    // Driver is ~2km away (0.02 degree lat ≈ 2.2km)
    mockRedis.geopos.mockResolvedValue([['2.3522', '48.8386']]);
    mockRedis.exists.mockResolvedValue(0);

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('triggers arrived event when driver is within default radius', async () => {
    mockPrismaShipment.findMany.mockResolvedValue([makeShipment()]);
    // Driver is ~11m away (0.0001 degree lat ≈ 11m)
    mockRedis.geopos.mockResolvedValue([['2.3522', '48.8567']]);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.set.mockResolvedValue('OK');

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result.triggered).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockPrismaTransaction).toHaveBeenCalledOnce();
    expect(mockRedis.set).toHaveBeenCalledWith(
      geofenceDedupKey(DRIVER_ID, SHIPMENT_ID),
      '1',
      'EX',
      60,
    );
  });

  it('skips when dedup key already exists (same trigger within 60s)', async () => {
    mockPrismaShipment.findMany.mockResolvedValue([makeShipment()]);
    // Driver is very close (~11m)
    mockRedis.geopos.mockResolvedValue([['2.3522', '48.8567']]);
    mockRedis.exists.mockResolvedValue(1); // dedup key present

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('respects custom shop geofence radius (50m — driver 111m away is outside)', async () => {
    const shipment = makeShipment({ shop: { settings: { geofenceRadiusMeters: 50 } } });
    mockPrismaShipment.findMany.mockResolvedValue([shipment]);
    // Driver is ~111m away (0.001 degree lat)
    mockRedis.geopos.mockResolvedValue([['2.3522', '48.8576']]);
    mockRedis.exists.mockResolvedValue(0);

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips shipment with null deliveryLocation', async () => {
    mockPrismaShipment.findMany.mockResolvedValue([
      makeShipment({ deliveryLocation: null }),
    ]);
    mockRedis.geopos.mockResolvedValue([['2.3522', '48.8566']]);

    const { runGeofenceCheck } = await import('../../workers/geofence-worker.js');
    const result = await runGeofenceCheck();

    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ── State machine: arrived transition ────────────────────────────────────────

describe('Delivery State Machine — arrived event', () => {
  const VALID_TRANSITIONS: Record<string, Set<string>> = {
    PICKED_UP: new Set(['IN_TRANSIT']),
    IN_TRANSIT: new Set(['OUT_FOR_DELIVERY']),
    OUT_FOR_DELIVERY: new Set(['ARRIVED', 'DELIVERED', 'FAILED']),
    ARRIVED: new Set(['DELIVERED', 'FAILED']),
    DELIVERED: new Set(),
    FAILED: new Set(),
    PENDING: new Set(['PICKED_UP']),
    PROCESSING: new Set(['PICKED_UP']),
    READY_FOR_PICKUP: new Set(['PICKED_UP']),
    ASSIGNED: new Set(['PICKED_UP']),
  };

  const TERMINAL = new Set(['DELIVERED', 'FAILED']);

  const EVENT_MAP: Record<string, string> = {
    picked_up: 'PICKED_UP',
    in_transit: 'IN_TRANSIT',
    out_for_delivery: 'OUT_FOR_DELIVERY',
    arrived: 'ARRIVED',
    delivered: 'DELIVERED',
    failed_delivery: 'FAILED',
  };

  function canTransition(from: string, eventType: string): boolean {
    if (TERMINAL.has(from)) return false;
    const target = EVENT_MAP[eventType];
    return VALID_TRANSITIONS[from]?.has(target) ?? false;
  }

  it('allows arrived from OUT_FOR_DELIVERY', () => {
    expect(canTransition('OUT_FOR_DELIVERY', 'arrived')).toBe(true);
  });

  it('allows delivered from ARRIVED', () => {
    expect(canTransition('ARRIVED', 'delivered')).toBe(true);
  });

  it('allows failed_delivery from ARRIVED', () => {
    expect(canTransition('ARRIVED', 'failed_delivery')).toBe(true);
  });

  it('blocks arrived from IN_TRANSIT (driver must be out_for_delivery first)', () => {
    expect(canTransition('IN_TRANSIT', 'arrived')).toBe(false);
  });

  it('blocks arrived from PICKED_UP', () => {
    expect(canTransition('PICKED_UP', 'arrived')).toBe(false);
  });

  it('blocks arrived from DELIVERED (terminal)', () => {
    expect(canTransition('DELIVERED', 'arrived')).toBe(false);
  });

  it('blocks arrived from ARRIVED (no cycle)', () => {
    expect(canTransition('ARRIVED', 'arrived')).toBe(false);
  });
});
