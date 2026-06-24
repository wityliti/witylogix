/**
 * Telematics Integration Types
 * Unified types for Samsara and Geotab telematics providers
 */

/**
 * Telematics Provider Type
 */
export type TelematicsProvider = "samsara" | "geotab";

/**
 * Telematics Credential Types
 */
export interface SamsaraCredentials {
  apiToken: string;
}

export interface GeotabCredentials {
  database: string;
  userName: string;
  password: string;
  sessionId?: string; // Cached session token
}

export type TelematicsCredentials = SamsaraCredentials | GeotabCredentials;

/**
 * Telematics Configuration
 */
export interface TelematicsConfig {
  provider: TelematicsProvider;
  credentials: TelematicsCredentials;
  timeout?: number; // milliseconds, default 30000
  rateLimit?: number; // requests per second, default 10
  retries?: number; // retry attempts, default 3
}

/**
 * Vehicle Status
 */
export type VehicleStatus = "ACTIVE" | "INACTIVE" | "DELETED";

/**
 * Normalized Vehicle
 */
export interface NormalizedVehicle {
  externalVehicleId: string; // Provider's unique ID
  name: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number;
  status: VehicleStatus;
  odometer?: {
    value: number;
    unit: "miles" | "kilometers";
  };
}

/**
 * Normalized Position (Location)
 */
export interface NormalizedPosition {
  externalVehicleId: string;
  latitude: number;
  longitude: number;
  altitude?: number; // meters
  speed?: {
    value: number;
    unit: "mph" | "kmh";
  };
  heading?: number; // degrees (0-360)
  accuracy?: number; // meters
  timestamp: Date;
}

/**
 * Engine Fault Code
 */
export interface EngineFaultCode {
  code: string;
  description: string;
  severity: "info" | "warning" | "error" | "critical";
}

/**
 * Normalized Diagnostic
 */
export interface NormalizedDiagnostic {
  externalVehicleId: string;
  engineRunning: boolean;
  faultCodes: EngineFaultCode[];
  vin?: string;
  odometer?: {
    value: number;
    unit: "miles" | "kilometers";
  };
  timestamp: Date;
}

/**
 * Behavior Event Type
 */
export type BehaviorEventType =
  | "harsh_acceleration"
  | "harsh_braking"
  | "harsh_turn"
  | "speeding"
  | "idling"
  | "seatbelt_off"
  | "phone_use"
  | "drowsy_driving"
  | "rapid_acceleration"
  | "rapid_deceleration";

/**
 * Behavior Event Severity
 */
export type BehaviorEventSeverity = "info" | "warning" | "critical";

/**
 * Normalized Driver Behavior Event
 */
export interface NormalizedBehaviorEvent {
  externalEventId: string;
  externalVehicleId: string;
  externalDriverId?: string;
  eventType: BehaviorEventType;
  severity: BehaviorEventSeverity;
  latitude: number;
  longitude: number;
  speed?: {
    value: number;
    unit: "mph" | "kmh";
  };
  speedLimit?: {
    value: number;
    unit: "mph" | "kmh";
  };
  timestamp: Date;
  description?: string;
}

/**
 * Fuel Reading Unit
 */
export type FuelUnit = "gallons" | "liters";

/**
 * Normalized Fuel Reading
 */
export interface NormalizedFuelReading {
  externalVehicleId: string;
  fuelLevel: number; // 0-100 percentage or absolute value depending on unit
  fuelUnit: FuelUnit;
  fuelCapacity?: number; // in same unit as fuelLevel
  timestamp: Date;
}

/**
 * Telematics Event (Generic)
 */
export interface TelematicsEvent {
  id: string;
  provider: TelematicsProvider;
  type: "position" | "diagnostic" | "behavior" | "fuel";
  vehicleId: string; // external ID
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Telematics Webhook Subscription
 */
export interface WebhookSubscription {
  webhookId: string;
  url: string;
  events: string[];
  createdAt: Date;
}

/**
 * Abstract Telematics Adapter Interface
 */
export interface ITelematicsAdapter {
  /**
   * Authenticate with the telematics provider
   */
  authenticate(): Promise<void>;

