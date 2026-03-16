/**
 * Telematics Live Vehicle Tracking Types
 * Witylogix unified types for real-time vehicle position, driver status, and diagnostics
 */

/**
 * Vehicle position with GPS data
 */
export interface WitylogixVehiclePosition {
  /** Vehicle ID */
  vehicleId: string;
  /** Latitude in decimal degrees */
  lat: number;
  /** Longitude in decimal degrees */
  lng: number;
  /** Heading in degrees (0-360) */
  heading: number;
  /** Speed in mph */
  speed: number;
  /** Timestamp of the position reading */
  timestamp: Date;
  /** Telematics provider (samsara, geotab, etc) */
  provider: string;
  /** GPS accuracy in meters */
  accuracy: number;
  /** Altitude in meters */
  altitude?: number;
}

/**
 * Driver duty and shift status
 */
export interface WitylogixDriverStatus {
  /** Driver ID */
  driverId: string;
  /** Associated vehicle ID */
  vehicleId: string;
  /** Driver status (active, offline, on_break, etc) */
  status: "ACTIVE" | "INACTIVE" | "ON_BREAK" | "OFFLINE" | "UNKNOWN";
  /** Duty status (on_duty, off_duty, driving, on_break) */
  dutyStatus?: "ON_DUTY" | "OFF_DUTY" | "DRIVING" | "ON_BREAK" | "SLEEPING";
  /** Last known location */
  lastLocation?: WitylogixVehiclePosition;
  /** Shift start time */
  shiftStart?: Date;
  /** Hours of service remaining */
  hoursRemaining?: number;
}

/**
 * Vehicle diagnostics and metrics
 */
export interface WitylogixVehicleDiagnostics {
  /** Vehicle ID */
  vehicleId: string;
  /** Fuel level (0-100% or absolute value) */
  fuelLevel?: number;
  /** Fuel unit (percentage or absolute) */
  fuelUnit?: "percent" | "gallons" | "liters";
  /** Odometer reading */
  odometer?: {
    value: number;
    unit: "miles" | "kilometers";
  };
  /** Engine running hours (if available) */
  engineHours?: number;
  /** Battery voltage or percentage */
  battery?: {
    value: number;
    unit: "volts" | "percent";
  };
  /** Engine fault/diagnostic trouble codes */
  dtcCodes?: Array<{
    code: string;
    description: string;
    severity: "info" | "warning" | "critical";
  }>;
  /** Last service date */
  lastService?: Date;
}

/**
 * Safety event (harsh acceleration, speeding, etc)
 */
export interface WitylogixSafetyEvent {
  /** Driver ID associated with the event */
  driverId: string;
  /** Event type (harsh_acceleration, speeding, harsh_braking, etc) */
  eventType:
    | "harsh_acceleration"
    | "harsh_braking"
    | "harsh_turn"
    | "speeding"
    | "idling"
    | "seatbelt_off"
    | "phone_use"
    | "drowsy_driving"
    | "collision"
    | "other";
  /** Event severity */
  severity: "info" | "warning" | "critical";
  /** When the event occurred */
  timestamp: Date;
  /** Location of the event */
  location?: {
    lat: number;
    lng: number;
  };
  /** Video or evidence URL if available */
  videoUrl?: string;
  /** Additional event details */
  details?: Record<string, unknown>;
}

/**
 * Telematics provider interface
 */
export interface TelematicsProvider {
  /** Get all vehicles in the fleet */
  getVehicles(): Promise<WitylogixVehiclePosition[]>;

  /** Get current position of a specific vehicle */
  getVehiclePosition(vehicleId: string): Promise<WitylogixVehiclePosition>;

  /** Get positions for multiple vehicles in batch */
  getBatchVehiclePositions(vehicleIds: string[]): Promise<WitylogixVehiclePosition[]>;

  /** Get driver status */
  getDriverStatus(driverId: string): Promise<WitylogixDriverStatus>;

  /** Get vehicle diagnostics */
  getVehicleDiagnostics(vehicleId: string): Promise<WitylogixVehicleDiagnostics>;

  /** Get location history trail */
  getLocationHistory(
    vehicleId: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
  ): Promise<WitylogixVehiclePosition[]>;

  /** Get recent safety events */
  getSafetyEvents(
    driverId?: string,
    options?: {
      limit?: number;
      since?: Date;
    },
  ): Promise<WitylogixSafetyEvent[]>;

  /** Health check endpoint */
  healthCheck(): Promise<boolean>;
}

/**
 * Vehicle feed event types
 */
export type VehicleFeedEventType = "position-update" | "status-change" | "alert" | "error";

/**
 * Vehicle feed event
 */
export interface VehicleFeedEvent {
  type: VehicleFeedEventType;
  vehicleId?: string;
  driverId?: string;
  data: unknown;
  timestamp: Date;
  error?: Error;
}

/**
 * Vehicle feed service configuration
 */
export interface VehicleFeedConfig {
  /** Update interval in milliseconds (default: 10000) */
  updateInterval?: number;
  /** Whether to use SSE or polling (default: polling) */
  transport?: "sse" | "polling";
  /** Maximum positions to store per vehicle (default: 100) */
  maxPositions?: number;
  /** Stale position threshold in milliseconds (default: 300000 = 5 min) */
  staleThreshold?: number;
  /** Enable position smoothing/interpolation */
  smoothing?: boolean;
}
