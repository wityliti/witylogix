/**
 * Telematics Response Normalizer
 * Converts Samsara/Geotab responses to unified types
 * Handles unit conversions and provider-specific field mappings
 */

import type {
  TelematicsProvider,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  SamsaraVehicle,
  SamsaraLocation,
  SamsaraStats,
  SamsaraSafetyEvent,
  SamsaraFuel,
  GeotabDevice,
  GeotabDeviceStatusInfo,
  GeotabFaultData,
  GeotabStatusData,
  GeotabExceptionEvent,
  BehaviorEventType,
} from "./types.js";

/**
 * Unit conversion utilities
 */
const UnitConverters = {
  /**
   * Convert miles to kilometers
   */
  milesToKm(miles: number): number {
    return miles * 1.60934;
  },

  /**
   * Convert kilometers to miles
   */
  kmToMiles(km: number): number {
    return km / 1.60934;
  },

  /**
   * Convert gallons to liters
   */
  gallonsToLiters(gallons: number): number {
    return gallons * 3.78541;
  },

  /**
   * Convert liters to gallons
   */
  litersToGallons(liters: number): number {
    return liters / 3.78541;
  },

  /**
   * Convert Fahrenheit to Celsius
   */
  fahrenheitToCelsius(fahrenheit: number): number {
    return ((fahrenheit - 32) * 5) / 9;
  },

  /**
   * Convert Celsius to Fahrenheit
   */
  celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9) / 5 + 32;
  },

  /**
   * Convert mph to kmh
   */
  mphToKmh(mph: number): number {
    return mph * 1.60934;
  },

  /**
   * Convert kmh to mph
   */
  kmhToMph(kmh: number): number {
    return kmh / 1.60934;
  },
};

/**
 * Telematics Response Normalizer
 */
export class TelematicsNormalizer {
  private provider: TelematicsProvider;

  constructor(provider: TelematicsProvider) {
    this.provider = provider;
  }

  /**
   * Normalize Samsara vehicle response
   */
  normalizeVehicle(vehicle: SamsaraVehicle): NormalizedVehicle {
    return {
      externalVehicleId: vehicle.id,
      name: vehicle.name,
      vin: vehicle.staticFields?.vin,
      licensePlate: vehicle.staticFields?.licensePlate,
      make: vehicle.staticFields?.make,
      model: vehicle.staticFields?.model,
      year: vehicle.staticFields?.year,
      status: "ACTIVE", // Samsara doesn't explicitly provide status in list
      odometer: undefined,
    };
  }

  /**
   * Normalize Samsara position response
   */
  normalizePosition(location: SamsaraLocation, vehicleId: string): NormalizedPosition {
    return {
      externalVehicleId: vehicleId,
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: undefined,
      speed: {
        value: location.speedMph,
        unit: "mph",
      },
      heading: location.heading,
      accuracy: location.accuracy,
      timestamp: new Date(location.time),
    };
  }

  /**
   * Normalize Samsara diagnostic response
   */
  normalizeDiagnostic(stats: SamsaraStats, vehicleId: string): NormalizedDiagnostic {
    return {
      externalVehicleId: vehicleId,
      engineRunning: stats.engineState === "Running" || stats.engineState === "running",
      faultCodes: (stats.faultCodes || []).map((code) => ({
        code: `SPN${code.spnId}_FMI${code.fmiId}`,
        description: code.description,
        severity: this.parseFaultSeverity(code.description),
      })),
      vin: undefined,
      odometer: stats.odometer
        ? {
            value: stats.odometer.miles,
            unit: "miles",
          }
        : undefined,
      timestamp: new Date(),
    };
  }

  /**
   * Normalize Samsara behavior event response
   */
  normalizeBehaviorEvent(event: SamsaraSafetyEvent): NormalizedBehaviorEvent {
    return {
      externalEventId: event.id,
      externalVehicleId: event.vehicleId,
      externalDriverId: event.driverId,
      eventType: this.mapSamsaraBehaviorType(event.eventType, event.eventSubType),
      severity: (event.severity?.toLowerCase() as "info" | "warning" | "critical") || "warning",
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed
        ? {
            value: event.speed,
            unit: "mph",
          }
        : undefined,
      speedLimit: event.speedLimit
        ? {
            value: event.speedLimit,
            unit: "mph",
          }
        : undefined,
      timestamp: new Date(event.timestamp),
      description: event.description,
    };
  }

  /**
   * Normalize Samsara fuel response
   */
  normalizeFuel(fuel: SamsaraFuel & { id: string }): NormalizedFuelReading {
    return {
      externalVehicleId: fuel.id,
      fuelLevel: fuel.fuelPercentageRemaining || 0,
      fuelUnit: "gallons", // Samsara returns percentage, stored as gallons concept
      fuelCapacity: undefined,
      timestamp: new Date(),
    };
  }

  /**
   * Normalize Geotab device to vehicle
   */
  normalizeGeotabDevice(device: GeotabDevice): NormalizedVehicle {
    return {
      externalVehicleId: device.id,
      name: device.name,
      vin: device.vin,
      licensePlate: device.licensePlate,
      make: device.make,
      model: device.model,
      year: device.modelYear,
      status: this.mapGeotabDeviceStatus(device.status),
      odometer: undefined,
    };
  }

  /**
   * Normalize Geotab device status info to position
   */
  normalizeGeotabPosition(status: GeotabDeviceStatusInfo): NormalizedPosition {
    const dateTime = typeof status.dateTime === "string"
      ? new Date(status.dateTime)
      : new Date(status.dateTime);

    return {
      externalVehicleId: status.device.id,
      latitude: status.latitude,
      longitude: status.longitude,
      altitude: undefined,
      speed: {
        value: UnitConverters.kmhToMph(status.speed),
        unit: "mph",
      },
      heading: status.bearing,
      accuracy: undefined,
      timestamp: dateTime,
    };
  }

