/**
 * Telematics Data Normalization Pipeline v2
 * Converts raw provider data to Witylogix unified types with enrichment
 * Pipeline: Raw → Normalized → Enriched → Stored
 */

import type {
  WitylogixVehiclePosition,
  WitylogixVehicleDiagnostics,
} from "./telematics-types.js";
import type {
  NormalizedPosition,
  NormalizedDiagnostic,
  SamsaraLocation,
  SamsaraStats,
} from "./types.js";
import type {
  GeotabLogRecord,
  GeotabStatusData,
  GeotabTrip,
} from "./geotab-sdk-client.js";

/**
 * Normalized Trip
 */
export interface WitylogixTrip {
  vehicleId: string;
  startDateTime: Date;
  stopDateTime: Date;
  startLocation: { lat: number; lng: number };
  stopLocation: { lat: number; lng: number };
  distance: number; // miles
  durationMinutes: number;
  avgSpeed: number; // mph
  stops: number;
  idleMinutes: number;
  provider: string;
}

/**
 * Geofence configuration
 */
export interface GeofenceConfig {
  id: string;
  name: string;
  type: "circle" | "polygon";
  center?: { lat: number; lng: number };
  radius?: number; // meters
  points?: Array<{ lat: number; lng: number }>;
}

/**
 * Enriched position with geofence data
 */
export interface EnrichedVehiclePosition extends WitylogixVehiclePosition {
  geofences: Array<{
    id: string;
    name: string;
    type: "entry" | "exit" | "inside";
  }>;
  speedLimitViolation?: boolean;
  idling?: boolean;
}

/**
 * Tenant-specific normalization rules
 */
export interface TenantNormalizationRules {
  speedUnit: "mph" | "kmh";
  distanceUnit: "miles" | "kilometers";
  fuelUnit: "gallons" | "liters" | "percent";
  deduplicationMeters?: number; // default 5m
  idleSpeedThreshold?: number; // mph, default 2
  idleDurationMinutes?: number; // default 3
}

/**
 * Position deduplication state
 */
interface DeduplicationState {
  [vehicleId: string]: {
    lastPosition?: WitylogixVehiclePosition;
    lastDeduplicatedAt?: Date;
  };
}

/**
 * Telematics Normalization Pipeline
 */
export class TelematicsNormalizerV2 {
  private deduplicationState: DeduplicationState = {};
  private defaultRules: TenantNormalizationRules = {
    speedUnit: "mph",
    distanceUnit: "miles",
    fuelUnit: "gallons",
    deduplicationMeters: 5,
    idleSpeedThreshold: 2,
    idleDurationMinutes: 3,
  };

  constructor(private tenantRules?: TenantNormalizationRules) {
    this.tenantRules = { ...this.defaultRules, ...tenantRules };
  }

  /**
   * Normalize Geotab LogRecord to WitylogixVehiclePosition
   */
  normalizeGeotabPosition(
    record: GeotabLogRecord,
    provider: string = "geotab",
  ): WitylogixVehiclePosition {
    return {
      vehicleId: record.device.id,
      lat: record.latitude,
      lng: record.longitude,
      heading: record.bearing,
      speed: this.convertSpeed(record.speed, "kmh", this.tenantRules!.speedUnit),
      timestamp: new Date(record.dateTime),
      provider,
      accuracy: 0, // Geotab doesn't provide accuracy
    };
  }

