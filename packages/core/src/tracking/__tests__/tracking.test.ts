/**
 * Comprehensive test suite for tracking module (ETA calculator, Geofence, GPS service).
 * Tests cover ETA calculations with various scenarios, geofence detection,
 * GPS coordinate validation, and module integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ETACalculator, type ETAResult, type DeliveryRecord } from "../eta-calculator";
import {
  GeofenceManager,
  type Geofence,
  type GeofenceEvent,
} from "../geofence";
import { GPSTrackingService, type GPSUpdate, type DriverLocation } from "../gps-service";

// ============================================================================
// ETA Calculator Tests
// ============================================================================

describe("ETACalculator", () => {
  let calculator: ETACalculator;

  beforeEach(() => {
    calculator = new ETACalculator({ defaultSpeedKmh: 45 });
  });

  describe("calculateBasicETA", () => {
    it("should calculate basic ETA with standard distance and speed", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result = calculator.calculateBasicETA(current, destination, speed);

      expect(result).toHaveProperty("estimatedArrival");
      expect(result).toHaveProperty("estimatedMinutes");
      expect(result.estimatedMinutes).toBeGreaterThan(0);
      expect(result.confidence).toMatch(/high|medium|low/);
      expect(result.distanceRemaining).toBeGreaterThan(0);
      expect(result.factors).toBeInstanceOf(Array);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it("should return estimated arrival time in future", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 30;

      const result = calculator.calculateBasicETA(current, destination, speed);
      const now = new Date();

      expect(result.estimatedArrival.getTime()).toBeGreaterThan(now.getTime());
    });

    it("should handle same location (zero distance)", () => {
      const position = { lat: 40.7128, lng: -74.006 };

      const result = calculator.calculateBasicETA(position, position, 40);

      expect(result.estimatedMinutes).toBe(0);
      expect(result.distanceRemaining).toBe(0);
      expect(result.confidence).toBe("high");
    });

    it("should use default speed when speed is zero", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      const result = calculator.calculateBasicETA(current, destination, 0);

      expect(result.estimatedMinutes).toBeGreaterThan(0);
      expect(result.factors.some((f) => f.includes("45"))).toBe(true);
    });

    it("should handle short distances (< 1km)", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.7129, lng: -74.0061 };
      const speed = 20;

      const result = calculator.calculateBasicETA(current, destination, speed);

      expect(result.estimatedMinutes).toBeLessThan(10);
      expect(result.distanceRemaining).toBeLessThan(1000);
    });

    it("should handle long distances (> 100km)", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 42.7, lng: -74.006 };
      const speed = 80;

      const result = calculator.calculateBasicETA(current, destination, speed);

      expect(result.estimatedMinutes).toBeGreaterThan(60);
      expect(result.confidence).toBe("low");
    });

    it("should calculate confidence as medium for typical scenarios", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.85, lng: -73.9855 }; // ~10km distance
      const speed = 20; // Low speed prevents high confidence

      const result = calculator.calculateBasicETA(current, destination, speed);

      expect(result.confidence).toBe("medium");
    });
  });

  describe("calculateTrafficAwareETA", () => {
    it("should apply traffic multipliers to basic calculation", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const basicResult = calculator.calculateBasicETA(
        current,
        destination,
        speed
      );
      const trafficResult = calculator.calculateTrafficAwareETA(
        current,
        destination,
        speed
      );

      // Traffic-aware should have factors mentioning traffic multiplier
      expect(trafficResult.factors.some((f) => f.includes("multiplier"))).toBe(
        true
      );
    });

    it("should include traffic alert warning for heavy traffic", () => {
      vi.useFakeTimers();
      // Set time to 8 AM (peak morning rush)
      vi.setSystemTime(new Date(2024, 0, 1, 8, 0, 0));

      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result = calculator.calculateTrafficAwareETA(
        current,
        destination,
        speed
      );

      // Should have heavy traffic warning
      const hasWarning = result.factors.some((f) => f.includes("Heavy traffic"));
      expect(hasWarning).toBe(true);
      expect(result.estimatedMinutes).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it("should indicate light traffic conditions for off-peak hours", () => {
      vi.useFakeTimers();
      // Set time to 3 AM (off-peak)
      vi.setSystemTime(new Date(2024, 0, 1, 3, 0, 0));

      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result = calculator.calculateTrafficAwareETA(
        current,
        destination,
        speed
      );

      const hasLightTraffic = result.factors.some((f) =>
        f.includes("Light traffic")
      );
      expect(hasLightTraffic).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("calculateWithHistory", () => {
    it("should return basic ETA when insufficient historical data", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result = calculator.calculateWithHistory(
        current,
        destination,
        speed,
        "downtown"
      );

      expect(result.estimatedMinutes).toBeGreaterThan(0);
      // Without historical data, it returns basic ETA which may be high for short distances
      expect(result.factors.some(f => !f.includes("Historical"))).toBe(true);
    });

    it("should improve confidence with historical data", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      // Record multiple deliveries
      for (let i = 0; i < 5; i++) {
        calculator.recordDelivery({
          distance: 5,
          timeTaken: 10,
          hour: 14,
          dayOfWeek: 3,
          area: "downtown",
        });
      }

      const result = calculator.calculateWithHistory(
        current,
        destination,
        speed,
        "downtown"
      );

      expect(result.confidence).toBe("high");
      expect(result.factors.some((f) => f.includes("Historical"))).toBe(true);
    });

    it("should adjust ETA based on historical average speed", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      // Record fast deliveries
      for (let i = 0; i < 5; i++) {
        calculator.recordDelivery({
          distance: 10,
          timeTaken: 8, // Very fast (75 km/h)
          hour: 14,
          dayOfWeek: 3,
          area: "fast-zone",
        });
      }

      const result = calculator.calculateWithHistory(
        current,
        destination,
        30,
        "fast-zone"
      );

      expect(result.factors.some((f) => f.includes("deliveries"))).toBe(true);
    });
  });

  describe("calculateMultiStopETA", () => {
    it("should return zero ETA for empty stops", () => {
      const current = { lat: 40.7128, lng: -74.006 };

      const result = calculator.calculateMultiStopETA(current, [], 40);

      expect(result.estimatedMinutes).toBe(0);
      expect(result.distanceRemaining).toBe(0);
      expect(result.factors.includes("No stops remaining")).toBe(true);
    });

    it("should calculate ETA for single stop", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const stops = [{ lat: 40.758, lng: -73.9855 }];
      const speed = 40;

      const result = calculator.calculateMultiStopETA(current, stops, speed, 1);

      expect(result.estimatedMinutes).toBeGreaterThan(0);
      expect(result.factors.some((f) => f.includes("Remaining stops: 1")))
        .toBe(true);
    });

    it("should account for service time at each stop", () => {
      const calculatorWithServiceTime = new ETACalculator({
        defaultSpeedKmh: 45,
        serviceTimePerStop: 10,
      });

      const current = { lat: 40.7128, lng: -74.006 };
      const stops = [
        { lat: 40.758, lng: -73.9855 },
        { lat: 40.7, lng: -74.0 },
      ];
      const speed = 40;

      const result = calculatorWithServiceTime.calculateMultiStopETA(
        current,
        stops,
        speed,
        2
      );

      // Should include service time
      expect(result.estimatedMinutes).toBeGreaterThan(30);
    });

    it("should increase uncertainty with more stops", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const stops = Array.from({ length: 5 }, (_, i) => ({
        lat: 40.7 + i * 0.01,
        lng: -74.0 + i * 0.01,
      }));

      const result = calculator.calculateMultiStopETA(
        current,
        stops,
        40,
        5
      );

      expect(result.confidence).toBe("medium");
      expect(result.factors.some((f) => f.includes("Congestion"))).toBe(true);
    });

    it("should handle multiple stops correctly", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const stops = [
        { lat: 40.758, lng: -73.9855 },
        { lat: 40.75, lng: -73.99 },
        { lat: 40.74, lng: -73.995 },
      ];

      const result = calculator.calculateMultiStopETA(current, stops, 40, 3);

      expect(result.distanceRemaining).toBeGreaterThan(0);
      expect(result.factors.some((f) => f.includes("Remaining stops: 3")))
        .toBe(true);
    });
  });

  describe("calculateWithWeather", () => {
    it("should not adjust ETA when weather is clear", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result = calculator.calculateWithWeather(
        current,
        destination,
        speed,
        "clear"
      );

      const baseResult = calculator.calculateBasicETA(
        current,
        destination,
        speed
      );
      expect(result.estimatedMinutes).toBe(baseResult.estimatedMinutes);
    });

    it("should increase ETA for rainy conditions", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const clearResult = calculator.calculateWithWeather(
        current,
        destination,
        speed,
        "clear"
      );
      const rainResult = calculator.calculateWithWeather(
        current,
        destination,
        speed,
        "rain"
      );

      expect(rainResult.estimatedMinutes).toBeGreaterThan(
        clearResult.estimatedMinutes
      );
    });

    it("should significantly increase ETA for snowy conditions", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const clearResult = calculator.calculateWithWeather(
        current,
        destination,
        speed,
        "clear"
      );
      const snowResult = calculator.calculateWithWeather(
        current,
        destination,
        speed,
        "snow"
      );

      expect(snowResult.estimatedMinutes).toBeGreaterThan(
        clearResult.estimatedMinutes * 1.4
      );
    });

    it("should include weather factor in result factors", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result = calculator.calculateWithWeather(
        current,
        destination,
        speed,
        "fog"
      );

      expect(result.factors.some((f) => f.includes("fog"))).toBe(true);
    });
  });

  describe("recordDelivery", () => {
    it("should record delivery and update area statistics", () => {
      const record: DeliveryRecord = {
        distance: 5,
        timeTaken: 15,
        hour: 14,
        dayOfWeek: 3,
        area: "test-area",
      };

      calculator.recordDelivery(record);

      const stats = calculator.getAreaStats("test-area");
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.avgSpeed).toBeGreaterThan(0);
    });

    it("should calculate average speed from distance and time", () => {
      calculator.recordDelivery({
        distance: 10, // 10 km
        timeTaken: 12, // 12 minutes = 0.2 hours
        hour: 14,
        dayOfWeek: 3,
        area: "speed-test",
      });

      const stats = calculator.getAreaStats("speed-test");
      // 10 km / 0.2 hours = 50 km/h
      expect(stats!.avgSpeed).toBeCloseTo(50, 1);
    });

    it("should update running average with multiple deliveries", () => {
      calculator.recordDelivery({
        distance: 10,
        timeTaken: 12,
        hour: 14,
        dayOfWeek: 3,
        area: "multi-area",
      });

      calculator.recordDelivery({
        distance: 10,
        timeTaken: 20,
        hour: 14,
        dayOfWeek: 3,
        area: "multi-area",
      });

      const stats = calculator.getAreaStats("multi-area");
      expect(stats!.count).toBe(2);
      expect(stats!.avgSpeed).toBeGreaterThan(0);
    });

    it("should maintain separate statistics for different areas", () => {
      calculator.recordDelivery({
        distance: 5,
        timeTaken: 10,
        hour: 14,
        dayOfWeek: 3,
        area: "area-1",
      });

      calculator.recordDelivery({
        distance: 10,
        timeTaken: 10,
        hour: 14,
        dayOfWeek: 3,
        area: "area-2",
      });

      const stats1 = calculator.getAreaStats("area-1");
      const stats2 = calculator.getAreaStats("area-2");

      expect(stats1!.avgSpeed).not.toEqual(stats2!.avgSpeed);
    });
  });

  describe("getAreaStats", () => {
    it("should return null for non-existent area", () => {
      const stats = calculator.getAreaStats("non-existent");
      expect(stats).toBeNull();
    });

    it("should return correct area statistics", () => {
      calculator.recordDelivery({
        distance: 20,
        timeTaken: 30,
        hour: 14,
        dayOfWeek: 3,
        area: "downtown",
      });

      const stats = calculator.getAreaStats("downtown");
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.avgSpeed).toBeCloseTo(40, 1); // 20km / 0.5h = 40 km/h
    });
  });

  describe("ETA calculation accuracy", () => {
    it("should return consistent results for same input", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const result1 = calculator.calculateBasicETA(
        current,
        destination,
        speed
      );
      const result2 = calculator.calculateBasicETA(
        current,
        destination,
        speed
      );

      expect(result1.estimatedMinutes).toBe(result2.estimatedMinutes);
      expect(result1.distanceRemaining).toBe(result2.distanceRemaining);
    });

    it("should increase ETA when speed decreases", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      const result40 = calculator.calculateBasicETA(current, destination, 40);
      const result20 = calculator.calculateBasicETA(current, destination, 20);

      expect(result20.estimatedMinutes).toBeGreaterThan(
        result40.estimatedMinutes
      );
    });

    it("should increase ETA when distance increases", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const near = { lat: 40.713, lng: -74.005 };
      const far = { lat: 40.8, lng: -73.95 };
      const speed = 40;

      const resultNear = calculator.calculateBasicETA(
        current,
        near,
        speed
      );
      const resultFar = calculator.calculateBasicETA(current, far, speed);

      expect(resultFar.estimatedMinutes).toBeGreaterThan(
        resultNear.estimatedMinutes
      );
    });
  });
});

// ============================================================================
// Geofence Manager Tests
// ============================================================================

describe("GeofenceManager", () => {
  let manager: GeofenceManager;

  beforeEach(() => {
    manager = new GeofenceManager();
  });

  describe("addGeofence", () => {
    it("should add circular geofence", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Main Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);
      expect(manager.getGeofence("store-1")).not.toBeNull();
    });

    it("should throw error for invalid circle geofence (missing center)", () => {
      const geofence: Geofence = {
        id: "invalid",
        name: "Invalid",
        type: "circle",
        radius: 500,
        triggerOn: "both",
      };

      expect(() => manager.addGeofence(geofence)).toThrow();
    });

    it("should throw error for zero/negative radius", () => {
      const geofence: Geofence = {
        id: "invalid",
        name: "Invalid",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 0,
        triggerOn: "both",
      };

      expect(() => manager.addGeofence(geofence)).toThrow();
    });

    it("should add polygon geofence", () => {
      const geofence: Geofence = {
        id: "polygon-1",
        name: "Delivery Zone",
        type: "polygon",
        polygon: [
          { lat: 40.7, lng: -74.0 },
          { lat: 40.71, lng: -74.0 },
          { lat: 40.71, lng: -74.01 },
        ],
        triggerOn: "both",
      };

      manager.addGeofence(geofence);
      expect(manager.getGeofence("polygon-1")).not.toBeNull();
    });

    it("should throw error for polygon with < 3 vertices", () => {
      const geofence: Geofence = {
        id: "invalid",
        name: "Invalid",
        type: "polygon",
        polygon: [
          { lat: 40.7, lng: -74.0 },
          { lat: 40.71, lng: -74.0 },
        ],
        triggerOn: "both",
      };

      expect(() => manager.addGeofence(geofence)).toThrow();
    });

    it("should throw error for invalid lat/lng in polygon", () => {
      const geofence: Geofence = {
        id: "invalid",
        name: "Invalid",
        type: "polygon",
        polygon: [
          { lat: 40.7, lng: -74.0 },
          { lat: 40.71, lng: -74.0 },
          { lat: 100, lng: -200 },
        ],
        triggerOn: "both",
      };

      expect(() => manager.addGeofence(geofence)).toThrow();
    });

    it("should allow updating existing geofence", () => {
      const geofence1: Geofence = {
        id: "store-1",
        name: "Store 1",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "enter",
      };

      const geofence2: Geofence = {
        id: "store-1",
        name: "Store 1 Updated",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 600,
        triggerOn: "both",
      };

      manager.addGeofence(geofence1);
      manager.addGeofence(geofence2);

      const fetched = manager.getGeofence("store-1");
      expect(fetched!.radius).toBe(600);
      expect(fetched!.name).toBe("Store 1 Updated");
    });
  });

  describe("removeGeofence", () => {
    it("should remove geofence by ID", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);
      manager.removeGeofence("store-1");

      expect(manager.getGeofence("store-1")).toBeNull();
    });

    it("should clean up state when removing geofence", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);
      manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      manager.removeGeofence("store-1");

      const state = manager.getDriverGeofenceState("driver-1");
      expect(state.size).toBe(0);
    });
  });

  describe("checkGeofence", () => {
    let geofence: Geofence;

    beforeEach(() => {
      geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };
      manager.addGeofence(geofence);
    });

    it("should detect entry event when moving into geofence", () => {
      const previousPos = { lat: 40.7, lng: -74.0 };
      const currentPos = { lat: 40.7128, lng: -74.006 };

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        currentPos,
        previousPos
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("enter");
      expect(events[0].geofenceId).toBe("store-1");
    });

    it("should detect exit event when moving out of geofence", () => {
      // First move in
      manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      // Then move out
      const currentPos = { lat: 40.7, lng: -74.0 };
      const previousPos = { lat: 40.7128, lng: -74.006 };

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        currentPos,
        previousPos
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("exit");
    });

    it("should not trigger event when only enter is enabled and exiting", () => {
      const enterOnlyGeofence: Geofence = {
        id: "enter-only",
        name: "Enter Only",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "enter",
      };

      manager.addGeofence(enterOnlyGeofence);

      // First enter
      manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      // Then exit
      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7, lng: -74.0 },
        { lat: 40.7128, lng: -74.006 }
      );

      const exitEvent = events.find(
        (e) => e.geofenceId === "enter-only" && e.eventType === "exit"
      );
      expect(exitEvent).toBeUndefined();
    });

    it("should not trigger event when inside and stationary", () => {
      manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      expect(events.length).toBe(0);
    });

    it("should include position in event", () => {
      const position = { lat: 40.7128, lng: -74.006 };
      const previousPosition = { lat: 40.7, lng: -74.0 }; // Outside the circle

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        position,
        previousPosition
      );

      expect(events[0].position).toEqual(position);
    });

    it("should include timestamp in event", () => {
      const before = new Date();

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7, lng: -74.0 } // Need previous position to trigger entry event
      );

      const after = new Date();

      expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(events[0].timestamp.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });

  describe("checkProximity", () => {
    it("should detect proximity events", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 1000,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      // Position 300m away from center
      const position = { lat: 40.7145, lng: -74.006 };
      const events = manager.checkProximity("driver-1", "shop-1", position);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("proximity");
    });

    it("should only check circular geofences for proximity", () => {
      const polygonGeofence: Geofence = {
        id: "polygon-1",
        name: "Polygon",
        type: "polygon",
        polygon: [
          { lat: 40.7, lng: -74.0 },
          { lat: 40.71, lng: -74.0 },
          { lat: 40.71, lng: -74.01 },
        ],
        triggerOn: "both",
      };

      manager.addGeofence(polygonGeofence);

      const events = manager.checkProximity(
        "driver-1",
        "shop-1",
        { lat: 40.705, lng: -74.005 }
      );

      expect(events.length).toBe(0);
    });

    it("should include proximity distance in event", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 1000,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      const events = manager.checkProximity(
        "driver-1",
        "shop-1",
        { lat: 40.7145, lng: -74.006 }
      );

      expect(events[0].proximityDistance).toBeGreaterThan(0);
      expect(events[0].proximityDistance).toBeLessThan(1000);
    });
  });

  describe("isDriverInsideGeofence", () => {
    it("should return true when driver is inside", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);
      manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      expect(
        manager.isDriverInsideGeofence("driver-1", "store-1")
      ).toBe(true);
    });

    it("should return false when driver is outside", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      expect(
        manager.isDriverInsideGeofence("driver-1", "store-1")
      ).toBe(false);
    });

    it("should return false for non-existent driver", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      expect(
        manager.isDriverInsideGeofence("non-existent", "store-1")
      ).toBe(false);
    });
  });

  describe("getDriverInsideGeofences", () => {
    it("should return array of geofence IDs driver is inside", () => {
      const geofence1: Geofence = {
        id: "store-1",
        name: "Store 1",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      const geofence2: Geofence = {
        id: "store-2",
        name: "Store 2",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 1000,
        triggerOn: "both",
      };

      manager.addGeofence(geofence1);
      manager.addGeofence(geofence2);

      manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.7128, lng: -74.006 }
      );

      const inside = manager.getDriverInsideGeofences("driver-1");
      expect(inside).toContain("store-1");
      expect(inside).toContain("store-2");
    });

    it("should return empty array if driver not inside any geofence", () => {
      const geofence: Geofence = {
        id: "store-1",
        name: "Store",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      const inside = manager.getDriverInsideGeofences("driver-1");
      expect(inside).toEqual([]);
    });
  });

  describe("polygon geofence detection", () => {
    it("should detect point inside triangle polygon", () => {
      const geofence: Geofence = {
        id: "poly-1",
        name: "Triangle Zone",
        type: "polygon",
        polygon: [
          { lat: 40.7, lng: -74.0 },
          { lat: 40.72, lng: -74.0 },
          { lat: 40.71, lng: -74.02 },
        ],
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.71, lng: -74.01 },
        { lat: 40.6, lng: -73.9 } // Previous position outside the polygon
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("enter");
    });

    it("should detect point outside polygon", () => {
      const geofence: Geofence = {
        id: "poly-1",
        name: "Triangle Zone",
        type: "polygon",
        polygon: [
          { lat: 40.7, lng: -74.0 },
          { lat: 40.72, lng: -74.0 },
          { lat: 40.71, lng: -74.02 },
        ],
        triggerOn: "both",
      };

      manager.addGeofence(geofence);

      const events = manager.checkGeofence(
        "driver-1",
        "shop-1",
        { lat: 40.65, lng: -74.05 }
      );

      expect(events.length).toBe(0);
    });
  });

  describe("getAllGeofences", () => {
    it("should return all added geofences", () => {
      const geofence1: Geofence = {
        id: "store-1",
        name: "Store 1",
        type: "circle",
        center: { lat: 40.7128, lng: -74.006 },
        radius: 500,
        triggerOn: "both",
      };

      const geofence2: Geofence = {
        id: "store-2",
        name: "Store 2",
        type: "circle",
        center: { lat: 40.75, lng: -73.99 },
        radius: 600,
        triggerOn: "both",
      };

      manager.addGeofence(geofence1);
      manager.addGeofence(geofence2);

      const all = manager.getAllGeofences();
      expect(all.length).toBe(2);
    });

    it("should return empty array when no geofences", () => {
      const all = manager.getAllGeofences();
      expect(all).toEqual([]);
    });
  });
});

// ============================================================================
// GPS Tracking Service Tests
// ============================================================================

describe("GPSTrackingService", () => {
  let service: GPSTrackingService;

  beforeEach(() => {
    service = new GPSTrackingService();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe("processUpdate", () => {
    it("should process GPS update and store location", async () => {
      const update: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 40,
        timestamp: new Date(),
      };

      await service.processUpdate(update);

      const location = service.getDriverLocation("driver-1");
      expect(location).not.toBeNull();
      expect(location!.currentPosition).toEqual({
        lat: 40.7128,
        lng: -74.006,
      });
    });

    it("should average speed over multiple updates", async () => {
      const updates = [
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 30,
          timestamp: new Date(),
        },
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.714,
          longitude: -74.006,
          speed: 40,
          timestamp: new Date(),
        },
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.715,
          longitude: -74.006,
          speed: 35,
          timestamp: new Date(),
        },
      ];

      for (const update of updates) {
        await service.processUpdate(update);
      }

      const location = service.getDriverLocation("driver-1");
      expect(location!.speed).toBeGreaterThan(0);
      expect(location!.speed).toBeLessThanOrEqual(40);
    });

    it("should maintain location history", async () => {
      const update: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date(),
      };

      await service.processUpdate(update);

      const from = new Date();
      const to = new Date();

      const history = service.getLocationHistory("driver-1", from, to);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("getDriverLocation", () => {
    it("should return current driver location", async () => {
      const update: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 40,
        heading: 90,
        timestamp: new Date(),
      };

      await service.processUpdate(update);

      const location = service.getDriverLocation("driver-1");
      expect(location).not.toBeNull();
      expect(location!.currentPosition.lat).toBe(40.7128);
      expect(location!.heading).toBe(90);
      expect(location!.speed).toBeGreaterThan(0);
    });

    it("should return null for non-existent driver", () => {
      const location = service.getDriverLocation("non-existent");
      expect(location).toBeNull();
    });

    it("should return null for expired location", async () => {
      vi.useFakeTimers();
      const now = new Date();
      vi.setSystemTime(now);

      const update: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: now,
      };

      await service.processUpdate(update);

      // Advance time beyond TTL (5 minutes)
      vi.setSystemTime(new Date(now.getTime() + 6 * 60 * 1000));

      const location = service.getDriverLocation("driver-1");
      expect(location).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("getActiveDrivers", () => {
    it("should return all active drivers for a shop", async () => {
      const updates = [
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: new Date(),
        },
        {
          driverId: "driver-2",
          shopId: "shop-1",
          latitude: 40.714,
          longitude: -74.006,
          timestamp: new Date(),
        },
        {
          driverId: "driver-3",
          shopId: "shop-2",
          latitude: 40.715,
          longitude: -74.006,
          timestamp: new Date(),
        },
      ];

      for (const update of updates) {
        await service.processUpdate(update);
      }

      const drivers = service.getActiveDrivers("shop-1");
      expect(drivers.length).toBe(2);
      expect(drivers.map((d) => d.driverId)).toContain("driver-1");
      expect(drivers.map((d) => d.driverId)).toContain("driver-2");
    });

    it("should return empty array for shop with no drivers", () => {
      const drivers = service.getActiveDrivers("non-existent");
      expect(drivers).toEqual([]);
    });
  });

  describe("calculateETA", () => {
    it("should calculate ETA between positions", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const speed = 40;

      const eta = service.calculateETA(current, destination, speed);

      expect(eta.estimatedMinutes).toBeGreaterThan(0);
      expect(eta.estimatedArrival).toBeInstanceOf(Date);
      expect(eta.confidence).toMatch(/high|medium|low/);
    });

    it("should return default speed if speed is zero", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      const eta = service.calculateETA(current, destination, 0);

      expect(eta.estimatedMinutes).toBeGreaterThan(0);
      expect(eta.factors.some((f) => f.includes("30"))).toBe(true);
    });

    it("should set high confidence for highway speeds and short distance", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.715, lng: -74.006 };
      const speed = 80;

      const eta = service.calculateETA(current, destination, speed);

      expect(eta.confidence).toBe("high");
    });

    it("should set low confidence for low speed or long distance", () => {
      const current = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 42.0, lng: -74.006 };
      const speed = 10;

      const eta = service.calculateETA(current, destination, speed);

      expect(eta.confidence).toBe("low");
    });
  });

  describe("checkGeofence", () => {
    it("should detect geofence entry", () => {
      const geofences = [
        {
          id: "store-1",
          name: "Store",
          type: "circle" as const,
          center: { lat: 40.7128, lng: -74.006 },
          radius: 500,
          triggerOn: "both" as const,
        },
      ];

      const previousPos = { lat: 40.7, lng: -74.0 };
      const currentPos = { lat: 40.7128, lng: -74.006 };

      const events = service.checkGeofence(
        currentPos,
        geofences,
        previousPos,
        "driver-1",
        "shop-1"
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("enter");
    });

    it("should detect geofence exit", () => {
      const geofences = [
        {
          id: "store-1",
          name: "Store",
          type: "circle" as const,
          center: { lat: 40.7128, lng: -74.006 },
          radius: 500,
          triggerOn: "both" as const,
        },
      ];

      const previousPos = { lat: 40.7128, lng: -74.006 };
      const currentPos = { lat: 40.7, lng: -74.0 };

      const events = service.checkGeofence(
        currentPos,
        geofences,
        previousPos,
        "driver-1",
        "shop-1"
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("exit");
    });

    it("should respect triggerOn setting", () => {
      const geofences = [
        {
          id: "store-1",
          name: "Store",
          type: "circle" as const,
          center: { lat: 40.7128, lng: -74.006 },
          radius: 500,
          triggerOn: "enter" as const,
        },
      ];

      const previousPos = { lat: 40.7128, lng: -74.006 };
      const currentPos = { lat: 40.7, lng: -74.0 };

      const events = service.checkGeofence(
        currentPos,
        geofences,
        previousPos,
        "driver-1",
        "shop-1"
      );

      expect(events.length).toBe(0);
    });
  });

  describe("getLocationHistory", () => {
    it("should retrieve location history within time range", async () => {
      const now = new Date();
      const before = new Date(now.getTime() - 10 * 60 * 1000);
      const after = new Date(now.getTime() + 10 * 60 * 1000);

      const update: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: now,
      };

      await service.processUpdate(update);

      const history = service.getLocationHistory("driver-1", before, after);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].driverId).toBe("driver-1");
    });

    it("should return empty array for non-existent driver", () => {
      const now = new Date();
      const history = service.getLocationHistory(
        "non-existent",
        now,
        new Date(now.getTime() + 1000)
      );

      expect(history).toEqual([]);
    });

    it("should filter by time range", async () => {
      vi.useFakeTimers();
      const now = new Date(2024, 0, 1, 12, 0, 0);
      vi.setSystemTime(now);

      const update1: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: now,
      };

      await service.processUpdate(update1);

      vi.setSystemTime(new Date(now.getTime() + 5 * 60 * 1000));

      const update2: GPSUpdate = {
        driverId: "driver-1",
        shopId: "shop-1",
        latitude: 40.714,
        longitude: -74.006,
        timestamp: new Date(),
      };

      await service.processUpdate(update2);

      const from = new Date(now.getTime() + 2 * 60 * 1000);
      const to = new Date(now.getTime() + 6 * 60 * 1000);

      const history = service.getLocationHistory("driver-1", from, to);
      expect(history.length).toBe(1);
      expect(history[0].latitude).toBe(40.714);

      vi.useRealTimers();
    });
  });

  describe("speed outlier rejection", () => {
    it("should reject unrealistic speed spikes", async () => {
      const updates = [
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 50,
          timestamp: new Date(),
        },
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.714,
          longitude: -74.006,
          speed: 55,
          timestamp: new Date(),
        },
        {
          driverId: "driver-1",
          shopId: "shop-1",
          latitude: 40.715,
          longitude: -74.006,
          speed: 500, // Unrealistic spike
          timestamp: new Date(),
        },
      ];

      for (const update of updates) {
        await service.processUpdate(update);
      }

      const location = service.getDriverLocation("driver-1");
      // Speed should be averaged, not spike to 500
      expect(location!.speed).toBeLessThan(100);
    });
  });

  describe("shutdown", () => {
    it("should cleanup cleanup interval", () => {
      const intervalSpy = vi.spyOn(global, "clearInterval");
      service.shutdown();
      expect(intervalSpy).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Tracking Module Integration", () => {
  let calculator: ETACalculator;
  let geofenceManager: GeofenceManager;
  let gpsService: GPSTrackingService;

  beforeEach(() => {
    calculator = new ETACalculator({ defaultSpeedKmh: 45 });
    geofenceManager = new GeofenceManager();
    gpsService = new GPSTrackingService();
  });

  afterEach(() => {
    gpsService.shutdown();
  });

  it("should integrate GPS service with ETA calculator", async () => {
    const update: GPSUpdate = {
      driverId: "driver-1",
      shopId: "shop-1",
      latitude: 40.7128,
      longitude: -74.006,
      speed: 40,
      timestamp: new Date(),
    };

    await gpsService.processUpdate(update);

    const location = gpsService.getDriverLocation("driver-1")!;
    const destination = { lat: 40.758, lng: -73.9855 };

    const eta = gpsService.calculateETA(
      location.currentPosition,
      destination,
      location.speed
    );

    expect(eta.estimatedMinutes).toBeGreaterThan(0);
  });

  it("should integrate GPS service with geofence detection", async () => {
    const geofence: Geofence = {
      id: "store-1",
      name: "Store",
      type: "circle",
      center: { lat: 40.7128, lng: -74.006 },
      radius: 500,
      triggerOn: "both",
    };

    geofenceManager.addGeofence(geofence);

    // First update from outside the geofence
    const update1: GPSUpdate = {
      driverId: "driver-1",
      shopId: "shop-1",
      latitude: 40.7,
      longitude: -74.0,
      timestamp: new Date(),
    };

    await gpsService.processUpdate(update1);

    // Second update moving into the geofence
    const update2: GPSUpdate = {
      driverId: "driver-1",
      shopId: "shop-1",
      latitude: 40.7128,
      longitude: -74.006,
      timestamp: new Date(),
    };

    await gpsService.processUpdate(update2);

    const location = gpsService.getDriverLocation("driver-1")!;
    const previousLocation = { lat: 40.7, lng: -74.0 };
    const events = geofenceManager.checkGeofence(
      "driver-1",
      "shop-1",
      location.currentPosition,
      previousLocation
    );

    expect(events.length).toBeGreaterThan(0);
  });

  it("should track delivery with all three modules", async () => {
    // Add geofence for destination
    const geofence: Geofence = {
      id: "destination",
      name: "Delivery Location",
      type: "circle",
      center: { lat: 40.758, lng: -73.9855 },
      radius: 500,
      triggerOn: "both",
    };

    geofenceManager.addGeofence(geofence);

    // Start position
    const startPos = { lat: 40.7128, lng: -74.006 };
    let currentPos = startPos;

    // Process initial update
    await gpsService.processUpdate({
      driverId: "driver-1",
      shopId: "shop-1",
      latitude: startPos.lat,
      longitude: startPos.lng,
      speed: 40,
      timestamp: new Date(),
    });

    // Calculate initial ETA
    const initialETA = calculator.calculateBasicETA(
      startPos,
      { lat: 40.758, lng: -73.9855 },
      40
    );
    expect(initialETA.estimatedMinutes).toBeGreaterThan(0);

    // Simulate movement towards destination
    currentPos = { lat: 40.735, lng: -73.995 };

    await gpsService.processUpdate({
      driverId: "driver-1",
      shopId: "shop-1",
      latitude: currentPos.lat,
      longitude: currentPos.lng,
      speed: 40,
      timestamp: new Date(),
    });

    // Arrive at destination
    currentPos = { lat: 40.758, lng: -73.9855 };

    const events = geofenceManager.checkGeofence(
      "driver-1",
      "shop-1",
      currentPos,
      { lat: 40.735, lng: -73.995 }
    );

    // Should have entry event to destination geofence
    expect(events.some((e) => e.eventType === "enter")).toBe(true);
  });
});
