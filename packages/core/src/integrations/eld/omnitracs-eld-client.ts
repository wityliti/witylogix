/**
 * Omnitracs ELD API Client
 *
 * Implements ELDAdapterInterface for Omnitracs Intelligent Vehicle Gateway integration.
 * Authentication: OAuth2 (access token)
 * API Base: https://api.omnitracs.com/v2
 * Rate Limit: 5 requests per second
 *
 * Omnitracs-specific features:
 * - Full HOS compliance with exemption support
 * - Dispatch integration with ELD status awareness
 * - Critical event video requests (SafetyLink)
 * - Driver communication via message queuing
 * - Multi-fleet management
 * - Customizable alerting rules
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

// ─── Omnitracs API Types ────────────────────────────────────

interface OmnitracDriver {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  certifications?: string[];
  currentStatus?: {
    status: string;
    timestamp: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
  hos?: {
    hoursWorked11: number;
    hoursWorked14: number;
    hoursWorked60: number;
    hoursWorked70: number;
    availableHours: number;
  };
  exemptions?: Array<{
    type: string;
    startDate: string;
    endDate: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface OmnitracVehicle {
  id: string;
  unitNumber: string;
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
  driver?: {
    id: string;
    name: string;
  };
  status?: {
    ignitionOn: boolean;
    moving: boolean;
    speed?: number;
  };
  events?: Array<{
    type: string;
    code: string;
    description: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface OmnitracHosRecord {
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
  annotations?: string[];
  exemptions?: string[];
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface OmnitracViolation {
  id: string;
  driverId: string;
  code: string;
  description: string;
  severity: string;
  detectedAt: string;
  acknowledgedAt?: string;
  exempted: boolean;
}

interface OmnitracDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  timestamp: string;
  type: "pretrip" | "posttrip";
  status: string;
  items: Array<{
    name: string;
    status: string;
    notes?: string;
  }>;
  driverSignature?: string;
  mechanicReview?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Omnitracs Client ───────────────────────────────────────

export class OmnitrocsELDClient extends ELDAdapter {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: ELDConfig) {
    super(config, 5); // 5 requests per second
    this.baseUrl = config.baseUrl || "https://api.omnitracs.com/v2";
    this.accessToken = config.accessToken || "";
  }

  /**
   * Initialize and validate OAuth2 token.
   */
  async initialize(): Promise<void> {
    if (!this.accessToken) {
      throw new Error("Omnitracs OAuth2 token is required");
    }

    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ organization: { id: string } }>(
          "GET",
          "/organization"
        )
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Omnitracs initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Omnitracs: ${String(error)}`);
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
      this.makeRequest<{ records: OmnitracHosRecord[] }>(
        "GET",
        `/drivers/${driverId}/hos-records`,
        {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        }
      )
    );

    return response.records.map((record, idx) => ({
      id: record.id,
      accountId: this.config.accountId || "",
      driverId: record.driverId,
      vehicleId: record.vehicleId || "",
      startTime: new Date(record.startTime),
      endTime: new Date(record.endTime),
      dutyStatus: this.mapDutyStatus(record.status),
      miles: record.miles,
      hours: getHoursDifference(new Date(record.startTime), new Date(record.endTime)),
      startLocation: record.location ? { ...record.location } : undefined,
      endLocation: record.location ? { ...record.location } : undefined,
      remarks: record.annotations?.join("; "),
      sequence: idx,
      edited: !!record.editedAt,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }));
  }

  /**
   * Get current duty status for driver.
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<OmnitracDriver>("GET", `/drivers/${driverId}`)
    );

    const currentStatus = driver.currentStatus || {
      status: "off_duty",
      timestamp: new Date().toISOString(),
    };

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      status: this.mapDutyStatus(currentStatus.status),
      changedAt: new Date(currentStatus.timestamp),
      location: currentStatus.location
        ? {
            latitude: currentStatus.location.latitude,
            longitude: currentStatus.location.longitude,
            address: currentStatus.location.address,
          }
        : undefined,
      availableHoursDriving: Math.max(0, 11 - (driver.hos?.hoursWorked11 || 0)),
      availableHoursOnDuty: Math.max(0, 14 - (driver.hos?.hoursWorked14 || 0)),
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
      timestamp: new Date().toISOString(),
      location,
    };

    await this.executeWithRetry(() =>
      this.makeRequest(
        "POST",
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
      this.makeRequest<{ violations: OmnitracViolation[] }>(
        "GET",
        `/drivers/${driverId}/violations`,
        { startDate: startDate.toISOString() }
      )
    );

    return response.violations.map((v) => ({
      id: v.id,
      accountId: this.config.accountId || "",
      driverId: v.driverId,
      vehicleId: "",
      violationType: this.mapViolationType(v.code),
      description: v.description,
      severity: (v.severity as "warning" | "error" | "critical") || "warning",
      detectedAt: new Date(v.detectedAt),
      violationTimeRange: {
        start: new Date(v.detectedAt),
        end: new Date(v.detectedAt),
      },
      hosContext: {},
      acknowledged: !!v.acknowledgedAt,
      acknowledgedAt: v.acknowledgedAt ? new Date(v.acknowledgedAt) : undefined,
      createdAt: new Date(),
    }));
  }

  /**
   * Get vehicle information.
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<OmnitracVehicle>("GET", `/vehicles/${vehicleId}`)
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
      fuelType: (vehicle.fuelType as "diesel" | "gasoline" | "electric" | "hybrid") || undefined,
      capacityLbs: vehicle.gvwr,
      currentLocation: vehicle.currentLocation
        ? {
            latitude: vehicle.currentLocation.latitude,
            longitude: vehicle.currentLocation.longitude,
            address: vehicle.currentLocation.address,
            updatedAt: new Date(vehicle.currentLocation.timestamp),
          }
        : undefined,
      driverId: vehicle.driver?.id,
      activeFaults: vehicle.events
        ?.filter((e) => e.type === "fault")
        .map((e) => e.code) || [],
      lastInspectionDate: undefined,
      nextInspectionDueDate: undefined,
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
      this.makeRequest<{ vehicles: OmnitracVehicle[] }>("GET", "/vehicles")
    );

    return Promise.all(
      response.vehicles.map((v) => this.getVehicle(v.id))
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
      items: dvir.defects?.map((d) => ({
        name: d.component,
        status: d.severity,
        notes: d.description,
      })) || [],
      driverSignature: dvir.driverRemarks,
    };

    const result = await this.executeWithRetry(() =>
      this.makeRequest<OmnitracDVIR>(
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
      defects: result.items.map((item) => ({
        component: item.name,
        severity: (item.status as "minor" | "major" | "critical") || "minor",
        description: item.notes || "",
      })),
      driverRemarks: result.driverSignature,
      mechanicRemarks: result.mechanicReview,
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
      this.makeRequest<{ dvirs: OmnitracDVIR[] }>(
        "GET",
        `/vehicles/${vehicleId}/dvirs`,
        { startDate: startDate.toISOString() }
      )
    );

    return response.dvirs.map((d) => ({
      id: d.id,
      accountId: this.config.accountId || "",
      driverId: d.driverId,
      vehicleId: d.vehicleId,
      inspectionTime: new Date(d.timestamp),
      type: d.type === "pretrip" ? "pre-trip" : "post-trip",
      condition: (d.status as "pass" | "defect" | "not-safe") || "pass",
      defects: d.items.map((item) => ({
        component: item.name,
        severity: (item.status as "minor" | "major" | "critical") || "minor",
        description: item.notes || "",
      })),
      driverRemarks: d.driverSignature,
      mechanicRemarks: d.mechanicReview,
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
      case "hos-violation":
        this.logEvent({
          type: "hos-violation",
          driverId: (event.payload.driverId as string) || undefined,
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
        this.makeRequest<{ organization: { id: string } }>(
          "GET",
          "/organization"
        )
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helper Methods ────────────────────────────────

  /**
   * Make HTTP request to Omnitracs API.
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
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Omnitracs API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Map Omnitracs duty status to standard format.
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
   * Map standard duty status to Omnitracs format.
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
  private mapViolationType(code: string): any {
    const map: Record<string, string> = {
      VIO_11H: "hours-11",
      VIO_14H: "hours-14",
      VIO_8H: "hours-8",
      VIO_60_70H: "hours-60-70",
      VIO_30M: "break-30min",
    };
    return map[code] || "hours-14";
  }
}