  /**
   * Normalize Geotab StatusData to WitylogixVehicleDiagnostics
   */
  normalizeGeotabDiagnostics(
    statusDataList: GeotabStatusData[],
    faultDataList?: Array<{
      code: string;
      description: string;
    }>,
  ): WitylogixVehicleDiagnostics {
    if (statusDataList.length === 0) {
      throw new Error("No status data provided");
    }

    const vehicleId = statusDataList[0].device.id;

    // Build diagnostics from status data
    const diagnosticMap = new Map<string, GeotabStatusData>();
    statusDataList.forEach((data) => {
      diagnosticMap.set(data.diagnostic.name, data);
    });

    return {
      vehicleId,
      fuelLevel: this.extractNumericValue(diagnosticMap.get("FuelLevel")),
      fuelUnit: this.tenantRules?.fuelUnit || "gallons",
      odometer: this.extractOdometerData(diagnosticMap.get("Odometer")),
      engineHours: this.extractNumericValue(diagnosticMap.get("EngineHours")),
      battery: this.extractBatteryData(diagnosticMap.get("BatteryVoltage")),
      dtcCodes: faultDataList?.map((fault) => ({
        code: fault.code,
        description: fault.description,
        severity: this.inferDTCServerity(fault.code),
      })),
    };
  }

  /**
   * Normalize Geotab Trip to WitylogixTrip
   */
  normalizeGeotabTrip(trip: GeotabTrip): WitylogixTrip {
    const distanceMiles = this.convertDistance(trip.distance, "kilometers", "miles");

    return {
      vehicleId: trip.device.id,
      startDateTime: new Date(trip.startDateTime),
      stopDateTime: new Date(trip.stopDateTime),
      startLocation: { lat: 0, lng: 0 }, // Will be enriched from log records
      stopLocation: { lat: 0, lng: 0 },
      distance: distanceMiles,
      durationMinutes: trip.drivingDurationMinutes,
      avgSpeed: distanceMiles / (trip.drivingDurationMinutes / 60),
      stops: trip.stops,
      idleMinutes: 0, // Will be calculated if needed
      provider: "geotab",
    };
  }

  /**
   * Normalize Samsara location to WitylogixVehiclePosition
   */
  normalizeSamsaraPosition(location: SamsaraLocation, provider: string = "samsara"): WitylogixVehiclePosition {
    return {
      vehicleId: location.vehicleId,
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
      speed: this.convertSpeed(location.speedMph, "mph", this.tenantRules!.speedUnit),
      timestamp: new Date(location.time),
      provider,
      accuracy: location.accuracy || 0,
    };
  }

  /**
   * Normalize Samsara stats to WitylogixVehicleDiagnostics
   */
  normalizeSamsaraDiagnostics(
    vehicleId: string,
    stats: SamsaraStats,
  ): WitylogixVehicleDiagnostics {
    return {
      vehicleId,
      fuelLevel: stats.odometer ? undefined : undefined,
      fuelUnit: this.tenantRules?.fuelUnit || "gallons",
      odometer: stats.odometer
        ? {
            value: this.convertDistance(stats.odometer.miles, "miles", this.tenantRules!.distanceUnit),
            unit: this.tenantRules!.distanceUnit,
          }
        : undefined,
      dtcCodes: stats.faultCodes?.map((code) => ({
        code: `SPN${code.spnId}_FMI${code.fmiId}`,
        description: code.description,
        severity: "warning" as const,
      })),
    };
  }

  /**
   * Deduplicate positions based on distance threshold
   */
  deduplicatePosition(position: WitylogixVehiclePosition): WitylogixVehiclePosition | null {
    const threshold = this.tenantRules?.deduplicationMeters || 5;
    const state = this.deduplicationState[position.vehicleId];

    if (!state?.lastPosition) {
      // First position for this vehicle
      this.deduplicationState[position.vehicleId] = { lastPosition: position };
      return position;
    }

    const distance = this.haversineDistance(
      state.lastPosition.lat,
      state.lastPosition.lng,
      position.lat,
      position.lng,
    );

    // If within threshold distance, skip
    if (distance < threshold) {
      return null;
    }

    // Update state and return
    this.deduplicationState[position.vehicleId] = { lastPosition: position };
    return position;
  }

  /**
   * Enrich position with geofence information
   */
  enrichPositionWithGeofences(
    position: WitylogixVehiclePosition,
    geofences: GeofenceConfig[],
  ): EnrichedVehiclePosition {
    const matchedGeofences = geofences
      .filter((gf) => this.isPointInGeofence(position.lat, position.lng, gf))
      .map((gf) => ({
        id: gf.id,
        name: gf.name,
        type: "inside" as const,
      }));

    return {
      ...position,
      geofences: matchedGeofences,
    };
  }

