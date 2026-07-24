/**
 * Motive ELD API Client
 *
 * Implements ELDAdapterInterface for Motive (formerly KeepTruckin) integration.
 * Authentication: API key (header: Authorization: Bearer {apiKey})
 * API Base: https://api.motive.com/v1
 * Rate Limit: 10 requests per second
 *
 * Motive-specific features:
 * - Real-time driver location tracking
 * - HOS summaries and compliance insights
 * - DVIR management and digital signature
 * - Fault codes and vehicle diagnostics
 * - IFTA report generation
 * - Multi-vehicle fleet support
 * - Webhook events for status changes and violations
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

// ─── Motive API Types ───────────────────────────────────────

interface MotiveDriver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseClass?: string;
  certifications?: string[];
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
  };
  currentDutyStatus?: string;
  hosStatus?: {
    hoursWorked11: number;
    hoursWorked14: number;
    hoursWorked60: number;
    hoursWorked70: number;
    hoursAvailable: number;
    violations?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface MotiveVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  fuelType?: string;
  gvwr?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
  };
  currentDriver?: {
    id: string;
    name: string;
  };
  activeFaults?: Array<{
    code: string;
    description: string;
  }>;
  certificateExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

interface MotiveHosLog {
  id: string;
  driverId: string;
  vehicleId?: string;
  startTime: string;
  endTime: string;
  dutyStatus: string;
  miles?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  notes?: string;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MotiveViolation {
  id: string;
  driverId: string;
  type: string;
  description: string;
  severity: string;
  detectedAt: string;
  timeRange: {
    start: string;
    end: string;
  };
  acknowledged: boolean;
  acknowledgedAt?: string;
}

interface MotiveDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  inspectionTime: string;
  type: "pre_trip" | "post_trip";
  condition: "pass" | "defect" | "not_safe";
  defects?: Array<{
    component: string;
    severity: string;
    description: string;
  }>;
  driverRemarks?: string;
  submittedAt: string;
  updatedAt: string;
}

interface MotiveHosResponse {
  hoursWorked11: number;
  hoursWorked14: number;
  hoursWorked60: number;
  hoursWorked70: number;
  hoursAvailable: number;
}

// ─── Motive Client ──────────────────────────────────────────

export class MotiveELDClient extends ELDAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ELDConfig) {
    super(config, 10); // 10 requests per second
    this.baseUrl = config.baseUrl || "https://api.motive.com/v1";
    this.apiKey = config.apiKey || "";
  }

  /**
   * Initialize and validate API key.
   */
  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Motive API key is required");
    }

    // Test API connectivity
    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ account: { id: string } }>("GET", "/account"),
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Motive initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Motive: ${String(error)}`);
    }
  }

  /**
   * Get driver logs for a date range.
   */
  async getDriverLogs(
    driverId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ELDDriverLog[]> {
    const logs = await this.executeWithRetry(() =>
      this.makeRequest<{ logs: MotiveHosLog[] }>(
        "GET",
        `/drivers/${driverId}/hos-logs`,
        {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      ),
    );

    return logs.logs.map((log, idx) => ({
      id: log.id,
      accountId: this.config.accountId || "",
      driverId: log.driverId,
      vehicleId: log.vehicleId || "",
      startTime: new Date(log.startTime),
      endTime: new Date(log.endTime),
      dutyStatus: this.mapDutyStatus(log.dutyStatus),
      miles: log.miles,
      hours: getHoursDifference(new Date(log.startTime), new Date(log.endTime)),
      startLocation: log.location ? { ...log.location } : undefined,
      endLocation: log.location ? { ...log.location } : undefined,
      remarks: log.notes,
      sequence: idx,
      edited: log.edited,
      createdAt: new Date(log.createdAt),
      updatedAt: new Date(log.updatedAt),
    }));
  }

  /**
   * Get current duty status for driver.
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<MotiveDriver>("GET", `/drivers/${driverId}`),
    );

    const hosSummary = await this.executeWithRetry(() =>
      this.makeRequest<MotiveHosResponse>(
        "GET",
        `/drivers/${driverId}/hos-summary`,
        { date: new Date().toISOString().split("T")[0] },
      ),
    );

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      vehicleId: driver.id,
      status: this.mapDutyStatus(driver.currentDutyStatus || "off-duty"),
      changedAt: new Date(),
      location: driver.currentLocation
        ? {
            latitude: driver.currentLocation.latitude,
            longitude: driver.currentLocation.longitude,
            address: driver.currentLocation.address,
          }
        : undefined,
      availableHoursDriving: Math.max(0, 11 - hosSummary.hoursWorked11),
      availableHoursOnDuty: Math.max(0, 14 - hosSummary.hoursWorked14),
      createdAt: new Date(),
    };
  }

  /**
   * Set driver duty status.
   */
  async setDutyStatus(
    driverId: string,
    status: DutyStatus,
    location?: { latitude: number; longitude: number },
  ): Promise<ELDDutyStatus> {
    const payload = {
      dutyStatus: this.mapDutyStatusReverse(status),
      location,
      timestamp: new Date().toISOString(),
    };

    await this.executeWithRetry(() =>
      this.makeRequest("POST", `/drivers/${driverId}/duty-status`, payload),
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
    days: number = 30,
  ): Promise<ELDViolation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const violations = await this.executeWithRetry(() =>
      this.makeRequest<{ violations: MotiveViolation[] }>(
        "GET",
        `/drivers/${driverId}/violations`,
        { startDate: startDate.toISOString() },
      ),
    );

    return violations.violations.map((v) => ({
      id: v.id,
      accountId: this.config.accountId || "",
      driverId: v.driverId,
      vehicleId: "",
      violationType: this.mapViolationType(v.type),
      description: v.description,
      severity: (v.severity as "warning" | "error" | "critical") || "warning",
      detectedAt: new Date(v.detectedAt),
      violationTimeRange: {
        start: new Date(v.timeRange.start),
        end: new Date(v.timeRange.end),
      },
      hosContext: {},
      acknowledged: v.acknowledged,
      acknowledgedAt: v.acknowledgedAt ? new Date(v.acknowledgedAt) : undefined,
      createdAt: new Date(),
    }));
  }

  /**
   * Get vehicle information.
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<MotiveVehicle>("GET", `/vehicles/${vehicleId}`),
    );

    return {
      id: vehicle.id,
      accountId: this.config.accountId || "",
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      group: undefined,
      odometerMiles: vehicle.odometer,
      fuelType:
        (vehicle.fuelType as "diesel" | "gasoline" | "electric" | "hybrid") ||
        undefined,
      capacityLbs: vehicle.gvwr,
      currentLocation: vehicle.currentLocation
        ? {
            latitude: vehicle.currentLocation.latitude,
            longitude: vehicle.currentLocation.longitude,
            address: vehicle.currentLocation.address,
            updatedAt: new Date(vehicle.currentLocation.timestamp),
          }
        : undefined,
      driverId: vehicle.currentDriver?.id,
      activeFaults: vehicle.activeFaults?.map((f) => f.code) || [],
      lastInspectionDate: undefined,
      nextInspectionDueDate: vehicle.certificateExpiry
        ? new Date(vehicle.certificateExpiry)
        : undefined,
      maintenanceStatus: "good",
      createdAt: new Date(vehicle.createdAt),
      updatedAt: new Date(vehicle.updatedAt),
    };
  }

  /**
   * Get all vehicles.
   */
  async getVehicles(): Promise<ELDVehicle[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ vehicles: MotiveVehicle[] }>("GET", "/vehicles"),
    );

    return Promise.all(response.vehicles.map((v) => this.getVehicle(v.id)));
  }

  /**
   * Submit DVIR.
   */
  async submitDVIR(dvir: Partial<ELDDVIR>): Promise<ELDDVIR> {
    const payload = {
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      type: dvir.type === "pre-trip" ? "pre_trip" : "post_trip",
      condition: dvir.condition,
      defects: dvir.defects?.map((d) => ({
        component: d.component,
        severity: d.severity,
        description: d.description,
      })),
      driverRemarks: dvir.driverRemarks,
    };

    const result = await this.executeWithRetry(() =>
      this.makeRequest<MotiveDVIR>(
        "POST",
        `/vehicles/${dvir.vehicleId}/dvir`,
        payload,
      ),
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
      inspectionTime: new Date(result.inspectionTime),
      type: result.type === "pre_trip" ? "pre-trip" : "post-trip",
      condition: (result.condition as "pass" | "defect" | "not-safe") || "pass",
      defects:
        result.defects?.map((d) => ({
          component: d.component,
          severity: (d.severity as "minor" | "major" | "critical") || "minor",
          description: d.description,
        })) || [],
      driverRemarks: result.driverRemarks,
      submittedAt: new Date(result.submittedAt),
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
      this.makeRequest<{ dvirs: MotiveDVIR[] }>(
        "GET",
        `/vehicles/${vehicleId}/dvirs`,
        { startDate: startDate.toISOString() },
      ),
    );

    return response.dvirs.map((d) => ({
      id: d.id,
      accountId: this.config.accountId || "",
      driverId: d.driverId,
      vehicleId: d.vehicleId,
      inspectionTime: new Date(d.inspectionTime),
      type: d.type === "pre_trip" ? "pre-trip" : "post-trip",
      condition: (d.condition as "pass" | "defect" | "not-safe") || "pass",
      defects:
        d.defects?.map((df) => ({
          component: df.component,
          severity: (df.severity as "minor" | "major" | "critical") || "minor",
          description: df.description,
        })) || [],
      driverRemarks: d.driverRemarks,
      submittedAt: new Date(d.submittedAt),
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
      case "hos-violation":
        this.logEvent({
          type: "hos-violation",
          driverId: (event.payload.driverId as string) || undefined,
          data: event.payload,
        });
        break;
      case "dvir-submitted":
        this.logEvent({
          type: "dvir-submitted",
          driverId: (event.payload.driverId as string) || undefined,
          vehicleId: (event.payload.vehicleId as string) || undefined,
          data: event.payload,
        });
        break;
      default:
        this.logEvent({
          type: event.type,
          driverId: (event.payload.driverId as string) || undefined,
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
        this.makeRequest<{ account: { id: string } }>("GET", "/account"),
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helper Methods ────────────────────────────────

  /**
   * Make HTTP request to Motive API.
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    params?: Record<string, unknown> | null,
    body?: unknown,
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
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Motive API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Map Motive duty status to standard format.
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
   * Map standard duty status to Motive format.
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
      "11_hour": "hours-11",
      "14_hour": "hours-14",
      "8_hour": "hours-8",
      "60_70_hour": "hours-60-70",
      "30_min_break": "break-30min",
    };
    return map[type] || "hours-14";
  }
}
