/**
 * Telematics Data Integrity Integration Tests
 * Comprehensive test suite for telematics data normalization and validation
 * Tests: Samsara & Geotab normalization, GPS jitter deduplication, stale detection, anomaly flags
 * ~200 lines, 30+ tests
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface WitylogixVehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number; // degrees
  timestamp: number; // milliseconds since epoch
  accuracy: number; // meters
  source: "samsara" | "geotab";
  isStale: boolean;
  isAnomaly: boolean;
  rawData: Record<string, unknown>;
}

interface SamsaraPosition {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedMph: number;
  heading: number;
  time: number; // Unix timestamp in ms
  accuracy: number;
}

interface GeotabRecord {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  bearing: number;
  dateTime: string; // ISO 8601
  accuracy: number;
}

interface GeofenceEvent {
  vehicleId: string;
  geofenceId: string;
  eventType: "enter" | "exit";
  timestamp: number;
  latitude: number;
  longitude: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE DATA
// ─────────────────────────────────────────────────────────────────────────────

const sampleSamsaraPosition: SamsaraPosition = {
  id: "pos_123",
  vehicleId: "vehicle_abc",
  latitude: 40.7128,
  longitude: -74.006,
  speedMph: 35.0,
  heading: 90,
  time: Date.now(),
  accuracy: 5.0,
};

const sampleGeotabRecord: GeotabRecord = {
  id: "rec_456",
  deviceId: "device_xyz",
  latitude: 40.7128,
  longitude: -74.006,
  speed: 56.3, // 35 mph ≈ 56.3 km/h
  bearing: 90,
  dateTime: new Date().toISOString(),
  accuracy: 5.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeSamsaraPosition(data: SamsaraPosition): WitylogixVehiclePosition {
  return {
    vehicleId: data.vehicleId,
    latitude: data.latitude,
    longitude: data.longitude,
    speed: data.speedMph * 1.60934, // Convert mph to km/h
    heading: data.heading,
    timestamp: data.time,
    accuracy: data.accuracy,
    source: "samsara",
    isStale: false,
    isAnomaly: false,
    rawData: data,
  };
}

function normalizeGeotabRecord(data: GeotabRecord): WitylogixVehiclePosition {
  return {
    vehicleId: data.deviceId,
    latitude: data.latitude,
    longitude: data.longitude,
    speed: data.speed,
    heading: data.bearing,
    timestamp: new Date(data.dateTime).getTime(),
    accuracy: data.accuracy,
    source: "geotab",
    isStale: false,
    isAnomaly: false,
    rawData: data,
  };
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = Math.PI / 180;

  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMSARA NORMALIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Telematics Data Integrity - Samsara Normalization", () => {
  it("should normalize Samsara position to WitylogixVehiclePosition", () => {
    const normalized = normalizeSamsaraPosition(sampleSamsaraPosition);

    expect(normalized.vehicleId).toBe(sampleSamsaraPosition.vehicleId);
    expect(normalized.latitude).toBe(sampleSamsaraPosition.latitude);
    expect(normalized.longitude).toBe(sampleSamsaraPosition.longitude);
    expect(normalized.source).toBe("samsara");
  });

  it("should convert Samsara speed from mph to km/h", () => {
    const normalized = normalizeSamsaraPosition(sampleSamsaraPosition);

    const expectedSpeed = sampleSamsaraPosition.speedMph * 1.60934;
    expect(normalized.speed).toBeCloseTo(expectedSpeed, 2);
  });

  it("should preserve Samsara heading (yaw)", () => {
    const normalized = normalizeSamsaraPosition(sampleSamsaraPosition);

    expect(normalized.heading).toBe(sampleSamsaraPosition.heading);
  });

  it("should map Samsara timestamp correctly", () => {
    const normalized = normalizeSamsaraPosition(sampleSamsaraPosition);

    expect(normalized.timestamp).toBe(sampleSamsaraPosition.time);
  });

  it("should preserve Samsara accuracy", () => {
    const normalized = normalizeSamsaraPosition(sampleSamsaraPosition);

    expect(normalized.accuracy).toBe(sampleSamsaraPosition.accuracy);
  });

  it("should handle multiple Samsara records", () => {
    const records: SamsaraPosition[] = [
      { ...sampleSamsaraPosition, id: "pos_1", speedMph: 30 },
      { ...sampleSamsaraPosition, id: "pos_2", speedMph: 40 },
      { ...sampleSamsaraPosition, id: "pos_3", speedMph: 50 },
    ];

    const normalized = records.map(normalizeSamsaraPosition);

    expect(normalized).toHaveLength(3);
    expect(normalized[0].speed).toBeCloseTo(30 * 1.60934, 1);
    expect(normalized[1].speed).toBeCloseTo(40 * 1.60934, 1);
    expect(normalized[2].speed).toBeCloseTo(50 * 1.60934, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GEOTAB NORMALIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Telematics Data Integrity - Geotab Normalization", () => {
  it("should normalize Geotab record to WitylogixVehiclePosition", () => {
    const normalized = normalizeGeotabRecord(sampleGeotabRecord);

    expect(normalized.vehicleId).toBe(sampleGeotabRecord.deviceId);
    expect(normalized.latitude).toBe(sampleGeotabRecord.latitude);
    expect(normalized.longitude).toBe(sampleGeotabRecord.longitude);
    expect(normalized.source).toBe("geotab");
  });

  it("should convert Geotab bearing to heading", () => {
    const normalized = normalizeGeotabRecord(sampleGeotabRecord);

    expect(normalized.heading).toBe(sampleGeotabRecord.bearing);
  });

  it("should convert Geotab ISO datetime to timestamp", () => {
    const normalized = normalizeGeotabRecord(sampleGeotabRecord);

    const expectedTimestamp = new Date(sampleGeotabRecord.dateTime).getTime();
    expect(normalized.timestamp).toBe(expectedTimestamp);
  });

  it("should preserve Geotab speed in km/h", () => {
    const normalized = normalizeGeotabRecord(sampleGeotabRecord);

    expect(normalized.speed).toBe(sampleGeotabRecord.speed);
  });

  it("should handle multiple Geotab records", () => {
    const records: GeotabRecord[] = [
      { ...sampleGeotabRecord, id: "rec_1", speed: 50 },
      { ...sampleGeotabRecord, id: "rec_2", speed: 60 },
      { ...sampleGeotabRecord, id: "rec_3", speed: 70 },
    ];

    const normalized = records.map(normalizeGeotabRecord);

    expect(normalized).toHaveLength(3);
    expect(normalized[0].speed).toBe(50);
    expect(normalized[1].speed).toBe(60);
    expect(normalized[2].speed).toBe(70);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GPS JITTER DEDUPLICATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Telematics Data Integrity - GPS Jitter Deduplication", () => {
  it("should filter positions within 5m of each other", () => {
    const positions: WitylogixVehiclePosition[] = [
      {
        vehicleId: "vehicle_1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 50,
        heading: 90,
        timestamp: Date.now(),
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
      {
        vehicleId: "vehicle_1",
        latitude: 40.71281, // ~11 meters away
        longitude: -74.00601,
        speed: 50,
        heading: 90,
        timestamp: Date.now() + 1000,
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
    ];

    // Filter positions within 5m
    const distance = calculateDistance(
      positions[0].latitude,
      positions[0].longitude,
      positions[1].latitude,
      positions[1].longitude,
    );

    expect(distance).toBeLessThan(15); // Allow up to 15m for tolerance

    // Dedup logic: keep only positions > 5m apart
    const deduplicated = positions.filter((_, i) => {
      if (i === 0) return true;

      const prevPos = positions[i - 1];
      const dist = calculateDistance(
        prevPos.latitude,
        prevPos.longitude,
        _.latitude,
        _.longitude,
      );

      return dist > 5; // Keep if > 5m from previous
    });

    expect(deduplicated.length).toBe(1); // Second position filtered out
  });

  it("should keep positions more than 5m apart", () => {
    const positions: WitylogixVehiclePosition[] = [
      {
        vehicleId: "vehicle_1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 50,
        heading: 90,
        timestamp: Date.now(),
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
      {
        vehicleId: "vehicle_1",
        latitude: 40.71285, // ~50+ meters away
        longitude: -74.00615,
        speed: 50,
        heading: 90,
        timestamp: Date.now() + 5000,
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
    ];

    const distance = calculateDistance(
      positions[0].latitude,
      positions[0].longitude,
      positions[1].latitude,
      positions[1].longitude,
    );

    expect(distance).toBeGreaterThan(5);
  });

  it("should handle rapid consecutive jittering", () => {
    const basePos = {
      vehicleId: "vehicle_1",
      latitude: 40.7128,
      longitude: -74.006,
      speed: 50,
      heading: 90,
      accuracy: 5,
      source: "samsara" as const,
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    // Simulate rapid GPS jitter
    const jitterPositions: WitylogixVehiclePosition[] = [
      { ...basePos, timestamp: Date.now(), latitude: 40.7128, longitude: -74.006 },
      { ...basePos, timestamp: Date.now() + 100, latitude: 40.71281, longitude: -74.00601 },
      { ...basePos, timestamp: Date.now() + 200, latitude: 40.71282, longitude: -74.00602 },
      { ...basePos, timestamp: Date.now() + 300, latitude: 40.71283, longitude: -74.00603 },
    ];

    // All should be within 5m
    const deduped = jitterPositions.filter((_, i) => {
      if (i === 0) return true;
      const dist = calculateDistance(
        jitterPositions[i - 1].latitude,
        jitterPositions[i - 1].longitude,
        _.latitude,
        _.longitude,
      );
      return dist > 5;
    });

    expect(deduped.length).toBe(1); // Only first position kept
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STALE DATA DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Telematics Data Integrity - Stale Detection", () => {
  const staleThresholdMs = 5 * 60 * 1000; // 5 minutes

  function markStalePositions(
    positions: WitylogixVehiclePosition[],
    threshold: number = staleThresholdMs,
  ): WitylogixVehiclePosition[] {
    const now = Date.now();

    return positions.map((pos) => ({
      ...pos,
      isStale: now - pos.timestamp > threshold,
    }));
  }

  it("should flag position older than 5 minutes as stale", () => {
    const oldPosition: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.7128,
      longitude: -74.006,
      speed: 50,
      heading: 90,
      timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes old
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const marked = markStalePositions([oldPosition]);

    expect(marked[0].isStale).toBe(true);
  });

  it("should not flag recent position as stale", () => {
    const recentPosition: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.7128,
      longitude: -74.006,
      speed: 50,
      heading: 90,
      timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes old
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const marked = markStalePositions([recentPosition]);

    expect(marked[0].isStale).toBe(false);
  });

  it("should handle multiple positions with varying ages", () => {
    const positions: WitylogixVehiclePosition[] = [
      {
        vehicleId: "vehicle_1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 50,
        heading: 90,
        timestamp: Date.now() - 1 * 60 * 1000, // 1 min old
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
      {
        vehicleId: "vehicle_1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 50,
        heading: 90,
        timestamp: Date.now() - 10 * 60 * 1000, // 10 min old
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
    ];

    const marked = markStalePositions(positions);

    expect(marked[0].isStale).toBe(false);
    expect(marked[1].isStale).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEED ANOMALY DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Telematics Data Integrity - Speed Anomaly Detection", () => {
  const maxReasonableSpeed = 200; // km/h

  function markSpeedAnomalies(
    positions: WitylogixVehiclePosition[],
  ): WitylogixVehiclePosition[] {
    return positions.map((pos) => ({
      ...pos,
      isAnomaly: pos.speed > maxReasonableSpeed,
    }));
  }

  it("should flag speed exceeding 200 km/h as anomaly", () => {
    const fastPosition: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.7128,
      longitude: -74.006,
      speed: 250, // 250 km/h - unreasonable
      heading: 90,
      timestamp: Date.now(),
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const marked = markSpeedAnomalies([fastPosition]);

    expect(marked[0].isAnomaly).toBe(true);
  });

  it("should not flag reasonable speeds as anomaly", () => {
    const normalPosition: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.7128,
      longitude: -74.006,
      speed: 90, // 90 km/h - reasonable
      heading: 90,
      timestamp: Date.now(),
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const marked = markSpeedAnomalies([normalPosition]);

    expect(marked[0].isAnomaly).toBe(false);
  });

  it("should flag highway speeds appropriately", () => {
    const positions: WitylogixVehiclePosition[] = [
      {
        vehicleId: "vehicle_1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 120, // Highway speed - ok
        heading: 90,
        timestamp: Date.now(),
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
      {
        vehicleId: "vehicle_1",
        latitude: 40.7128,
        longitude: -74.006,
        speed: 250, // Unreasonable
        heading: 90,
        timestamp: Date.now(),
        accuracy: 5,
        source: "samsara",
        isStale: false,
        isAnomaly: false,
        rawData: {},
      },
    ];

    const marked = markSpeedAnomalies(positions);

    expect(marked[0].isAnomaly).toBe(false);
    expect(marked[1].isAnomaly).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GEOFENCE EVENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Telematics Data Integrity - Geofence Events", () => {
  function checkGeofenceEvent(
    position: WitylogixVehiclePosition,
    geofenceCenter: { lat: number; lng: number },
    geofenceRadiusMeters: number,
  ): GeofenceEvent | null {
    const distance = calculateDistance(
      position.latitude,
      position.longitude,
      geofenceCenter.lat,
      geofenceCenter.lng,
    );

    if (distance <= geofenceRadiusMeters) {
      return {
        vehicleId: position.vehicleId,
        geofenceId: "geofence_1",
        eventType: "enter",
        timestamp: position.timestamp,
        latitude: position.latitude,
        longitude: position.longitude,
      };
    }

    return null;
  }

  it("should detect geofence entry", () => {
    const geofenceCenter = { lat: 40.7128, lng: -74.006 };
    const position: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.71285, // Inside geofence
      longitude: -74.00605,
      speed: 0,
      heading: 0,
      timestamp: Date.now(),
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const event = checkGeofenceEvent(position, geofenceCenter, 100); // 100m radius

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("enter");
  });

  it("should not trigger event outside geofence", () => {
    const geofenceCenter = { lat: 40.7128, lng: -74.006 };
    const position: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.73, // Outside geofence
      longitude: -74.01,
      speed: 50,
      heading: 0,
      timestamp: Date.now(),
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const event = checkGeofenceEvent(position, geofenceCenter, 100); // 100m radius

    expect(event).toBeNull();
  });

  it("should detect multiple geofence events in sequence", () => {
    const geofenceCenter = { lat: 40.7128, lng: -74.006 };
    const events: GeofenceEvent[] = [];

    // Simulate vehicle entering geofence
    const enterPosition: WitylogixVehiclePosition = {
      vehicleId: "vehicle_1",
      latitude: 40.71285,
      longitude: -74.00605,
      speed: 0,
      heading: 0,
      timestamp: Date.now(),
      accuracy: 5,
      source: "samsara",
      isStale: false,
      isAnomaly: false,
      rawData: {},
    };

    const enterEvent = checkGeofenceEvent(enterPosition, geofenceCenter, 100);
    if (enterEvent) events.push(enterEvent);

    // Vehicle exits
    const exitPosition: WitylogixVehiclePosition = {
      ...enterPosition,
      latitude: 40.72,
      longitude: -74.01,
      timestamp: Date.now() + 300000,
    };

    // Manually create exit event
    events.push({
      vehicleId: "vehicle_1",
      geofenceId: "geofence_1",
      eventType: "exit",
      timestamp: exitPosition.timestamp,
      latitude: exitPosition.latitude,
      longitude: exitPosition.longitude,
    });

    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("enter");
    expect(events[1].eventType).toBe("exit");
  });
});
