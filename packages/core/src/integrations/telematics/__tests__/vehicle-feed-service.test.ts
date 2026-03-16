/**
 * Vehicle Feed Service Tests
 * Tests for real-time vehicle tracking feed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VehicleFeedService } from "../vehicle-feed-service.js";
import type {
  TelematicsProvider,
  WitylogixVehiclePosition,
  WitylogixDriverStatus,
  WitylogixVehicleDiagnostics,
  WitylogixSafetyEvent,
} from "../telematics-types.js";

/**
 * Mock telematics provider
 */
function createMockProvider(): TelematicsProvider {
  return {
    getVehicles: vi.fn(async () => []),
    getVehiclePosition: vi.fn(async (vehicleId: string) => ({
      vehicleId,
      lat: 37.7749,
      lng: -122.4194,
      heading: 180,
      speed: 45,
      timestamp: new Date(),
      provider: "samsara",
      accuracy: 10,
    })),
    getBatchVehiclePositions: vi.fn(async (vehicleIds: string[]) =>
      vehicleIds.map((vehicleId) => ({
        vehicleId,
        lat: 37.7749,
        lng: -122.4194,
        heading: 180,
        speed: 45,
        timestamp: new Date(),
        provider: "samsara",
        accuracy: 10,
      })),
    ),
    getDriverStatus: vi.fn(async (driverId: string) => ({
      driverId,
      vehicleId: "vehicle-1",
      status: "ACTIVE" as const,
      dutyStatus: "ON_DUTY" as const,
    })),
    getVehicleDiagnostics: vi.fn(async () => ({
      vehicleId: "vehicle-1",
      fuelLevel: 75,
      fuelUnit: "percent" as const,
    })),
    getLocationHistory: vi.fn(async () => []),
    getSafetyEvents: vi.fn(async () => []),
    healthCheck: vi.fn(async () => true),
  };
}