  /**
   * Detect idle state (speed below threshold)
   */
  detectIdling(position: WitylogixVehiclePosition): boolean {
    const threshold = this.tenantRules?.idleSpeedThreshold || 2;
    return position.speed <= threshold;
  }

  /**
   * Enrich position with idle detection
   */
  enrichPositionWithIdleDetection(position: WitylogixVehiclePosition): EnrichedVehiclePosition {
    return {
      ...(position as EnrichedVehiclePosition),
      geofences: (position as EnrichedVehiclePosition).geofences || [],
      idling: this.detectIdling(position),
    };
  }

  /**
   * Convert speed between units
   */
  private convertSpeed(value: number, fromUnit: "mph" | "kmh", toUnit: "mph" | "kmh"): number {
    if (fromUnit === toUnit) return value;
    if (fromUnit === "mph" && toUnit === "kmh") {
      return value * 1.60934;
    }
    return value / 1.60934;
  }

  /**
   * Convert distance between units
   */
  private convertDistance(
    value: number,
    fromUnit: "miles" | "kilometers",
    toUnit: "miles" | "kilometers",
  ): number {
    if (fromUnit === toUnit) return value;
    if (fromUnit === "miles" && toUnit === "kilometers") {
      return value * 1.60934;
    }
    return value / 1.60934;
  }

  /**
   * Extract numeric value from StatusData
   */
  private extractNumericValue(statusData?: GeotabStatusData): number | undefined {
    if (!statusData) return undefined;
    const value = statusData.value;
    return typeof value === "number" ? value : parseFloat(String(value)) || undefined;
  }

  /**
   * Extract odometer data
   */
  private extractOdometerData(statusData?: GeotabStatusData): { value: number; unit: "miles" | "kilometers" } | undefined {
    const value = this.extractNumericValue(statusData);
    return value
      ? {
          value: this.convertDistance(value, "kilometers", this.tenantRules!.distanceUnit),
          unit: this.tenantRules!.distanceUnit,
        }
      : undefined;
  }

  /**
   * Extract battery data
   */
  private extractBatteryData(
    statusData?: GeotabStatusData,
  ): { value: number; unit: "volts" | "percent" } | undefined {
    const value = this.extractNumericValue(statusData);
    return value ? { value, unit: "volts" } : undefined;
  }

  /**
   * Infer DTC severity from code
   */
  private inferDTCServerity(code: string): "info" | "warning" | "critical" {
    if (code.includes("P0")) return "critical";
    if (code.includes("P1")) return "warning";
    return "info";
  }

  /**
   * Check if point is inside geofence (circle or polygon)
   */
  private isPointInGeofence(lat: number, lng: number, geofence: GeofenceConfig): boolean {
    if (geofence.type === "circle" && geofence.center && geofence.radius) {
      const distance = this.haversineDistance(lat, lng, geofence.center.lat, geofence.center.lng);
      return distance <= geofence.radius;
    }

    if (geofence.type === "polygon" && geofence.points && geofence.points.length >= 3) {
      return this.pointInPolygon(lat, lng, geofence.points);
    }

    return false;
  }

  /**
   * Haversine distance calculation in meters
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Point-in-polygon test using ray casting
   */
  private pointInPolygon(lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Reset deduplication state for a vehicle
   */
  resetDeduplicationState(vehicleId: string): void {
    delete this.deduplicationState[vehicleId];
  }

  /**
   * Reset all deduplication state
   */
  resetAllDeduplicationState(): void {
    this.deduplicationState = {};
  }

  /**
   * Update tenant rules
   */
  updateTenantRules(rules: Partial<TenantNormalizationRules>): void {
    this.tenantRules = { ...this.defaultRules, ...this.tenantRules, ...rules };
  }
}
