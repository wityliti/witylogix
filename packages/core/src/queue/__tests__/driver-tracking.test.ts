// @ts-nocheck

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DriverTrackingConsumer } from "../consumers/driver-tracking";
import type { QueueJobPayload, QueueJobMetadata, ConsumerConfig } from "../types";

/**
 * Integration test suite for driver tracking consumer
 *
 * Tests:
 * - Location update processing from driver GPS
 * - Geofence checking and violation handling
 * - Event emission with coordinates
 * - Real-time location streaming
 * - Error handling for invalid coordinates
 */

// Use vi.hoisted so mock object is available when vi.mock factory runs (hoisted to top)
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    driver: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    driverLocation: {
      create: vi.fn().mockResolvedValue({ id: "loc_1" }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    restrictedArea: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    geofenceViolation: {
      create: vi.fn().mockResolvedValue({}),
    },
    route: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    routeStop: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { mockPrisma };
});

vi.mock("@witylogix/db", () => ({
  prisma: mockPrisma,
}));

const mockEventBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
};

const defaultConfig: ConsumerConfig = {
  queueName: "driver-tracking-queue",
  concurrency: 5,
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  lockDuration: 30000,
  lockRenewTime: 15000,
  prefix: "bull",
};

/** Helper to build a valid DriverTrackingJob wrapped in QueueJobPayload */
function makeDriverJob(overrides: Record<string, any> = {}): QueueJobPayload {
  const payload = {
    latitude: 37.7749,
    longitude: -122.4194,
    heading: 0,
    speed: 15.5,
    accuracy: 5,
    timestamp: Date.now(),
    ...overrides.payload,
  };
  return {
    type: "driver_tracking",
    data: {
      driverId: overrides.driverId ?? "driver_123",
      companyId: overrides.companyId ?? "company_123",
      payload,
    },
  };
}

