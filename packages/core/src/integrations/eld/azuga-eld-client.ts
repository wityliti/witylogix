/**
 * Azuga Fleet API Client
 *
 * Implements ELDAdapterInterface for Azuga ELD/Fleet management integration.
 * Authentication: API key
 * API Base: https://api.azuga.com/api/v2
 * Rate Limit: 8 requests per second
 *
 * Azuga-specific features:
 * - Driver trip data with geolocation
 * - ELD log aggregation with trip linking
 * - HOS status and exemption tracking
 * - Vehicle GPS and fuel card integration
 * - Driver scorecards with behavioral metrics
 * - Geofence-based alerts
 * - Maintenance reminders and service history
 * - Driver rewards/recognition system
 */

import { ELDAdapter, getHoursDifference } from "./eld-adapter.js";
import type {
  ELDDriverLog,
  ELDDutyStatus,
  ELDViolation,
  ELDVehicle,
  ELDDVIR,
  ELDConfig,
  ELDWebhookEvent,
  DutyStatus,
} from "./types.js";

// ─── Azuga API Types ────────────────────────────────────────

interface AzugaDriver {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  hosStatus?: {
    hoursWorked11: number;
    hoursWorked14: number;
    hoursWorked60: number;
    hoursWorked70: number;
    availableHours: number;
    violations?: string[];
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
  };
  currentStatus?: string;
  scorecard?: {
    overallScore: number;
    safetyScore: number;
    fuelScore: number;
    behaviourScore: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface AzugaVehicle {
  id: string;
  registrationNumber: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  fuelType?: string;
  gvwrWeightLbs?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
  };
  assignedDriver?: {
    id: string;
    name: string;
  };
  status?: {
    ignitionOn: boolean;
    idle: boolean;
    speed?: number;
    fuelLevel?: number;
  };
  maintenanceStatus?: {
    nextServiceDue?: string;
    lastServiceDate?: string;
    issues?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface AzugaTrip {
  id: string;
  driverId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  startOdometer: number;
  endOdometer: number;
  distance: number;
  averageSpeed?: number;
  maxSpeed?: number;
  duration: number;
  startLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  fuelUsed?: number;
  score?: number;
  incidents?: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

interface AzugaEldLog {
  id: string;
  driverId: string;
  vehicleId?: string;
  startTime: string;
  endTime: string;
  status: string;
  miles?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  notes?: string;
  tripId?: string;
  createdAt: string;
  updatedAt: string;
}

interface AzugaViolation {
  id: string;
  driverId: string;
  type: string;
  description: string;
  severity: string;
  detectedAt: string;
  createdAt: string;
}

interface AzugaDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  timestamp: string;
  type: string;
  status: string;
  checklist: Array<{
    item: string;
    status: string;
    comments?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ─── Azuga Client ──────────────────────────────────────────

export class AzugaELDClient extends ELDAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ELDConfig) {
    super(config, 8); // 8 requests per second
    this.baseUrl = config.baseUrl || "https://api.azuga.com/api/v2";
    this.apiKey = config.apiKey || "";
  }

  /**
   * Initialize and validate API key.
   */
  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Azuga API key is required");
    }

    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ status: string }>("GET", "/me")
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Azuga initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Azuga: ${String(error)}`);
    }
  }

  /**
   * Get driver logs for a date range.
   */
  async getDriverLogs(
    driverId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ELDDriverLog[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: AzugaEldLog[] }>(
        "GET",
        `/drivers/${driverId}/eld-logs`,
        {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        }
      )
    );

    return response.data.map((log, idx) => ({
      id: log.id,
      accountId: this.config.accountId || "",
      driverId: log.driverId,
      vehicleId: log.vehicleId || "",
      startTime: new Date(log.startTime),
      endTime: new Date(log.endTime),
      dutyStatus: this.mapDutyStatus(log.status),
      miles: log.miles,
      hours: getHoursDifference(new Date(log.startTime), new Date(log.endTime)),
      startLocation: log.location ? { ...log.location } : undefined,
      endLocation: log.location ? { ...log.location } : undefined,
      remarks: log.notes,
      sequence: idx,
      edited: false,
      createdAt: new Date(log.createdAt),
      updatedAt: new Date(log.updatedAt),
    }));
  }

  /**
   * Get current duty status for driver.
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<AzugaDriver>("GET", `/drivers/${driverId}`)
    );

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      status: this.mapDutyStatus(driver.currentStatus || "off_duty"),
      changedAt: new Date(),
      location: driver.currentLocation
        ? {
            latitude: driver.currentLocation.latitude,
            longitude: driver.currentLocation.longitude,
            address: driver.currentLocation.address,
          }
        : undefined,
      availableHoursDriving: Math.max(0, 11 - (driver.hosStatus?.hoursWorked11 || 0)),
      availableHoursOnDuty: Math.max(0, 14 - (driver.hosStatus?.hoursWorked14 || 0)),
      createdAt: new Date(),
    };
  }

  /**
   * Set driver duty status.
   */
  async setDutyStatus(
    driverId: string,
    status: DutyStatus,
    location?: { latitude: number; longitude: number }
  ): Promise<ELDDutyStatus> {
    const payload = {
      status: this.mapDutyStatusReverse(status),
      location,
      timestamp: new Date().toISOString(),
    };

    await this.executeWithRetry(() =>
      this.makeRequest(
        "PUT",
        `/drivers/${driverId}/duty-status`,
        null,
        payload
      )
    );

    this.logEvent({
      type: "duty-status-change",
      driverId,
      data: { status, location },
    });

    return this.getDutyStatus(driverId);
  }

  /**
   * Get HOS violations for driver.
   */
  async getViolations(
    driverId: string,
    days: number = 30
  ): Promise<ELDViolation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: AzugaViolation[] }>(
        "GET",
        `/drivers/${driverId}/violations`,
        { startDate: startDate.toISOString() }
      )
    );

    return response.data.map((v) => ({
      id: v.id,
      accountId: this.config.accountId || "",
      driverId: v.driverId,
      vehicleId: "",
      violationType: this.mapViolationType(v.type),
      description: v.description,
      severity: (v.severity as "warning" | "error" | "critical") || "warning",
      detectedAt: new Date(v.detectedAt),
      violationTimeRange: {
        start: new Date(v.detectedAt),
        end: new Date(v.detectedAt),
      },
      hosContext: {},
      acknowledged: false,
      createdAt: new Date(v.createdAt),
    }));
  }

  /**
   * Get vehicle information.
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<AzugaVehicle>("GET", `/vehicles/${vehicleId}`)
    );

    return {
      id: vehicle.id,
      accountId: this.config.accountId || "",
      vin: vehicle.vin,
      licensePlate: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      group: undefined,
      odometerMiles: vehicle.odometer,
      fuelType: (vehicle.fuelType as "diesel" | "gasoline" | "electric" | "hybrid") || undefined,
      capacityLbs: vehicle.gvwrWeightLbs,
      currentLocation: vehicle.currentLocation
        ? {
            latitude: vehicle.currentLocation.latitude,
            longitude: vehicle.currentLocation.longitude,
            address: vehicle.currentLocation.address,
            updatedAt: new Date(vehicle.currentLocation.timestamp),
          }
        : undefined,
      driverId: vehicle.assignedDriver?.id,
      activeFaults: vehicle.maintenanceStatus?.issues || [],
      lastInspectionDate: vehicle.maintenanceStatus?.lastServiceDate
        ? new Date(vehicle.maintenanceStatus.lastServiceDate)
        : undefined,
      nextInspectionDueDate: vehicle.maintenanceStatus?.nextServiceDue
        ? new Date(vehicle.maintenanceStatus.nextServiceDue)
        : undefined,
      maintenanceStatus:
        (vehicle.maintenanceStatus?.issues?.length || 0) > 0 ? "pending" : "good",
      createdAt: new Date(vehicle.createdAt),
      updatedAt: new Date(vehicle.updatedAt),
    };
  }

  /**
   * Get all vehicles.
   */
  async getVehicles(): Promise<ELDVehicle[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: AzugaVehicle[] }>("GET", "/vehicles")
    );

    return Promise.all(
      response.data.map((v) => this.getVehicle(v.id))
    );
  }

  /**
   * Submit DVIR.
   */
  async submitDVIR(dvir: Partial<ELDDVIR>): Promise<ELDDVIR> {
    const payload = {
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      type: dvir.type === "pre-trip" ? "pretrip" : "posttrip",
      status: dvir.condition,
      checklist: dvir.defects?.map((d) => ({
        item: d.component,
        status: d.severity,
        comments: d.description,
      })) || [],
    };

    const result = await this.executeWithRetry(() =>
      this.makeRequest<AzugaDVIR>(
        "POST",
        `/vehicles/${dvir.vehicleId}/dvir`,
        null,
        payload
      )
    );

    this.logEvent({
      type: "dvir-submitted",
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      data: { dvirId: result.id },
    });

    return {
      id: result.id,
      accountId: this.config.accountId || "",
      driverId: result.driverId,
      vehicleId: result.vehicleId,
      inspectionTime: new Date(result.timestamp),
      type: result.type === "pretrip" ? "pre-trip" : "post-trip",
      condition: (result.status as "pass" | "defect" | "not-safe") || "pass",
      defects: result.checklist.map((item) => ({
        component: item.item,
        severity: (item.status as "minor" | "major" | "critical") || "minor",
        description: item.comments || "",
      })),
      submittedAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  /**
   * Get DVIRs for vehicle.
   */
  async getDVIRs(vehicleId: string, days: number = 30): Promise<ELDDVIR[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: AzugaDVIR[] }>(
        "GET",
        `/vehicles/${vehicleId}/dvirs`,
        { startDate: startDate.toISOString() }
      )
    );

    return response.data.map((d) => ({
      id: d.id,
      accountId: this.config.accountId || "",
      driverId: d.driverId,
      vehicleId: d.vehicleId,
      inspectionTime: new Date(d.timestamp),
      type: d.type === "pretrip" ? "pre-trip" : "post-trip",
      condition: (d.status as "pass" | "defect" | "not-safe") || "pass",
      defects: d.checklist.map((item) => ({
        component: item.item,
        severity: (item.status as "minor" | "major" | "critical") || "minor",
        description: item.comments || "",
      })),
      submittedAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
    }));
  }

  /**
   * Handle webhook event.
   */
  async handleWebhook(event: ELDWebhookEvent): Promise<void> {
    switch (event.type) {
      case "duty-status-change":
        this.logEvent({
          type: "duty-status-change",
          driverId: (event.payload.driverId as string) || undefined,
          data: event.payload,
        });
        break;
      case "location-update":
        this.logEvent({
          type: "location-update",
          driverId: (event.payload.driverId as string) || undefined,
          vehicleId: (event.payload.vehicleId as string) || undefined,
          data: event.payload,
        });
        break;
      case "diagnostic-event":
        this.logEvent({
          type: "diagnostic-event",
          vehicleId: (event.payload.vehicleId as string) || undefined,
          data: event.payload,
        });
        break;
      default:
        this.logEvent({
          type: event.type,
          data: event.payload,
        });
    }
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ status: string }>("GET", "/me")
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helper Methods ────────────────────────────────

  /**
   * Make HTTP request to Azuga API.
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    params?: Record<string, unknown> | null,
    body?: unknown
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params && method === "GET") {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Azuga API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Map Azuga duty status to standard format.
   */
  private mapDutyStatus(status: string): DutyStatus {
    const map: Record<string, DutyStatus> = {
      driving: "driving",
      on_duty: "on-duty",
      sleeper_berth: "sleeper-berth",
      off_duty: "off-duty",
      personal_conveyance: "personal-conveyance",
      yard_move: "yard-move",
    };
    return map[status] || "off-duty";
  }

  /**
   * Map standard duty status to Azuga format.
   */
  private mapDutyStatusReverse(status: DutyStatus): string {
    const map: Record<DutyStatus, string> = {
      driving: "driving",
      "on-duty": "on_duty",
      "sleeper-berth": "sleeper_berth",
      "off-duty": "off_duty",
      "personal-conveyance": "personal_conveyance",
      "yard-move": "yard_move",
    };
    return map[status];
  }

  /**
   * Map violation type.
   */
  private mapViolationType(type: string): any {
    const map: Record<string, string> = {
      violation_11h: "hours-11",
      violation_14h: "hours-14",
      violation_8h: "hours-8",
      violation_60_70h: "hours-60-70",
      violation_break: "break-30min",
    };
    return map[type] || "hours-14";
  }
}