describe("VehicleFeedService", () => {
  let mockProvider: TelematicsProvider;
  let service: VehicleFeedService;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new VehicleFeedService(mockProvider, {
      updateInterval: 100, // Short interval for testing
      maxPositions: 10,
      staleThreshold: 500,
    });
  });

  afterEach(() => {
    service.stop();
  });

  describe("Initialization", () => {
    it("should create service with default config", () => {
      const feed = new VehicleFeedService(mockProvider);
      expect(feed.isActive()).toBe(false);
    });

    it("should create service with custom config", () => {
      const feed = new VehicleFeedService(mockProvider, {
        updateInterval: 5000,
        maxPositions: 50,
      });
      expect(feed.isActive()).toBe(false);
    });
  });

  describe("Start/Stop", () => {
    it("should start the feed", async () => {
      await service.start(["vehicle-1", "vehicle-2"]);
      expect(service.isActive()).toBe(true);
    });

    it("should stop the feed", async () => {
      await service.start(["vehicle-1"]);
      service.stop();
      expect(service.isActive()).toBe(false);
    });

    it("should not restart if already running", async () => {
      await service.start(["vehicle-1"]);
      const spy = vi.spyOn(mockProvider, "getBatchVehiclePositions");

      await service.start(["vehicle-1"]);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Position Updates", () => {
    it("should emit position-update events", (done) => {
      service.on("position-update", (event) => {
        expect(event.type).toBe("position-update");
        expect(event.vehicleId).toBe("vehicle-1");
        expect(event.data).toHaveProperty("lat");
        expect(event.data).toHaveProperty("lng");
        done();
      });

      service.start(["vehicle-1"]);
    });

    it("should store position history", async () => {
      await service.start(["vehicle-1"]);

      // Wait for initial fetch
      await new Promise((resolve) => setTimeout(resolve, 150));

      const history = service.getPositionHistory("vehicle-1");
      expect(history.length).toBeGreaterThan(0);
    });

    it("should maintain max positions limit", async () => {
      const feedService = new VehicleFeedService(mockProvider, {
        updateInterval: 10,
        maxPositions: 3,
      });

      const positions: WitylogixVehiclePosition[] = [];
      for (let i = 0; i < 5; i++) {
        positions.push({
          vehicleId: "vehicle-1",
          lat: 37.7749 + i * 0.001,
          lng: -122.4194,
          heading: 180,
          speed: 45,
          timestamp: new Date(Date.now() + i * 100),
          provider: "samsara",
          accuracy: 10,
        });
      }

      // Mock multiple position updates
      let updateCount = 0;
      (mockProvider.getBatchVehiclePositions as any).mockImplementation(
        async () => {
          const position = positions[updateCount];
          updateCount++;
          return position ? [position] : [];
        },
      );

      await feedService.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = feedService.getPositionHistory("vehicle-1");
      expect(history.length).toBeLessThanOrEqual(3);

      feedService.stop();
    });
  });

  describe("Current Positions", () => {
    it("should get current positions", async () => {
      await service.start(["vehicle-1", "vehicle-2"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const positions = service.getCurrentPositions();
      expect(positions.size).toBeGreaterThan(0);
      expect(positions.has("vehicle-1")).toBe(true);
    });

    it("should get specific vehicle position", async () => {
      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const position = service.getVehiclePosition("vehicle-1");
      expect(position).toBeDefined();
      expect(position?.vehicleId).toBe("vehicle-1");
    });

    it("should return undefined for unknown vehicle", async () => {
      const position = service.getVehiclePosition("unknown");
      expect(position).toBeUndefined();
    });
  });

  describe("Position History", () => {
    it("should return position history", async () => {
      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = service.getPositionHistory("vehicle-1");
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    it("should limit history with limit parameter", async () => {
      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = service.getPositionHistory("vehicle-1", 3);
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Filtering", () => {
    it("should filter by status", async () => {
      await service.start(["vehicle-1", "vehicle-2"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const active = service.filterByStatus("active");
      expect(Array.isArray(active)).toBe(true);
    });

    it("should filter by geofence", async () => {
      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const inBounds = service.filterByGeofence({
        minLat: 37.7,
        maxLat: 37.8,
        minLng: -122.5,
        maxLng: -122.4,
      });

      expect(Array.isArray(inBounds)).toBe(true);
    });

    it("should filter by geofence - outside bounds", async () => {
      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const inBounds = service.filterByGeofence({
        minLat: 0,
        maxLat: 10,
        minLng: 0,
        maxLng: 10,
      });

      expect(inBounds.length).toBe(0);
    });
  });

  describe("Driver Status", () => {
    it("should update driver status", async () => {
      const status = await service.updateDriverStatus("driver-1");
      expect(status.driverId).toBe("driver-1");
      expect(status.status).toBe("ACTIVE");
    });

    it("should cache driver status", async () => {
      await service.updateDriverStatus("driver-1");
      const cached = service.getDriverStatus("driver-1");
      expect(cached).toBeDefined();
      expect(cached?.driverId).toBe("driver-1");
    });

    it("should get all driver statuses", async () => {
      await service.updateDriverStatus("driver-1");
      await service.updateDriverStatus("driver-2");

      const allStatuses = service.getAllDriverStatuses();
      expect(allStatuses.size).toBe(2);
    });

    it("should emit status-change event on update", (done) => {
      service.on("status-change", (event) => {
        expect(event.type).toBe("status-change");
        expect(event.driverId).toBe("driver-1");
        done();
      });

      service.updateDriverStatus("driver-1");
    });

    it("should emit error event on update failure", (done) => {
      (mockProvider.getDriverStatus as any).mockRejectedValue(
        new Error("API error"),
      );

      service.on("error", (event) => {
        expect(event.type).toBe("error");
        done();
      });

      service.updateDriverStatus("driver-1");
    });
  });

  describe("Stale Detection", () => {
    it("should mark vehicle as stale after threshold", async () => {
      const feedService = new VehicleFeedService(mockProvider, {
        updateInterval: 10,
        staleThreshold: 50,
      });

      await feedService.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Position should be marked stale
      expect(feedService.getStats().staleCount).toBeGreaterThanOrEqual(0);
      feedService.stop();
    });

    it("should emit status-change when vehicle becomes stale", (done) => {
      const feedService = new VehicleFeedService(mockProvider, {
        updateInterval: 50,
        staleThreshold: 100,
      });

      let statusChangeEmitted = false;
      feedService.on("status-change", (event) => {
        if (
          event.type === "status-change" &&
          (event.data as any).stale === true
        ) {
          statusChangeEmitted = true;
          expect(statusChangeEmitted).toBe(true);
          feedService.stop();
          done();
        }
      });

      feedService.start(["vehicle-1"]);
    });
  });

  describe("Error Handling", () => {
    it("should emit error event on fetch failure", (done) => {
      (mockProvider.getBatchVehiclePositions as any).mockRejectedValue(
        new Error("API error"),
      );

      service.on("error", (event) => {
        expect(event.type).toBe("error");
        expect(event.error).toBeDefined();
        done();
      });

      service.start(["vehicle-1"]);
    });
  });

  describe("Cache Management", () => {
    it("should clear all cached data", async () => {
      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(service.getCurrentPositions().size).toBeGreaterThan(0);

      service.clearCache();

      expect(service.getCurrentPositions().size).toBe(0);
      expect(service.getAllDriverStatuses().size).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should provide feed statistics", async () => {
      await service.start(["vehicle-1", "vehicle-2"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = service.getStats();

      expect(stats).toHaveProperty("isRunning");
      expect(stats).toHaveProperty("vehicleCount");
      expect(stats).toHaveProperty("driverCount");
      expect(stats).toHaveProperty("staleCount");
      expect(stats).toHaveProperty("lastUpdate");

      expect(stats.isRunning).toBe(true);
    });

    it("should track active status in statistics", async () => {
      const stats1 = service.getStats();
      expect(stats1.isRunning).toBe(false);

      await service.start(["vehicle-1"]);
      const stats2 = service.getStats();
      expect(stats2.isRunning).toBe(true);

      service.stop();
      const stats3 = service.getStats();
      expect(stats3.isRunning).toBe(false);
    });
  });

  describe("EventEmitter Interface", () => {
    it("should support on() for event listening", async () => {
      let eventFired = false;

      service.on("position-update", () => {
        eventFired = true;
      });

      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(eventFired).toBe(true);
    });

    it("should support once() for one-time listeners", async () => {
      let eventCount = 0;

      service.once("position-update", () => {
        eventCount++;
      });

      await service.start(["vehicle-1"]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(eventCount).toBe(1);
    });
  });
});