  /**
   * Normalize Geotab fault data and status data to diagnostics
   */
  normalizeGeotabDiagnostic(
    vehicleId: string,
    faults: GeotabFaultData[],
    statusData: GeotabStatusData[],
  ): NormalizedDiagnostic {
    // Check if engine is running from most recent status
    const engineStatus = statusData
      .filter((s) => s.diagnostic?.name?.toLowerCase().includes("engine"))
      .sort((a, b) => {
        const aTime = new Date(a.dateTime).getTime();
        const bTime = new Date(b.dateTime).getTime();
        return bTime - aTime;
      })[0];

    const engineRunning = engineStatus ? this.parseGeotabEngineStatus(engineStatus.value) : false;

    // Get odometer from status data if available
    const odometerStatus = statusData
      .filter((s) => s.diagnostic?.name?.toLowerCase().includes("odometer"))
      .sort((a, b) => {
        const aTime = new Date(a.dateTime).getTime();
        const bTime = new Date(b.dateTime).getTime();
        return bTime - aTime;
      })[0];

    const odometer = odometerStatus
      ? {
          value: Number(odometerStatus.value),
          unit: "kilometers" as const,
        }
      : undefined;

    return {
      externalVehicleId: vehicleId,
      engineRunning,
      faultCodes: faults.map((fault) => ({
        code: fault.code,
        description: fault.description,
        severity: "warning", // Geotab doesn't provide severity
      })),
      vin: undefined,
      odometer,
      timestamp: new Date(),
    };
  }

  /**
   * Normalize Geotab exception event to behavior event
   */
  normalizeGeotabBehaviorEvent(event: GeotabExceptionEvent): NormalizedBehaviorEvent {
    return {
      externalEventId: event.id,
      externalVehicleId: event.device?.id || "",
      externalDriverId: event.driver?.id,
      eventType: this.mapGeotabBehaviorType(event.type, event.exceptionType),
      severity: (event.severity?.toLowerCase() as "info" | "warning" | "critical") || "warning",
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed
        ? {
            value: UnitConverters.kmhToMph(event.speed),
            unit: "mph",
          }
        : undefined,
      speedLimit: event.speedZone?.postedSpeed
        ? {
            value: UnitConverters.kmhToMph(event.speedZone.postedSpeed),
            unit: "mph",
          }
        : undefined,
      timestamp: new Date(event.dateTime),
      description: event.type,
    };
  }

  /**
   * Normalize Geotab fuel level
   */
  normalizeGeotabFuel(status: GeotabStatusData): NormalizedFuelReading {
    return {
      externalVehicleId: status.device?.id || "",
      fuelLevel: Number(status.value),
      fuelUnit: "liters",
      fuelCapacity: undefined,
      timestamp: new Date(status.dateTime),
    };
  }

  /**
   * Map Samsara behavior event type to normalized type
   */
  private mapSamsaraBehaviorType(
    eventType: string,
    eventSubType: string,
  ): BehaviorEventType {
    const combined = `${eventType}:${eventSubType}`.toLowerCase();

    if (combined.includes("harsh") && combined.includes("accel")) {
      return "harsh_acceleration";
    }
    if (combined.includes("harsh") && combined.includes("brake")) {
      return "harsh_braking";
    }
    if (combined.includes("harsh") && combined.includes("turn")) {
      return "harsh_turn";
    }
    if (combined.includes("speed")) {
      return "speeding";
    }
    if (combined.includes("idle")) {
      return "idling";
    }
    if (combined.includes("seatbelt")) {
      return "seatbelt_off";
    }

    return "harsh_acceleration"; // Default
  }

  /**
   * Map Geotab behavior event type to normalized type
   */
  private mapGeotabBehaviorType(
    type: string,
    exceptionType?: string,
  ): BehaviorEventType {
    const combined = `${type}:${exceptionType || ""}`.toLowerCase();

    if (combined.includes("harsh") && combined.includes("accel")) {
      return "harsh_acceleration";
    }
    if (combined.includes("harsh") && combined.includes("brake")) {
      return "harsh_braking";
    }
    if (combined.includes("harsh") && combined.includes("turn")) {
      return "harsh_turn";
    }
    if (combined.includes("speeding") || combined.includes("speed")) {
      return "speeding";
    }
    if (combined.includes("idle")) {
      return "idling";
    }
    if (combined.includes("seatbelt")) {
      return "seatbelt_off";
    }
    if (combined.includes("phone") || combined.includes("distract")) {
      return "phone_use";
    }

    return "harsh_acceleration"; // Default
  }

  /**
   * Parse fault code severity from description
   */
  private parseFaultSeverity(
    description: string,
  ): "info" | "warning" | "error" | "critical" {
    const lower = description.toLowerCase();
    if (lower.includes("critical") || lower.includes("fatal")) return "critical";
    if (lower.includes("error") || lower.includes("severe")) return "error";
    if (lower.includes("warning")) return "warning";
    return "info";
  }

  /**
   * Map Geotab device status to normalized status
   */
  private mapGeotabDeviceStatus(status?: string): "ACTIVE" | "INACTIVE" | "DELETED" {
    if (!status) return "ACTIVE";
    const lower = status.toLowerCase();
    if (lower.includes("inactive") || lower.includes("disabled")) return "INACTIVE";
    if (lower.includes("delete")) return "DELETED";
    return "ACTIVE";
  }

  /**
   * Parse Geotab engine status value
   */
  private parseGeotabEngineStatus(value: number | string): boolean {
    if (typeof value === "number") {
      return value > 0;
    }
    const lower = String(value).toLowerCase();
    return lower === "true" || lower === "on" || lower === "running";
  }
}
