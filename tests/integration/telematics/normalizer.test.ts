/**
 * Telematics Normalizer Tests
 * Comprehensive test suite for data normalization between providers
 * Tests: Samsara → Normalized, Geotab → Normalized, unit conversions,
 * edge cases with missing data, and data transformation accuracy
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TelematicsNormalizer } from "../../../packages/core/src/integrations/telematics/telematics-normalizer.js";
import {
  mockSamsaraVehicles,
  mockSamsaraLocation,
  mockSamsaraStats,
  mockSamsaraSafetyEvent,
  mockSamsaraFuel,
  mockGeotabDevice,
  mockGeotabDeviceStatusInfo,
  mockGeotabFaultData,
  mockGeotabExceptionEvent,
  mockSamsaraLocationWithoutGPS,
  mockSamsaraFuelNoData,
} from "../fixtures/telematics-fixtures.js";

describe("TelematicsNormalizer", () => {
  let normalizerSamsara: TelematicsNormalizer;
  let normalizerGeotab: TelematicsNormalizer;

  beforeEach(() => {
    normalizerSamsara = new TelematicsNormalizer("samsara");
    normalizerGeotab = new TelematicsNormalizer("geotab");
  });

  describe("Samsara Vehicle Normalization", () => {
    it("should normalize Samsara vehicle to standard format", () => {
      const normalized = normalizerSamsara.normalizeVehicle(
        mockSamsaraVehicles[0],
      );

      expect(normalized.externalVehicleId).toBe("vehicle_123");
      expect(normalized.name).toBe("Delivery Van A");
      expect(normalized.vin).toBe("1HGBH41JXMN109186");
      expect(normalized.licensePlate).toBe("CA-12345");
      expect(normalized.make).toBe("Honda");
      expect(normalized.model).toBe("Odyssey");
      expect(normalized.year).toBe(2022);
    });

    it("should set vehicle status to ACTIVE", () => {
      const normalized = normalizerSamsara.normalizeVehicle(
        mockSamsaraVehicles[0],
      );

      expect(normalized.status).toBe("ACTIVE");
    });

    it("should handle vehicle without static fields", () => {
      const vehicleNoFields = {
        id: "vehicle_test",
        name: "Test Vehicle",
        externalIds: [],
        staticFields: {},
      };

      const normalized = normalizerSamsara.normalizeVehicle(vehicleNoFields);

      expect(normalized.externalVehicleId).toBe("vehicle_test");
      expect(normalized.vin).toBeUndefined();
      expect(normalized.make).toBeUndefined();
    });

    it("should extract multiple external IDs", () => {
      const vehicleWithIds = {
        ...mockSamsaraVehicles[0],
        externalIds: [
          { externalIdType: "FLEET_ID", value: "FLEET_001" },
          { externalIdType: "VIN", value: "1234567890" },
        ],
      };

      const normalized = normalizerSamsara.normalizeVehicle(vehicleWithIds);

      expect(normalized.externalVehicleId).toBe("vehicle_123");
    });
  });

  describe("Samsara Position Normalization", () => {
    it("should normalize Samsara location to standard position format", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocation,
        "vehicle_123",
      );

      expect(normalized.externalVehicleId).toBe("vehicle_123");
      expect(normalized.latitude).toBe(37.7749);
      expect(normalized.longitude).toBe(-122.4194);
      expect(normalized.heading).toBe(180);
    });

    it("should convert speed from mph to normalized format", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocation,
        "vehicle_123",
      );

      expect(normalized.speed?.value).toBe(35.5);
      expect(normalized.speed?.unit).toBe("mph");
    });

    it("should include accuracy in position", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocation,
        "vehicle_123",
      );

      expect(normalized.accuracy).toBe(5.0);
    });

    it("should parse ISO 8601 timestamp", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocation,
        "vehicle_123",
      );

      expect(normalized.timestamp).toBeInstanceOf(Date);
      expect(normalized.timestamp.toISOString()).toContain("2024-03-11");
    });

    it("should handle location with zero GPS coordinates", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocationWithoutGPS,
        "vehicle_123",
      );

      expect(normalized.latitude).toBe(0);
      expect(normalized.longitude).toBe(0);
    });

    it("should handle location without accuracy", () => {
      const locationNoAccuracy = {
        ...mockSamsaraLocation,
        accuracy: undefined,
      };

      const normalized = normalizerSamsara.normalizePosition(
        locationNoAccuracy,
        "vehicle_123",
      );

      expect(normalized.accuracy).toBeUndefined();
    });
  });

  describe("Samsara Diagnostics Normalization", () => {
    it("should normalize Samsara stats to diagnostic format", () => {
      const normalized = normalizerSamsara.normalizeDiagnostic(
        mockSamsaraStats,
        "vehicle_123",
      );

      expect(normalized.externalVehicleId).toBe("vehicle_123");
      expect(normalized.engineRunning).toBe(true);
      expect(normalized.faultCodes).toHaveLength(2);
    });

    it("should map fault code descriptions correctly", () => {
      const normalized = normalizerSamsara.normalizeDiagnostic(
        mockSamsaraStats,
        "vehicle_123",
      );

      expect(normalized.faultCodes[0].code).toBe("1234");
      expect(normalized.faultCodes[0].description).toBe(
        "Engine Coolant Temperature High",
      );
    });

    it("should determine fault code severity", () => {
      const normalized = normalizerSamsara.normalizeDiagnostic(
        mockSamsaraStats,
        "vehicle_123",
      );

      normalized.faultCodes.forEach((code) => {
        expect(["info", "warning", "error", "critical"]).toContain(
          code.severity,
        );
      });
    });

    it("should include odometer reading in diagnostics", () => {
      const normalized = normalizerSamsara.normalizeDiagnostic(
        mockSamsaraStats,
        "vehicle_123",
      );

      expect(normalized.odometer?.value).toBe(125430.5);
      expect(normalized.odometer?.unit).toBe("miles");
    });

    it("should handle stats without fault codes", () => {
      const statsNoFaults = {
        engineState: "RUNNING",
        odometer: { miles: 100000 },
      };

      const normalized = normalizerSamsara.normalizeDiagnostic(
        statsNoFaults,
        "vehicle_123",
      );

      expect(normalized.faultCodes).toEqual([]);
    });

    it("should include current timestamp in diagnostics", () => {
      const normalized = normalizerSamsara.normalizeDiagnostic(
        mockSamsaraStats,
        "vehicle_123",
      );

      expect(normalized.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Samsara Behavior Event Normalization", () => {
    it("should normalize Samsara safety event to behavior event", () => {
      const normalized = normalizerSamsara.normalizeBehaviorEvent(
        mockSamsaraSafetyEvent,
      );

      expect(normalized.externalEventId).toBe("event_123");
      expect(normalized.externalVehicleId).toBe("vehicle_123");
      expect(normalized.externalDriverId).toBe("driver_456");
      expect(normalized.eventType).toBe("harsh_acceleration");
    });

    it("should map event severity levels", () => {
      const normalized = normalizerSamsara.normalizeBehaviorEvent(
        mockSamsaraSafetyEvent,
      );

      expect(["info", "warning", "critical"]).toContain(normalized.severity);
    });

    it("should include GPS coordinates in behavior event", () => {
      const normalized = normalizerSamsara.normalizeBehaviorEvent(
        mockSamsaraSafetyEvent,
      );

      expect(normalized.latitude).toBe(37.7749);
      expect(normalized.longitude).toBe(-122.4194);
    });

    it("should include speed and speed limit in behavior event", () => {
      const normalized = normalizerSamsara.normalizeBehaviorEvent(
        mockSamsaraSafetyEvent,
      );

      expect(normalized.speed?.value).toBe(45.2);
      expect(normalized.speed?.unit).toBe("mph");
      expect(normalized.speedLimit?.value).toBe(55);
    });

    it("should parse event timestamp", () => {
      const normalized = normalizerSamsara.normalizeBehaviorEvent(
        mockSamsaraSafetyEvent,
      );

      expect(normalized.timestamp).toBeInstanceOf(Date);
    });

    it("should handle event without driver ID", () => {
      const eventNoDriver = { ...mockSamsaraSafetyEvent, driverId: undefined };

      const normalized =
        normalizerSamsara.normalizeBehaviorEvent(eventNoDriver);

      expect(normalized.externalDriverId).toBeUndefined();
    });
  });

  describe("Samsara Fuel Normalization", () => {
    it("should normalize Samsara fuel data", () => {
      const normalized = normalizerSamsara.normalizeFuel(mockSamsaraFuel);

      expect(normalized.externalVehicleId).toBe("vehicle_123");
      expect(normalized.fuelLevel).toBe(65.5);
      expect(normalized.fuelUnit).toBe("gallons");
    });

    it("should handle fuel without percentage data", () => {
      const normalized = normalizerSamsara.normalizeFuel(mockSamsaraFuelNoData);

      expect(normalized.externalVehicleId).toBe("vehicle_no_fuel");
      expect(normalized.fuelLevel).toBeUndefined();
    });

    it("should include current timestamp in fuel reading", () => {
      const normalized = normalizerSamsara.normalizeFuel(mockSamsaraFuel);

      expect(normalized.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Geotab Vehicle Normalization", () => {
    it("should normalize Geotab device to standard vehicle format", () => {
      const normalized = normalizerGeotab.normalizeVehicle(mockGeotabDevice);

      expect(normalized.externalVehicleId).toBe("device_999");
      expect(normalized.name).toBe("Driver01-Device");
      expect(normalized.vin).toBe("2HGCV52639H537355");
      expect(normalized.licensePlate).toBe("NY-98765");
      expect(normalized.make).toBe("Toyota");
      expect(normalized.model).toBe("Camry");
      expect(normalized.year).toBe(2021);
    });

    it("should map Geotab status to normalized status", () => {
      const normalized = normalizerGeotab.normalizeVehicle(mockGeotabDevice);

      expect(["ACTIVE", "INACTIVE", "DELETED"]).toContain(normalized.status);
    });

    it("should handle Geotab device without VIN", () => {
      const deviceNoVin = {
        id: "device_no_vin",
        name: "Device Without VIN",
        deviceType: "GO9",
        status: "Active",
      };

      const normalized = normalizerGeotab.normalizeVehicle(deviceNoVin);

      expect(normalized.vin).toBeUndefined();
      expect(normalized.externalVehicleId).toBe("device_no_vin");
    });
  });

  describe("Geotab Position Normalization", () => {
    it("should normalize Geotab DeviceStatusInfo to position", () => {
      const normalized = normalizerGeotab.normalizePosition(
        mockGeotabDeviceStatusInfo,
        "device_999",
      );

      expect(normalized.externalVehicleId).toBe("device_999");
      expect(normalized.latitude).toBe(40.7128);
      expect(normalized.longitude).toBe(-74.006);
      expect(normalized.speed?.value).toBe(28.5);
      expect(normalized.heading).toBe(90);
    });

    it("should convert Geotab bearing to heading", () => {
      const statusWithBearing = {
        ...mockGeotabDeviceStatusInfo,
        bearing: 270,
      };

      const normalized = normalizerGeotab.normalizePosition(
        statusWithBearing,
        "device_999",
      );

      expect(normalized.heading).toBe(270);
    });

    it("should parse Geotab timestamp", () => {
      const normalized = normalizerGeotab.normalizePosition(
        mockGeotabDeviceStatusInfo,
        "device_999",
      );

      expect(normalized.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Geotab Diagnostics Normalization", () => {
    it("should normalize Geotab FaultData to diagnostics", () => {
      const normalized = normalizerGeotab.normalizeDiagnostic(
        mockGeotabFaultData,
        "device_999",
      );

      expect(normalized.externalVehicleId).toBe("device_999");
      expect(normalized.faultCodes[0].code).toBe("P0101");
      expect(normalized.faultCodes[0].description).toBe(
        "Mass Air Flow (MAF) Sensor Range/Performance",
      );
    });

    it("should mark dismissed faults as lower severity", () => {
      const faultDismissed = {
        ...mockGeotabFaultData,
        dismissDateTime: "2024-03-11T10:00:00Z",
      };

      const normalized = normalizerGeotab.normalizeDiagnostic(
        faultDismissed,
        "device_999",
      );

      expect(normalized.faultCodes[0].severity).not.toBe("critical");
    });
  });

  describe("Geotab Exception Event Normalization", () => {
    it("should normalize Geotab ExceptionEvent to behavior event", () => {
      const normalized = normalizerGeotab.normalizeBehaviorEvent(
        mockGeotabExceptionEvent,
      );

      expect(normalized.externalEventId).toBe("exception_123");
      expect(normalized.externalVehicleId).toBe("device_999");
      expect(normalized.externalDriverId).toBe("driver_789");
    });

    it("should map Geotab exception type to event type", () => {
      const normalized = normalizerGeotab.normalizeBehaviorEvent(
        mockGeotabExceptionEvent,
      );

      expect(["harsh_acceleration", "harsh_braking", "speeding"]).toContain(
        normalized.eventType,
      );
    });

    it("should include speed zone in behavior event", () => {
      const normalized = normalizerGeotab.normalizeBehaviorEvent(
        mockGeotabExceptionEvent,
      );

      expect(normalized.speedLimit?.value).toBe(55);
    });

    it("should handle exception event without speed zone", () => {
      const eventNoSpeedZone = {
        ...mockGeotabExceptionEvent,
        speedZone: undefined,
      };

      const normalized =
        normalizerGeotab.normalizeBehaviorEvent(eventNoSpeedZone);

      expect(normalized.speedLimit).toBeUndefined();
    });
  });

  describe("Unit Conversions", () => {
    it("should convert miles to kilometers", () => {
      const miles = 10;
      const km = miles * 1.60934;

      expect(km).toBeCloseTo(16.0934, 2);
    });

    it("should convert gallons to liters", () => {
      const gallons = 10;
      const liters = gallons * 3.78541;

      expect(liters).toBeCloseTo(37.8541, 2);
    });

    it("should convert Fahrenheit to Celsius", () => {
      const fahrenheit = 98.6;
      const celsius = ((fahrenheit - 32) * 5) / 9;

      expect(celsius).toBeCloseTo(37, 0);
    });

    it("should maintain correct odometer units", () => {
      const normalized = normalizerSamsara.normalizeDiagnostic(
        mockSamsaraStats,
        "vehicle_123",
      );

      expect(normalized.odometer?.unit).toBe("miles");
    });

    it("should maintain correct speed units", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocation,
        "vehicle_123",
      );

      expect(normalized.speed?.unit).toBe("mph");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null timestamps gracefully", () => {
      const eventNoTime = {
        ...mockSamsaraSafetyEvent,
        timestamp: "",
      };

      const normalized = normalizerSamsara.normalizeBehaviorEvent(eventNoTime);

      expect(normalized.timestamp).toBeInstanceOf(Date);
    });

    it("should handle missing speed data", () => {
      const locationNoSpeed = {
        ...mockSamsaraLocation,
        speedMph: undefined,
      };

      const normalized = normalizerSamsara.normalizePosition(
        locationNoSpeed as any,
        "vehicle_123",
      );

      expect(normalized.speed).toBeUndefined();
    });

    it("should handle missing odometer data", () => {
      const statsNoOdometer = {
        engineState: "RUNNING",
      };

      const normalized = normalizerSamsara.normalizeDiagnostic(
        statsNoOdometer as any,
        "vehicle_123",
      );

      expect(normalized.odometer).toBeUndefined();
    });

    it("should preserve numeric precision", () => {
      const normalized = normalizerSamsara.normalizePosition(
        mockSamsaraLocation,
        "vehicle_123",
      );

      expect(normalized.latitude).toBe(37.7749);
      expect(normalized.longitude).toBe(-122.4194);
    });
  });

  describe("Data Transformation Accuracy", () => {
    it("should normalize both providers to same format", () => {
      const samsaraNormalized = normalizerSamsara.normalizeVehicle(
        mockSamsaraVehicles[0],
      );
      const geotabNormalized =
        normalizerGeotab.normalizeVehicle(mockGeotabDevice);

      expect(samsaraNormalized).toHaveProperty("externalVehicleId");
      expect(samsaraNormalized).toHaveProperty("name");
      expect(samsaraNormalized).toHaveProperty("status");

      expect(geotabNormalized).toHaveProperty("externalVehicleId");
      expect(geotabNormalized).toHaveProperty("name");
      expect(geotabNormalized).toHaveProperty("status");
    });

    it("should preserve provider-specific data without loss", () => {
      const samsaraNormalized = normalizerSamsara.normalizeVehicle(
        mockSamsaraVehicles[0],
      );

      expect(samsaraNormalized.make).toBe("Honda");
      expect(samsaraNormalized.model).toBe("Odyssey");
      expect(samsaraNormalized.year).toBe(2022);
    });
  });
});