describe("DriverTrackingConsumer", () => {
  let consumer: DriverTrackingConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    // Constructor signature: (config: ConsumerConfig, eventBus?)
    consumer = new DriverTrackingConsumer(defaultConfig, mockEventBus as any);
  });

  describe("Location Update Processing", () => {
    it("should process driver location update with valid coordinates", async () => {
      const job = makeDriverJob({
        payload: { latitude: 37.7749, longitude: -122.4194, accuracy: 5, speed: 15.5, heading: 45, timestamp: Date.now() },
      });

      mockPrisma.driver.update.mockResolvedValueOnce({ id: "driver_123" });
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1", driverId: "driver_123" });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
      expect(mockPrisma.driverLocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
        }),
      });
    });

    it("should reject coordinates with invalid latitude", async () => {
      const job = makeDriverJob({
        payload: { latitude: 91, longitude: -122.4194, heading: 0, speed: 0, accuracy: 5, timestamp: Date.now() },
      });

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Invalid latitude");
    });

    it("should reject coordinates with invalid longitude", async () => {
      const job = makeDriverJob({
        payload: { latitude: 37.7749, longitude: 181, heading: 0, speed: 0, accuracy: 5, timestamp: Date.now() },
      });

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Invalid longitude");
    });

    it("should reject locations with missing required fields", async () => {
      // latitude/longitude are not numbers (undefined), so validation fails
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          companyId: "company_123",
          payload: {
            // Missing latitude and longitude (will be undefined)
            heading: 0,
            speed: 0,
            accuracy: 5,
            timestamp: Date.now(),
          },
        },
      };

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
    });

    it("should handle database error during position update gracefully", async () => {
      const job = makeDriverJob();

      mockPrisma.driver.update.mockRejectedValueOnce(new Error("database connection lost"));

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
    });
  });

  describe("Database Updates", () => {
    it("should update driver position in database", async () => {
      const timestamp = Date.now();
      const job = makeDriverJob({
        payload: { latitude: 37.7749, longitude: -122.4194, heading: 90, speed: 25, accuracy: 5, timestamp },
      });

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.executeJob(job);

      expect(mockPrisma.driver.update).toHaveBeenCalledWith({
        where: { id: "driver_123" },
        data: expect.objectContaining({
          latitude: 37.7749,
          longitude: -122.4194,
          heading: 90,
          speed: 25,
        }),
      });
    });

    it("should store location history record", async () => {
      const job = makeDriverJob({
        payload: { latitude: 40.7128, longitude: -74.006, heading: 0, speed: 0, accuracy: 10, timestamp: Date.now() },
      });

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.executeJob(job);

      expect(mockPrisma.driverLocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driverId: "driver_123",
          latitude: 40.7128,
          longitude: -74.006,
        }),
      });
    });

    it("should handle Redis/database failures gracefully", async () => {
      const job = makeDriverJob();

      mockPrisma.driver.update.mockRejectedValueOnce(new Error("database connection lost"));

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
    });
  });

  describe("Event Emission with Coordinates", () => {
    it("should emit driver.location_updated event with coordinates", async () => {
      const job = makeDriverJob({
        payload: { latitude: 37.7749, longitude: -122.4194, heading: 90, speed: 25.5, accuracy: 5, timestamp: Date.now() },
      });

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.executeJob(job);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "driver.location_updated",
        expect.objectContaining({
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 25.5,
        }),
        expect.objectContaining({
          tenantId: "company_123",
        })
      );
    });

    it("should emit event with high precision coordinates", async () => {
      const job = makeDriverJob({
        payload: { latitude: 37.77494836, longitude: -122.41941234, heading: 0, speed: 0, accuracy: 2, timestamp: Date.now() },
      });

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.executeJob(job);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "driver.location_updated",
        expect.objectContaining({
          latitude: 37.77494836,
          longitude: -122.41941234,
        }),
        expect.any(Object)
      );
    });

    it("should still succeed even when driver is processing normally", async () => {
      const job = makeDriverJob();

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
    });
  });

  describe("Geofencing Triggers", () => {
    it("should check geofences during processing", async () => {
      const job = makeDriverJob();

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      const result = await consumer.executeJob(job);

      // The consumer always checks restricted areas
      expect(mockPrisma.restrictedArea.findFirst).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle geofence violations when restricted area found", async () => {
      const job = makeDriverJob();

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });
      mockPrisma.restrictedArea.findFirst.mockResolvedValueOnce({ id: "restricted_1" });

      const result = await consumer.executeJob(job);

      // Violation is logged via geofenceViolation.create
      expect(mockPrisma.geofenceViolation.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should check destination zone when orderId is present", async () => {
      const job = makeDriverJob({
        payload: {
          latitude: 37.7749,
          longitude: -122.4194,
          heading: 0,
          speed: 0,
          accuracy: 5,
          timestamp: Date.now(),
          orderId: "order_123",
        },
      });

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: "order_123",
        destinationLatitude: 37.78,
        destinationLongitude: -122.42,
      });

      const result = await consumer.executeJob(job);

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order_123" },
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Real-time Streaming", () => {
    it("should handle high-frequency location updates", async () => {
      const jobs = Array.from({ length: 10 }, (_, i) =>
        makeDriverJob({
          payload: {
            latitude: 37.7749 + i * 0.001,
            longitude: -122.4194 + i * 0.001,
            heading: 0,
            speed: 15,
            accuracy: 5,
            timestamp: Date.now() + i * 1000,
          },
        })
      );

      mockPrisma.driver.update.mockResolvedValue({});
      mockPrisma.driverLocation.create.mockResolvedValue({ id: "loc_1" });

      const results = await Promise.all(
        jobs.map((job) => consumer.executeJob(job))
      );

      expect(results.every((r) => r.success)).toBe(true);
      expect(mockPrisma.driverLocation.create).toHaveBeenCalledTimes(10);
    });
  });

  describe("Accuracy Handling", () => {
    it("should accept locations with various accuracy levels", async () => {
      const accuracyLevels = [0.5, 5, 10, 50, 100];

      for (const accuracy of accuracyLevels) {
        vi.clearAllMocks();
        mockPrisma.driver.update.mockResolvedValueOnce({});
        mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

        const job = makeDriverJob({
          payload: { latitude: 37.7749, longitude: -122.4194, heading: 0, speed: 0, accuracy, timestamp: Date.now() },
        });

        const result = await consumer.executeJob(job);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Performance", () => {
    it("should process location updates and report processing time", async () => {
      const job = makeDriverJob();

      mockPrisma.driver.update.mockResolvedValueOnce({});
      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
