/**
 * Telematics Normalizer V2 Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TelematicsNormalizerV2,
  type TenantNormalizationRules,
} from "../telematics-normalizer-v2.js";
import type {
  GeotabLogRecord,
  GeotabStatusData,
  GeotabTrip,
} from "../geotab-sdk-client.js";
import type { SamsaraLocation, SamsaraStats } from "../types.js";

describe("TelematicsNormalizerV2", () => {
  let normalizer: TelematicsNormalizerV2;

  beforeEach(() => {
    normalizer = new TelematicsNormalizerV2();
  });

  describe("Geotab Position Normalization", () => {
    it("should normalize Geotab LogRecord to WitylogixVehiclePosition", () => {
      const record: GeotabLogRecord = {
        id: "log-1",
        device: { id: "device-1" },
        dateTime: "2025-01-01T12:00:00Z",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 80, // km/h
        bearing: 180,
      };

      const position = normalizer.normalizeGeotabPosition(record);

      expect(position.vehicleId).toBe("device-1");
      expect(position.lat).toBe(40.7128);
      expect(position.lng).toBe(-74.006);
      expect(position.heading).toBe(180);
      expect(position.speed).toBeCloseTo(49.7, 1); // 80 km/h to mph
      expect(position.provider).toBe("geotab");
    });

    it("should use custom provider name", () => {
      const record: GeotabLogRecord = {
        id: "log-1",
        device: { id: "device-1" },
        dateTime: "2025-01-01T12:00:00Z",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 50,
        bearing: 90,
      };

      const position = normalizer.normalizeGeotabPosition(
        record,
        "geotab-custom",
      );

      expect(position.provider).toBe("geotab-custom");
    });
  });

  describe("Geotab Diagnostics Normalization", () => {
    it("should normalize Geotab StatusData to diagnostics", () => {
      const statusData: GeotabStatusData[] = [
        {
          id: "status-1",
          device: { id: "device-1" },
          diagnostic: { id: "FuelLevel", name: "FuelLevel" },
          value: 75.5,
          dateTime: "2025-01-01T12:00:00Z",
        },
        {
          id: "status-2",
          device: { id: "device-1" },
          diagnostic: { id: "Odometer", name: "Odometer" },
          value: 10500.2,
          dateTime: "2025-01-01T12:00:00Z",
        },
      ];

      const diagnostics = normalizer.normalizeGeotabDiagnostics(statusData);

      expect(diagnostics.vehicleId).toBe("device-1");
      expect(diagnostics.fuelLevel).toBe(75.5);
      // Odometer is converted from km to miles (default distanceUnit)
      expect(diagnostics.odometer?.value).toBeCloseTo(6524.5, 0);
    });

    it("should handle fault data in diagnostics", () => {
      const statusData: GeotabStatusData[] = [
        {
          id: "status-1",
          device: { id: "device-1" },
          diagnostic: { id: "FuelLevel", name: "FuelLevel" },
          value: 50,
          dateTime: "2025-01-01T12:00:00Z",
        },
      ];
      const faults = [
        { code: "P0101", description: "MAF Sensor Range/Performance" },
        { code: "P0201", description: "Injector Circuit Open Bank 1" },
      ];

      const diagnostics = normalizer.normalizeGeotabDiagnostics(
        statusData,
        faults,
      );

      expect(diagnostics.dtcCodes).toHaveLength(2);
      expect(diagnostics.dtcCodes?.[0].code).toBe("P0101");
    });

    it("should throw on empty status data", () => {
      expect(() => normalizer.normalizeGeotabDiagnostics([])).toThrow();
    });
  });

  describe("Geotab Trip Normalization", () => {
    it("should normalize Geotab Trip to WitylogixTrip", () => {
      const trip: GeotabTrip = {
        id: "trip-1",
        device: { id: "device-1" },
        startDateTime: "2025-01-01T08:00:00Z",
        stopDateTime: "2025-01-01T17:00:00Z",
        startOdometer: 10000,
        stopOdometer: 10100,
        distance: 160.9, // km
        drivingDurationMinutes: 540,
        stops: 3,
      };

      const normalizedTrip = normalizer.normalizeGeotabTrip(trip);

      expect(normalizedTrip.vehicleId).toBe("device-1");
      expect(normalizedTrip.durationMinutes).toBe(540);
      expect(normalizedTrip.stops).toBe(3);
      expect(normalizedTrip.distance).toBeCloseTo(100, 0); // ~100 miles
    });
  });

  describe("Samsara Position Normalization", () => {
    it("should normalize Samsara Location to WitylogixVehiclePosition", () => {
      const location: SamsaraLocation = {
        id: "loc-1",
        vehicleId: "vehicle-1",
        latitude: 40.7128,
        longitude: -74.006,
        speedMph: 45,
        heading: 90,
        time: "2025-01-01T12:00:00Z",
        accuracy: 5,
      };

      const position = normalizer.normalizeSamsaraPosition(location);

      expect(position.vehicleId).toBe("vehicle-1");
      expect(position.lat).toBe(40.7128);
      expect(position.speed).toBe(45);
      expect(position.accuracy).toBe(5);
      expect(position.provider).toBe("samsara");
    });
  });

  describe("Samsara Diagnostics Normalization", () => {
    it("should normalize Samsara Stats to diagnostics", () => {
      const stats: SamsaraStats = {
        engineState: "Running",
        odometer: { miles: 105000 },
        faultCodes: [
          {
            id: "fault-1",
            spnId: 123,
            fmiId: 5,
            description: "Engine coolant temp low",
          },
        ],
      };

      const diagnostics = normalizer.normalizeSamsaraDiagnostics(
        "vehicle-1",
        stats,
      );

      expect(diagnostics.vehicleId).toBe("vehicle-1");
      expect(diagnostics.odometer?.value).toBeCloseTo(105000, 0);
      expect(diagnostics.dtcCodes).toHaveLength(1);
    });
  });

  describe("Position Deduplication", () => {
    it("should deduplicate positions within threshold", () => {
      const pos1 = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 10,
        timestamp: new Date("2025-01-01T12:00:00Z"),
        provider: "test" as const,
        accuracy: 0,
      };

      // Accept first position
      expect(normalizer.deduplicatePosition(pos1)).toBeDefined();

      // Position within 5m (default threshold)
      const pos2 = {
        ...pos1,
        lat: 40.71281, // ~10 meters away
        timestamp: new Date("2025-01-01T12:00:10Z"),
      };

      expect(normalizer.deduplicatePosition(pos2)).toBeNull();

      // Position far enough away
      const pos3 = {
        ...pos1,
        lat: 40.713, // ~100 meters away
        timestamp: new Date("2025-01-01T12:00:20Z"),
      };

      expect(normalizer.deduplicatePosition(pos3)).toBeDefined();
    });

    it("should use custom deduplication threshold", () => {
      const rules: TenantNormalizationRules = {
        speedUnit: "mph",
        distanceUnit: "miles",
        fuelUnit: "gallons",
        deduplicationMeters: 100, // 100m threshold
      };

      const customNormalizer = new TelematicsNormalizerV2(rules);

      const pos1 = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 10,
        timestamp: new Date("2025-01-01T12:00:00Z"),
        provider: "test" as const,
        accuracy: 0,
      };

      customNormalizer.deduplicatePosition(pos1);

      // Position within 100m
      const pos2 = {
        ...pos1,
        lat: 40.7129, // ~10 meters
        timestamp: new Date("2025-01-01T12:00:10Z"),
      };

      expect(customNormalizer.deduplicatePosition(pos2)).toBeNull();
    });

    it("should reset deduplication state", () => {
      const pos = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 10,
        timestamp: new Date("2025-01-01T12:00:00Z"),
        provider: "test" as const,
        accuracy: 0,
      };

      normalizer.deduplicatePosition(pos);
      normalizer.resetDeduplicationState("vehicle-1");

      // After reset, same position should be accepted
      expect(normalizer.deduplicatePosition(pos)).toBeDefined();
    });
  });

  describe("Geofence Enrichment", () => {
    it("should enrich position with geofence data", () => {
      const position = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 10,
        timestamp: new Date(),
        provider: "test" as const,
        accuracy: 0,
      };

      const geofences = [
        {
          id: "zone-1",
          name: "Warehouse",
          type: "circle" as const,
          center: { lat: 40.7128, lng: -74.006 },
          radius: 500,
        },
        {
          id: "zone-2",
          name: "Parking",
          type: "circle" as const,
          center: { lat: 40.0, lng: -75.0 },
          radius: 200,
        },
      ];

      const enriched = normalizer.enrichPositionWithGeofences(
        position,
        geofences,
      );

      expect(enriched.geofences).toHaveLength(1);
      expect(enriched.geofences[0].name).toBe("Warehouse");
    });
  });

  describe("Idle Detection", () => {
    it("should detect idle state when speed is below threshold", () => {
      const position = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 1, // Below default 2 mph threshold
        timestamp: new Date(),
        provider: "test" as const,
        accuracy: 0,
      };

      const isIdling = normalizer.detectIdling(position);

      expect(isIdling).toBe(true);
    });

    it("should not detect idle when moving", () => {
      const position = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 30,
        timestamp: new Date(),
        provider: "test" as const,
        accuracy: 0,
      };

      const isIdling = normalizer.detectIdling(position);

      expect(isIdling).toBe(false);
    });

    it("should enrich position with idle detection", () => {
      const position = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 0,
        timestamp: new Date(),
        provider: "test" as const,
        accuracy: 0,
      };

      const enriched = normalizer.enrichPositionWithIdleDetection(position);

      expect(enriched.idling).toBe(true);
    });
  });

  describe("Tenant Rules", () => {
    it("should update tenant rules", () => {
      const rules: TenantNormalizationRules = {
        speedUnit: "kmh",
        distanceUnit: "kilometers",
        fuelUnit: "liters",
      };

      normalizer.updateTenantRules(rules);

      // Test with new rules by normalizing
      const record: GeotabLogRecord = {
        id: "log-1",
        device: { id: "device-1" },
        dateTime: "2025-01-01T12:00:00Z",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 80,
        bearing: 180,
      };

      const position = normalizer.normalizeGeotabPosition(record);

      // With speedUnit: "kmh", input km/h stays as km/h (no conversion)
      expect(position.speed).toBeCloseTo(80, 1);
    });
  });

  describe("Unit Conversions", () => {
    it("should handle speed unit conversions", () => {
      const kmhRecord: GeotabLogRecord = {
        id: "log-1",
        device: { id: "device-1" },
        dateTime: "2025-01-01T12:00:00Z",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 100, // 100 km/h
        bearing: 0,
      };

      const position = normalizer.normalizeGeotabPosition(kmhRecord);

      // Default conversion is km/h to mph
      expect(position.speed).toBeCloseTo(62.1, 0);
    });
  });
});
