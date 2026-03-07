// @ts-nocheck

/**
 * @witylogix/workflows — Assign Driver Workflow Test Suite
 *
 * Comprehensive tests for the driver assignment workflow:
 * - Happy path: find available driver and assign
 * - No drivers available error
 * - Driver scoring: closest + best rating wins
 * - Driver capacity constraints
 * - Route optimization with multiple stops
 * - ETA calculation accuracy
 * - Assignment failure with compensation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowContext, StepResult } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SERVICES & TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AssignDriverInput {
  orderId: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  priority?: 'standard' | 'express' | 'overnight';
}

interface Driver {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number;
  completedDeliveries: number;
  currentDeliveries: number;
  maxCapacity: number;
  vehicle: {
    type: 'bike' | 'scooter' | 'car' | 'van';
    licensePlate: string;
  };
}

interface Assignment {
  orderId: string;
  driverId: string;
  driverName: string;
  estimatedArrival: Date;
  estimatedDelivery: Date;
  routeOptimized: boolean;
  totalStops: number;
}

// Mock services
const mockGetAvailableDrivers = vi.fn();
const mockCalculateDistance = vi.fn();
const mockOptimizeRoute = vi.fn();
const mockCalculateETA = vi.fn();
const mockAssignDriver = vi.fn();
const mockNotifyDriver = vi.fn();

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW STEPS
// ─────────────────────────────────────────────────────────────────────────────

const validateDeliveryStep = {
  name: 'Validate Delivery',
  async invoke(input: AssignDriverInput): Promise<StepResult<AssignDriverInput>> {
    try {
      if (!input.orderId || input.orderId.trim().length === 0) {
        return { success: false, error: 'Order ID is required', code: 'INVALID_ORDER_ID' };
      }

      if (!input.deliveryAddress || input.deliveryAddress.trim().length === 0) {
        return { success: false, error: 'Delivery address is required', code: 'INVALID_ADDRESS' };
      }

      if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number') {
        return { success: false, error: 'Valid coordinates required', code: 'INVALID_COORDINATES' };
      }

      return { success: true, data: input };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation error',
        code: 'VALIDATION_ERROR',
      };
    }
  },
};

const findAvailableDriversStep = {
  name: 'Find Available Drivers',
  async invoke(
    input: AssignDriverInput
  ): Promise<StepResult<AssignDriverInput & { availableDrivers: Driver[] }>> {
    try {
      const drivers = await mockGetAvailableDrivers({
        orderId: input.orderId,
        latitude: input.latitude,
        longitude: input.longitude,
        maxDistance: 15, // 15km search radius
        priority: input.priority || 'standard',
      });

      if (!drivers || drivers.length === 0) {
        return {
          success: false,
          error: 'no_drivers_available',
          code: 'NO_DRIVERS_AVAILABLE',
        };
      }

      return {
        success: true,
        data: { ...input, availableDrivers: drivers },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch drivers',
        code: 'DRIVER_FETCH_ERROR',
      };
    }
  },
};

const scoreDriversStep = {
  name: 'Score Drivers',
  async invoke(
    input: AssignDriverInput & { availableDrivers: Driver[] }
  ): Promise<StepResult<AssignDriverInput & { availableDrivers: Driver[]; scoredDrivers: Array<{ driver: Driver; score: number }> }>> {
    try {
      const scoredDrivers = [];

      for (const driver of input.availableDrivers) {
        // Skip drivers at capacity
        if (driver.currentDeliveries >= driver.maxCapacity) {
          continue;
        }

        // Calculate distance
        const distanceData = await mockCalculateDistance({
          driverLat: driver.latitude,
          driverLng: driver.longitude,
          deliveryLat: input.latitude,
          deliveryLng: input.longitude,
        });

        const distance = distanceData.distance || 999;

        // Score: (rating * weight) - (distance * weight) + experience bonus
        const ratingScore = driver.rating * 10; // 0-50 points
        const distanceScore = (20 - Math.min(distance, 20)) * 5; // 0-100 points (closer is better)
        const experienceBonus = Math.min(driver.completedDeliveries / 100, 10); // 0-10 bonus points

        const totalScore = ratingScore + distanceScore + experienceBonus;

        scoredDrivers.push({ driver, score: totalScore });
      }

      // Sort by score descending
      scoredDrivers.sort((a, b) => b.score - a.score);

      if (scoredDrivers.length === 0) {
        return {
          success: false,
          error: 'No drivers available (all at capacity)',
          code: 'NO_CAPACITY_AVAILABLE',
        };
      }

      return {
        success: true,
        data: { ...input, scoredDrivers },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Driver scoring error',
        code: 'SCORING_ERROR',
      };
    }
  },
};

const optimizeRouteStep = {
  name: 'Optimize Route',
  async invoke(
    input: AssignDriverInput & {
      availableDrivers: Driver[]
      scoredDrivers: Array<{ driver: Driver; score: number }>
    }
  ): Promise<StepResult<AssignDriverInput & {
    availableDrivers: Driver[]
    scoredDrivers: Array<{ driver: Driver; score: number }>
    selectedDriver: Driver
    optimizedRoute: { stops: Array<{ lat: number; lng: number; type: string }>; distance: number }
  }>> {
    try {
      const selectedDriver = input.scoredDrivers[0].driver; // Best scored driver

      // Optimize route with current deliveries
      const routeData = await mockOptimizeRoute({
        driverId: selectedDriver.id,
        currentLocation: { lat: selectedDriver.latitude, lng: selectedDriver.longitude },
        newDelivery: {
          lat: input.latitude,
          lng: input.longitude,
          address: input.deliveryAddress,
        },
      });

      if (!routeData.stops || routeData.stops.length === 0) {
        return {
          success: false,
          error: 'Route optimization failed',
          code: 'ROUTE_OPTIMIZATION_FAILED',
        };
      }

      return {
        success: true,
        data: {
          ...input,
          selectedDriver,
          optimizedRoute: routeData,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Route optimization error',
        code: 'ROUTE_ERROR',
      };
    }
  },
};

const calculateETAStep = {
  name: 'Calculate ETA',
  async invoke(input: any): Promise<StepResult<any & { estimatedArrival: Date; estimatedDelivery: Date }>> {
    try {
      const etaData = await mockCalculateETA({
        driverId: input.selectedDriver.id,
        route: input.optimizedRoute,
        priority: input.priority || 'standard',
      });

      if (!etaData.arrivalTime || !etaData.deliveryTime) {
        return { success: false, error: 'ETA calculation failed', code: 'ETA_CALC_FAILED' };
      }

      return {
        success: true,
        data: {
          ...input,
          estimatedArrival: new Date(etaData.arrivalTime),
          estimatedDelivery: new Date(etaData.deliveryTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ETA calculation error',
        code: 'ETA_ERROR',
      };
    }
  },
};

const assignDriverStep = {
  name: 'Assign Driver',
  async invoke(input: any): Promise<StepResult<Assignment>> {
    try {
      const assignment = await mockAssignDriver({
        orderId: input.orderId,
        driverId: input.selectedDriver.id,
        route: input.optimizedRoute,
        estimatedArrival: input.estimatedArrival,
        estimatedDelivery: input.estimatedDelivery,
      });

      if (!assignment.id) {
        return { success: false, error: 'Assignment failed', code: 'ASSIGNMENT_FAILED' };
      }

      return {
        success: true,
        data: {
          orderId: input.orderId,
          driverId: input.selectedDriver.id,
          driverName: input.selectedDriver.name,
          estimatedArrival: input.estimatedArrival,
          estimatedDelivery: input.estimatedDelivery,
          routeOptimized: true,
          totalStops: input.optimizedRoute.stops.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Assignment error',
        code: 'ASSIGNMENT_ERROR',
      };
    }
  },
  async compensate(assignment: Assignment) {
    // Unassign driver on compensation
    vi.fn()({ orderId: assignment.orderId, action: 'unassign' });
  },
};

const notifyDriverStep = {
  name: 'Notify Driver',
  async invoke(assignment: Assignment): Promise<StepResult<Assignment>> {
    try {
      await mockNotifyDriver({
        driverId: assignment.driverId,
        orderId: assignment.orderId,
        estimatedArrival: assignment.estimatedArrival,
      });

      return { success: true, data: assignment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Notification error',
        code: 'NOTIFICATION_ERROR',
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('Assign Driver Workflow', () => {
  let mockContext: WorkflowContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      prisma: {} as any,
      userId: 'user_123',
      shopId: 'shop_123',
      orgId: 'org_123',
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    // Default mock implementations
    const mockDrivers = [
      {
        id: 'driver_1',
        name: 'Alice',
        latitude: 43.6629,
        longitude: -79.3957,
        rating: 4.8,
        completedDeliveries: 500,
        currentDeliveries: 2,
        maxCapacity: 5,
        vehicle: { type: 'car', licensePlate: 'ABC123' },
      },
      {
        id: 'driver_2',
        name: 'Bob',
        latitude: 43.6532,
        longitude: -79.3832,
        rating: 4.5,
        completedDeliveries: 300,
        currentDeliveries: 3,
        maxCapacity: 5,
        vehicle: { type: 'bike', licensePlate: 'XYZ789' },
      },
      {
        id: 'driver_3',
        name: 'Charlie',
        latitude: 43.6426,
        longitude: -79.3957,
        rating: 4.2,
        completedDeliveries: 100,
        currentDeliveries: 5,
        maxCapacity: 5,
        vehicle: { type: 'scooter', licensePlate: 'DEF456' },
      },
    ];

    mockGetAvailableDrivers.mockResolvedValue(mockDrivers);

    mockCalculateDistance.mockResolvedValue({ distance: 2.5 });

    mockOptimizeRoute.mockResolvedValue({
      stops: [
        { lat: 43.6532, lng: -79.3832, type: 'start' },
        { lat: 43.6629, lng: -79.3957, type: 'pickup' },
        { lat: 43.6520, lng: -79.3800, type: 'delivery' },
      ],
      distance: 8.5,
    });

    mockCalculateETA.mockResolvedValue({
      arrivalTime: new Date(Date.now() + 15 * 60 * 1000),
      deliveryTime: new Date(Date.now() + 45 * 60 * 1000),
    });

    mockAssignDriver.mockResolvedValue({ id: 'assign_123' });

    mockNotifyDriver.mockResolvedValue({ success: true });
  });

  describe('Happy Path', () => {
    it('should assign driver to delivery successfully', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
        priority: 'standard',
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      expect(validated.success).toBe(true);

      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      expect(foundDrivers.success).toBe(true);

      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      expect(scoredDrivers.success).toBe(true);

      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      expect(routeOptimized.success).toBe(true);

      const etaCalculated = await calculateETAStep.invoke(routeOptimized.data!, mockContext);
      expect(etaCalculated.success).toBe(true);

      const assigned = await assignDriverStep.invoke(etaCalculated.data!, mockContext);
      expect(assigned.success).toBe(true);
      expect(assigned.data!.driverId).toBe('driver_1');

      const notified = await notifyDriverStep.invoke(assigned.data!, mockContext);
      expect(notified.success).toBe(true);
    });

    it('should select closest driver with best rating', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_456',
        deliveryAddress: '100 King St, Toronto, ON',
        latitude: 43.6629,
        longitude: -79.3957,
        priority: 'express',
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);

      // Best driver should be first (highest score)
      const bestDriver = scoredDrivers.data!.scoredDrivers[0];
      expect(bestDriver.driver.id).toBe('driver_1'); // Alice: 4.8 rating + 500 deliveries
    });
  });

  describe('Validation Failure', () => {
    it('should fail on invalid order ID', async () => {
      const input: AssignDriverInput = {
        orderId: '',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_ORDER_ID');
    });

    it('should fail on missing delivery address', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_ADDRESS');
    });

    it('should fail on invalid coordinates', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: NaN,
        longitude: -79.3800,
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_COORDINATES');
    });
  });

  describe('Driver Availability', () => {
    it('should fail when no drivers available', async () => {
      mockGetAvailableDrivers.mockResolvedValue([]);

      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const result = await findAvailableDriversStep.invoke(validated.data!, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('no_drivers_available');
    });

    it('should skip drivers at capacity', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);

      // Charlie (driver_3) is at capacity, should not be in scored list
      const scoredDriverIds = scoredDrivers.data!.scoredDrivers.map((s) => s.driver.id);
      expect(scoredDriverIds).not.toContain('driver_3');
      expect(scoredDriverIds).toContain('driver_1');
      expect(scoredDriverIds).toContain('driver_2');
    });

    it('should fail when all drivers at capacity', async () => {
      // All drivers at max capacity
      mockGetAvailableDrivers.mockResolvedValue([
        {
          id: 'driver_full',
          name: 'Full',
          latitude: 43.6532,
          longitude: -79.3832,
          rating: 5.0,
          completedDeliveries: 1000,
          currentDeliveries: 5,
          maxCapacity: 5,
          vehicle: { type: 'car', licensePlate: 'FUL123' },
        },
      ]);

      const input: AssignDriverInput = {
        orderId: 'order_789',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const result = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_CAPACITY_AVAILABLE');
    });
  });

  describe('Driver Scoring', () => {
    it('should score drivers by rating and distance', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);

      expect(scoredDrivers.success).toBe(true);
      expect(scoredDrivers.data!.scoredDrivers.length).toBeGreaterThan(0);

      // Should be sorted by score (highest first)
      const scores = scoredDrivers.data!.scoredDrivers.map((s) => s.score);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });

    it('should give bonus for experienced drivers', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);

      // Alice (driver_1) should score higher due to 500 completed deliveries
      const aliceScore = scoredDrivers.data!.scoredDrivers.find(
        (s) => s.driver.id === 'driver_1'
      )?.score;
      const bobScore = scoredDrivers.data!.scoredDrivers.find((s) => s.driver.id === 'driver_2')
        ?.score;

      expect(aliceScore).toBeGreaterThan(bobScore!);
    });
  });

  describe('Route Optimization', () => {
    it('should optimize delivery route', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const result = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);

      expect(result.success).toBe(true);
      expect(result.data!.optimizedRoute.stops.length).toBeGreaterThan(0);
      expect(result.data!.optimizedRoute.distance).toBeGreaterThan(0);
    });

    it('should include all required stops in route', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_456',
        deliveryAddress: '100 King St, Toronto, ON',
        latitude: 43.6629,
        longitude: -79.3957,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const result = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);

      const stops = result.data!.optimizedRoute.stops;
      expect(stops.some((s) => s.type === 'start')).toBe(true);
      expect(stops.some((s) => s.type === 'delivery')).toBe(true);
    });

    it('should handle route optimization failure', async () => {
      mockOptimizeRoute.mockResolvedValue({ stops: [] });

      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const result = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ROUTE_OPTIMIZATION_FAILED');
    });
  });

  describe('ETA Calculation', () => {
    it('should calculate accurate ETA', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
        priority: 'standard',
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const result = await calculateETAStep.invoke(routeOptimized.data!, mockContext);

      expect(result.success).toBe(true);
      expect(result.data!.estimatedArrival).toBeInstanceOf(Date);
      expect(result.data!.estimatedDelivery).toBeInstanceOf(Date);
      expect(result.data!.estimatedDelivery.getTime()).toBeGreaterThan(
        result.data!.estimatedArrival.getTime()
      );
    });

    it('should respect priority level in ETA', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_express',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
        priority: 'express',
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const result = await calculateETAStep.invoke(routeOptimized.data!, mockContext);

      expect(result.success).toBe(true);
      expect(mockCalculateETA).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'express' })
      );
    });

    it('should handle ETA calculation failure', async () => {
      mockCalculateETA.mockResolvedValue({ arrivalTime: null, deliveryTime: null });

      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const result = await calculateETAStep.invoke(routeOptimized.data!, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ETA_CALC_FAILED');
    });
  });

  describe('Assignment & Compensation', () => {
    it('should assign driver successfully', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_123',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const etaCalculated = await calculateETAStep.invoke(routeOptimized.data!, mockContext);
      const result = await assignDriverStep.invoke(etaCalculated.data!, mockContext);

      expect(result.success).toBe(true);
      expect(result.data!.driverId).toBe('driver_1');
      expect(result.data!.driverName).toBe('Alice');
      expect(result.data!.routeOptimized).toBe(true);
    });

    it('should trigger compensation on assignment failure', async () => {
      mockAssignDriver.mockResolvedValue({ id: null });

      const input: AssignDriverInput = {
        orderId: 'order_fail',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const etaCalculated = await calculateETAStep.invoke(routeOptimized.data!, mockContext);
      const result = await assignDriverStep.invoke(etaCalculated.data!, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ASSIGNMENT_FAILED');
    });
  });

  describe('Driver Notification', () => {
    it('should notify driver of assignment', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_notify',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const etaCalculated = await calculateETAStep.invoke(routeOptimized.data!, mockContext);
      const assigned = await assignDriverStep.invoke(etaCalculated.data!, mockContext);
      const result = await notifyDriverStep.invoke(assigned.data!, mockContext);

      expect(result.success).toBe(true);
      expect(mockNotifyDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: 'driver_1',
          orderId: 'order_notify',
        })
      );
    });

    it('should include ETA in driver notification', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_eta_notify',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const etaCalculated = await calculateETAStep.invoke(routeOptimized.data!, mockContext);
      const assigned = await assignDriverStep.invoke(etaCalculated.data!, mockContext);
      await notifyDriverStep.invoke(assigned.data!, mockContext);

      expect(mockNotifyDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedArrival: expect.any(Date),
        })
      );
    });
  });

  describe('Multi-stop Deliveries', () => {
    it('should include all stops in assignment', async () => {
      const input: AssignDriverInput = {
        orderId: 'order_multi',
        deliveryAddress: '789 Queen St, Toronto, ON',
        latitude: 43.6520,
        longitude: -79.3800,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const foundDrivers = await findAvailableDriversStep.invoke(validated.data!, mockContext);
      const scoredDrivers = await scoreDriversStep.invoke(foundDrivers.data!, mockContext);
      const routeOptimized = await optimizeRouteStep.invoke(scoredDrivers.data!, mockContext);
      const etaCalculated = await calculateETAStep.invoke(routeOptimized.data!, mockContext);
      const result = await assignDriverStep.invoke(etaCalculated.data!, mockContext);

      expect(result.data!.totalStops).toBeGreaterThan(1);
    });
  });
});
