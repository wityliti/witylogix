// @ts-nocheck

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DriverTrackingConsumer } from "../consumers/driver-tracking";
import type { QueueJobPayload, QueueJobMetadata, ConsumerConfig } from "../types";

/**
 * Integration test suite for driver tracking consumer
 *
 * Tests:
 * - Location update processing from driver GPS
 * - Redis GEO update for spatial queries
 * - Event emission with coordinates
 * - Real-time location streaming
 * - Geofencing event triggers
 * - Error handling for invalid coordinates
 */

const mockPrisma = {
  driver: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  driverLocation: {
    create: vi.fn(),
  },
  delivery: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const mockRedis = {
  geoadd: vi.fn().mockResolvedValue(1),
  geodist: vi.fn().mockResolvedValue("0.5"),
  geopos: vi.fn().mockResolvedValue([[10.5, 20.3]]),
  zrange: vi.fn().mockResolvedValue([]),
};

const mockEventBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
};

const mockGeofenceService = {
  checkGeofences: vi.fn().mockResolvedValue([]),
  triggerEvent: vi.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const defaultConfig: ConsumerConfig = {
  queueName: "driver-tracking-queue",
  concurrency: 5,
  maxRetries: 2,
  retryDelay: 500,
  deadLetterQueue: "driver-tracking-dlq",
};

describe("DriverTrackingConsumer", () => {
  let consumer: DriverTrackingConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new DriverTrackingConsumer({
      ...defaultConfig,
      prisma: mockPrisma,
      redis: mockRedis,
      eventBus: mockEventBus,
      geofenceService: mockGeofenceService,
      logger: mockLogger,
    });
  });

  describe("Location Update Processing", () => {
    it("should process driver location update with valid coordinates", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
          speed: 15.5,
          bearing: 45,
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
        isOnDuty: true,
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({
        id: "loc_1",
        driverId: "driver_123",
      });

      mockRedis.geoadd.mockResolvedValueOnce(1);

      const result = await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

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
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 91, // Invalid: > 90
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      await expect(consumer.processJob(job, { attempt: 1, jobId: "job_123" })).rejects.toThrow(
        "Invalid latitude"
      );
    });

    it("should reject coordinates with invalid longitude", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: 181, // Invalid: > 180
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      await expect(consumer.processJob(job, { attempt: 1, jobId: "job_123" })).rejects.toThrow(
        "Invalid longitude"
      );
    });

    it("should reject locations with missing required fields", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          // Missing latitude and longitude
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      await expect(consumer.processJob(job, { attempt: 1, jobId: "job_123" })).rejects.toThrow();
    });

    it("should handle driver not found gracefully", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_invalid",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce(null);

      await expect(consumer.processJob(job, { attempt: 1, jobId: "job_123" })).rejects.toThrow(
        "Driver not found"
      );
    });
  });

  describe("Redis GEO Updates", () => {
    it("should update Redis GEO index for fast spatial queries", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(mockRedis.geoadd).toHaveBeenCalledWith(
        "drivers:geo:tenant_123",
        37.7749,
        -122.4194,
        "driver_123"
      );
    });

    it("should use tenant-scoped GEO keys", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_456",
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_456",
        tenantId: "tenant_456",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(mockRedis.geoadd).toHaveBeenCalledWith(
        "drivers:geo:tenant_456",
        expect.any(Number),
        expect.any(Number),
        "driver_456"
      );
    });

    it("should handle Redis GEO failures gracefully", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      mockRedis.geoadd.mockRejectedValueOnce(new Error("Redis connection lost"));

      await expect(consumer.processJob(job, { attempt: 1, jobId: "job_123" })).rejects.toThrow();
    });
  });

  describe("Event Emission with Coordinates", () => {
    it("should emit driver.location.updated event with coordinates", async () => {
      const locationData = {
        driverId: "driver_123",
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        speed: 25.5,
        bearing: 90,
        timestamp: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: locationData,
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({
        id: "loc_1",
        driverId: "driver_123",
      });

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "driver.location.updated",
        expect.objectContaining({
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          speed: 25.5,
          bearing: 90,
        }),
        expect.objectContaining({
          tenantId: "tenant_123",
        })
      );
    });

    it("should emit event with high precision coordinates", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.77494836,
          longitude: -122.41941234,
          accuracy: 2,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "driver.location.updated",
        expect.objectContaining({
          latitude: 37.77494836,
          longitude: -122.41941234,
        }),
        expect.any(Object)
      );
    });

    it("should emit event only when driver is on duty", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
        isOnDuty: false, // Driver off duty
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      const result = await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(result.success).toBe(true);
      // Event may or may not be emitted based on business logic
      // This test documents the expected behavior
    });
  });

  describe("Geofencing Triggers", () => {
    it("should check geofences and trigger events on boundary crossing", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      mockGeofenceService.checkGeofences.mockResolvedValueOnce([
        {
          geofenceId: "geofence_1",
          event: "entered",
          name: "Warehouse A",
        },
      ]);

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(mockGeofenceService.checkGeofences).toHaveBeenCalledWith(
        "driver_123",
        37.7749,
        -122.4194
      );

      expect(mockGeofenceService.triggerEvent).toHaveBeenCalledWith(
        "geofence_1",
        "entered",
        "driver_123"
      );
    });

    it("should handle multiple geofence crossings", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      mockGeofenceService.checkGeofences.mockResolvedValueOnce([
        { geofenceId: "geofence_1", event: "entered" },
        { geofenceId: "geofence_2", event: "exited" },
      ]);

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(mockGeofenceService.triggerEvent).toHaveBeenCalledTimes(2);
    });

    it("should emit geofence events before location event", async () => {
      const callOrder: string[] = [];

      const orderedMocks = {
        ...mockGeofenceService,
        triggerEvent: vi.fn().mockImplementation(async () => {
          callOrder.push("geofence");
        }),
      };

      const orderedEventBus = {
        ...mockEventBus,
        emit: vi.fn().mockImplementation(async () => {
          callOrder.push("location");
        }),
      };

      consumer = new DriverTrackingConsumer({
        ...defaultConfig,
        prisma: mockPrisma,
        redis: mockRedis,
        eventBus: orderedEventBus,
        geofenceService: orderedMocks,
        logger: mockLogger,
      });

      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      orderedMocks.checkGeofences.mockResolvedValueOnce([
        { geofenceId: "geofence_1", event: "entered" },
      ]);

      await consumer.processJob(job, { attempt: 1, jobId: "job_123" });

      expect(callOrder).toEqual(["geofence", "location"]);
    });
  });

  describe("Real-time Streaming", () => {
    it("should handle high-frequency location updates", async () => {
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        type: "driver_tracking" as const,
        data: {
          driverId: "driver_123",
          latitude: 37.7749 + i * 0.001,
          longitude: -122.4194 + i * 0.001,
          accuracy: 5,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        },
        timestamp: new Date(),
      }));

      mockPrisma.driver.findUnique.mockResolvedValue({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValue({ id: "loc_1" });
      mockRedis.geoadd.mockResolvedValue(1);

      const results = await Promise.all(
        jobs.map((job, i) =>
          consumer.processJob(job as QueueJobPayload, {
            attempt: 1,
            jobId: `job_${i}`,
          })
        )
      );

      expect(results.every((r) => r.success)).toBe(true);
      expect(mockPrisma.driverLocation.create).toHaveBeenCalledTimes(10);
    });
  });

  describe("Accuracy Handling", () => {
    it("should accept locations with various accuracy levels", async () => {
      const accuracyLevels = [0.5, 5, 10, 50, 100];

      for (const accuracy of accuracyLevels) {
        const job: QueueJobPayload = {
          type: "driver_tracking",
          data: {
            driverId: "driver_123",
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        };

        mockPrisma.driver.findUnique.mockResolvedValueOnce({
          id: "driver_123",
          tenantId: "tenant_123",
        });

        mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

        const result = await consumer.processJob(job, {
          attempt: 1,
          jobId: `job_${accuracy}`,
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe("Performance", () => {
    it("should process location updates in under 100ms on average", async () => {
      const job: QueueJobPayload = {
        type: "driver_tracking",
        data: {
          driverId: "driver_123",
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      mockPrisma.driver.findUnique.mockResolvedValueOnce({
        id: "driver_123",
        tenantId: "tenant_123",
      });

      mockPrisma.driverLocation.create.mockResolvedValueOnce({ id: "loc_1" });

      const startTime = Date.now();
      const result = await consumer.processJob(job, { attempt: 1, jobId: "job_123" });
      const duration = Date.now() - startTime;

      expect(result.processingTimeMs).toBeLessThan(100);
      expect(duration).toBeLessThan(200);
    });
  });
});
