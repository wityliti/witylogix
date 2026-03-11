/**
 * Fleet Management Types
 *
 * Core type definitions for telematics integration, vehicle tracking,
 * diagnostics, and driver behavior monitoring.
 */

// ─── TELEMATICS PROVIDERS ─────────────────────────────────────────

export type TelematicsProvider = "SAMSARA" | "GEOTAB" | "VERIZON" | "MOTIVE";

export interface ProviderCredential {
  id: string;
  fleetId: string;
  provider: TelematicsProvider;
  apiKeyHash: string;
  secretKeyHash?: string;
  encryptedPrivateData?: string;
  status: "ACTIVE" | "ROTATED" | "REVOKED";
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

// ─── VEHICLE IDENTIFICATION & REGISTRATION ────────────────────────

export interface VehicleRegistration {
  fleetId: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  engineType: "GASOLINE" | "DIESEL" | "EV" | "HYBRID";
  capacity: number;
  primaryProvider: TelematicsProvider;
}

export type VehicleStatus = "ACTIVE" | "IDLE" | "OFFLINE" | "MAINTENANCE";

export interface Vehicle {
  id: string;
  fleetId: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  engineType: "GASOLINE" | "DIESEL" | "EV" | "HYBRID";
  providerVehicleId?: string;
  primaryProvider?: TelematicsProvider;
  status: VehicleStatus;
  odometer: number;
  engineHours: number;
  fuelLevel: number;
  battery: number;
  driverId?: string;
  capacity: number;
  isActive: boolean;
  lastPosition?: VehiclePosition;
  lastSyncAt?: Date;
  nextMaintenanceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── VEHICLE POSITION & LOCATION ──────────────────────────────────

export interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  altitude?: number;
  timestamp: Date;
}

export interface VehicleLocation {
  latitude: number;
  longitude: number;
  heading: number;
  accuracy: number;
}

// ─── VEHICLE STATUS & METRICS ─────────────────────────────────────

export interface VehicleStatus {
  vehicleId: string;
  status: "ACTIVE" | "IDLE" | "OFFLINE" | "MAINTENANCE";
  engineRunning: boolean;
  lastPosition: VehiclePosition;
  battery: number;
  odometer: number;
  hours: number;
  faultCodes: DiagnosticCode[];
  timestamp: Date;
}

export interface DiagnosticCode {
  code: string;
  description: string;
  system: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

// ─── VEHICLE FUEL ─────────────────────────────────────────────────

export interface VehicleFuel {
  vehicleId: string;
  fuelLevel: number;
  fuelVolume: number;
  fuelType: "GASOLINE" | "DIESEL" | "ELECTRIC" | "HYBRID";
  fuelEconomy: number;
  range: number;
  timestamp: Date;
}

export interface FuelConsumption {
  id: string;
  vehicleId: string;
  fuelLevel: number;
  fuelVolume: number;
  fuelEconomy: number;
  estimatedRange: number;
  recordedAt: Date;
  createdAt: Date;
}

// ─── VEHICLE DIAGNOSTICS ──────────────────────────────────────────

export interface VehicleDiagnostics {
  vehicleId: string;
  faultCodes: DiagnosticCode[];
  severity: "INFO" | "WARNING" | "CRITICAL";
  description: string;
  affectedSystems: string[];
  recommendedAction: string;
  firstSeenAt: Date;
  clearedAt?: Date;
}

export interface VehicleDiagnostic {
  id: string;
  vehicleId: string;
  faultCode: string;
  faultDescription: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  affectedSystems: string[];
  recommendedAction?: string;
  firstSeenAt: Date;
  clearedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DRIVER BEHAVIOR ───────────────────────────────────────────────

export type DriverBehaviorEventType =
  | "SPEEDING"
  | "HARSH_BRAKE"
  | "HARSH_ACCEL"
  | "COLLISION"
  | "DISTRACTION"
  | "HARD_TURN"
  | "SEATBELT_VIOLATION";

export interface DriverBehaviorEvent {
  id: string;
  vehicleId: string;
  driverId?: string;
  eventType: DriverBehaviorEventType;
  severity: 1 | 2 | 3 | 4 | 5;
  location: {
    latitude: number;
    longitude: number;
  };
  speed: number;
  description: string;
  durationMs?: number;
  timestamp: Date;
  createdAt: Date;
}

export interface DriverBehaviorStats {
  vehicleId: string;
  driverId?: string;
  totalEvents: number;
  speedingEvents: number;
  harshBrakingEvents: number;
  harshAccelEvents: number;
  collisionEvents: number;
  distractionEvents: number;
  avgSeverity: number;
  riskScore: number;
  improvementTrend: number;
  periodStart: Date;
  periodEnd: Date;
}

// ─── MAINTENANCE & ALERTS ─────────────────────────────────────────

export interface MaintenanceAlert {
  id: string;
  vehicleId: string;
  alertType: string;
  dueDate: Date;
  severity: "INFO" | "WARNING" | "CRITICAL";
  estimatedCost?: number;
  notes?: string;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceSchedule {
  vehicleId: string;
  alerts: MaintenanceAlert[];
  nextDueDate?: Date;
  overdueMaintenance: MaintenanceAlert[];
}

// ─── FLEET OVERVIEW & HEALTH ──────────────────────────────────────

export interface FleetOverview {
  fleetId: string;
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  offlineVehicles: number;
  maintenanceVehicles: number;
  healthScore: FleetHealthScore;
  topAlerts: FleetAlert[];
  recentEvents: FleetEvent[];
  averageFuelEconomy: number;
  totalIdleHours: number;
  criticalAlertCount: number;
}

export interface FleetHealthScore {
  overallScore: number;
  fuelEfficiency: number;
  driverSafety: number;
  maintenanceStatus: number;
  utilizationRate: number;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  lastUpdated: Date;
}

export interface FleetHealthMetric {
  id: string;
  fleetId: string;
  overallScore: number;
  fuelEfficiency: number;
  driverSafety: number;
  maintenanceStatus: number;
  utilizationRate: number;
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  offlineVehicles: number;
  maintenanceVehicles: number;
  avgFuelEconomy: number;
  totalIdleHours: number;
  criticalAlerts: number;
  recordedAt: Date;
  createdAt: Date;
}

// ─── FLEET EVENTS & ALERTS ────────────────────────────────────────

export type FleetEventType =
  | "VEHICLE_ONLINE"
  | "VEHICLE_OFFLINE"
  | "ENGINE_START"
  | "ENGINE_STOP"
  | "HARSH_ACCELERATION"
  | "HARSH_BRAKING"
  | "SPEEDING"
  | "COLLISION_DETECTED"
  | "GEOFENCE_ENTRY"
  | "GEOFENCE_EXIT"
  | "MAINTENANCE_ALERT"
  | "FAULT_CODE_DETECTED"
  | "LOW_FUEL"
  | "FUEL_THEFT"
  | "IDLING_ALERT"
  | "SEATBELT_VIOLATION"
  | "DISTRACTED_DRIVING";

export interface FleetEvent {
  id: string;
  fleetId: string;
  vehicleId: string;
  eventType: FleetEventType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  data: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export interface FleetAlert {
  id: string;
  fleetId: string;
  vehicleId: string;
  title: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  category: "SAFETY" | "MAINTENANCE" | "FUEL" | "OPERATIONS";
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

// ─── ADAPTER INTERFACE ─────────────────────────────────────────────

export type EventCallback = (event: FleetEvent) => Promise<void>;

export interface DateRange {
  start: Date;
  end: Date;
}

export interface VehicleIdentifier {
  vehicleId: string;
  providerVehicleId: string;
}

export interface ITelematicsAdapter {
  providerName: TelematicsProvider;
  apiVersion: string;

  // Vehicle lifecycle
  registerVehicle(vehicleInfo: VehicleRegistration): Promise<VehicleIdentifier>;
  deregisterVehicle(vehicleId: string): Promise<void>;

  // Real-time data
  getVehiclePosition(vehicleId: string): Promise<VehiclePosition>;
  getVehicleStatus(vehicleId: string): Promise<VehicleStatus>;
  getVehicleFuel(vehicleId: string): Promise<VehicleFuel>;
  getVehicleDiagnostics(vehicleId: string): Promise<VehicleDiagnostics>;
  getFleetVehicles(): Promise<Vehicle[]>;

  // Events and alerts
  subscribeToEvents(callback: EventCallback): void;
  unsubscribeFromEvents(): void;

  // Driver behavior
  getDriverBehavior(vehicleId: string, dateRange: DateRange): Promise<DriverBehaviorEvent[]>;

  // Polling state
  getLastSyncTime(vehicleId: string): Promise<Date | null>;
  setLastSyncTime(vehicleId: string, timestamp: Date): Promise<void>;
}

// ─── REQUEST/RESPONSE TYPES ───────────────────────────────────────

export interface RegisterVehicleRequest {
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  engineType: "GASOLINE" | "DIESEL" | "EV" | "HYBRID";
  capacity: number;
  primaryProvider: TelematicsProvider;
  driverId?: string;
}

export interface UpdateVehicleRequest {
  driverId?: string;
  primaryProvider?: TelematicsProvider;
  capacity?: number;
  isActive?: boolean;
  nextMaintenanceDate?: Date;
}

export interface VehicleListQueryParams {
  status?: VehicleStatus;
  page?: number;
  limit?: number;
  search?: string;
  provider?: TelematicsProvider;
  isActive?: boolean;
}

export interface PaginatedVehicles {
  data: Vehicle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── ERROR HANDLING ───────────────────────────────────────────────

export class FleetError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "FleetError";
  }
}

export class VehicleNotFoundError extends FleetError {
  constructor(vehicleId: string) {
    super(`Vehicle not found: ${vehicleId}`, "VEHICLE_NOT_FOUND", 404);
  }
}

export class ProviderIntegrationError extends FleetError {
  constructor(provider: string, message: string) {
    super(
      `Provider integration error (${provider}): ${message}`,
      "PROVIDER_ERROR",
      502,
      { provider },
    );
  }
}

export class RateLimitError extends FleetError {
  constructor(provider: string, resetAt: Date) {
    super(
      `Rate limit exceeded for ${provider}`,
      "RATE_LIMIT_EXCEEDED",
      429,
      { resetAt },
    );
  }
}