  /**
   * Get all vehicles
   */
  getVehicles(): Promise<NormalizedVehicle[]>;

  /**
   * Get current position of a vehicle
   */
  getVehiclePosition(vehicleId: string): Promise<NormalizedPosition>;

  /**
   * Get diagnostics for a vehicle
   */
  getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic>;

  /**
   * Get driver behavior events
   */
  getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]>;

  /**
   * Get fuel level for a vehicle
   */
  getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading>;

  /**
   * Subscribe to events via webhook
   */
  subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription>;

  /**
   * Unsubscribe from events
   */
  unsubscribeFromEvents(webhookId: string): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Sync Options for batch data retrieval
 */
export interface SyncOptions {
  /** Start of the date range to sync */
  startDate?: Date;
  /** End of the date range to sync */
  endDate?: Date;
  /** Maximum number of records to fetch */
  limit?: number;
  /** Page offset for pagination */
  offset?: number;
  /** Whether to force a full sync ignoring cache */
  forceRefresh?: boolean;
}

/**
 * Rate Limit State
 */
export interface RateLimitState {
  requestCount: number;
  resetAt: Date;
}

/**
 * Cache Options
 */
export interface CacheOptions {
  ttl: number; // milliseconds
  key: string;
}

/**
 * Polling Configuration
 */
export interface PollingConfig {
  positionIntervalMs?: number; // default 30000
  diagnosticIntervalMs?: number; // default 300000 (5 min)
  fuelIntervalMs?: number; // default 120000 (2 min)
  behaviorIntervalMs?: number; // default 600000 (10 min)
}

/**
 * Polling State
 */
export interface PollingState {
  vehicleId: string;
  lastPositionPoll?: Date;
  lastDiagnosticPoll?: Date;
  lastFuelPoll?: Date;
  lastBehaviorPoll?: Date;
  errorCount: number;
  lastError?: Error;
}

/**
 * Samsara-specific types
 */
export interface SamsaraVehicle {
  id: string;
  name: string;
  externalIds: Array<{ externalIdType: string; value: string }>;
  staticFields: {
    vin?: string;
    licensePlate?: string;
    make?: string;
    model?: string;
    year?: number;
  };
  onboardingTagIds?: string[];
}

export interface SamsaraLocation {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedMph: number;
  heading: number;
  time: string; // ISO 8601
  accuracy?: number;
}

export interface SamsaraStats {
  engineState: string;
  odometer?: {
    miles: number;
  };
  faultCodes?: Array<{
    id: string;
    spnId: number;
    fmiId: number;
    description: string;
  }>;
}

export interface SamsaraSafetyEvent {
  id: string;
  vehicleId: string;
  driverId?: string;
  eventType: string;
  eventSubType: string;
  severity: string;
  latitude: number;
  longitude: number;
  speed?: number;
  speedLimit?: number;
  timestamp: string; // ISO 8601
  description?: string;
}

export interface SamsaraFuel {
  vehicleId: string;
  fuelPercentageRemaining?: number;
}

/**
 * Geotab-specific types
 */
export interface GeotabDevice {
  id: string;
  name: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  modelYear?: number;
  deviceType: string;
  status?: string;
}

export interface GeotabDeviceStatusInfo {
  device: { id: string };
  latitude: number;
  longitude: number;
  speed: number;
  bearing: number;
  dateTime: string; // ISO 8601 or timestamp
}

export interface GeotabFaultData {
  device: { id: string };
  id: string;
  code: string;
  description: string;
  dateTime: string;
  dismissDateTime?: string;
}

export interface GeotabStatusData {
  device: { id: string };
  diagnostic: { id: string; name: string };
  value: number | string;
  dateTime: string;
}

export interface GeotabExceptionEvent {
  id: string;
  device: { id: string };
  driver?: { id: string };
  type: string;
  exceptionType?: string;
  severity?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  speedZone?: { postedSpeed: number };
  dateTime: string;
  activeFrom: string;
  activeTo: string;
}

/**
 * Circuit Breaker State
 */
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number; // number of failures before opening
  successThreshold: number; // number of successes to close
  timeout: number; // milliseconds before trying again
}

/**
 * Error Response
 */
export interface TelematicsErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}
