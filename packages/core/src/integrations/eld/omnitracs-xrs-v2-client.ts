/**
 * Omnitracs XRS (Roadnet) ELD API v2 Client
 *
 * Implements ELDAdapterInterface for Omnitracs XRS v2 integration.
 * Extended beyond basic omnitracs-eld-client.ts with dispatch and compliance features.
 * Authentication: API key + OAuth2 hybrid
 * API Base: https://api.omnitracs.com/v2/xrs
 * Rate Limit: 300 requests per minute
 *
 * Features:
 * - Extended driver management with HOS availability and detailed violations
 * - Vehicle tracking with GPS and fuel usage analytics
 * - HOS logs with edit request tracking and unidentified driving detection
 * - DVIR with mechanic repair workflow
 * - Dispatch integration with route plans, stops, and ETA tracking
 * - Performance analytics (speeding, idle time, hard events, MPG)
 * - Compliance reporting (FMCSA transfer ready, roadside export)
 * - Driver scorecards and vehicle utilization metrics
 * - Webhook support for status changes, geofence, and violations
 * - Cursor-based pagination for large datasets
 * - Retry logic with exponential backoff
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

// ─── Omnitracs XRS API Types ────────────────────────────────

interface XrsDriver {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  hosAvailable?: {
    driving: number;
    onDuty: number;
  };
  violations?: Array<{
    type: string;
    count: number;
  }>;
  currentStatus?: {
    status: string;
    vehicle?: {
      id: string;
      name: string;
    };
    timestamp: string;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface XrsVehicle {
  id: string;
  name: string;
  unitNumber?: string;
  vin: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  fuelType?: string;
  status: "active" | "maintenance" | "idle";
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    speed?: number;
  };
  fuelUsage?: number;
  diagnostics?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface XrsLogEntry {
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
  editable: boolean;
  editRequests?: Array<{
    id: string;
    status: "pending" | "approved" | "rejected";
  }>;
  unidentifiedDriving?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface XrsViolation {
  id: string;
  driverId: string;
  vehicleId?: string;
  type: string;
  description: string;
  severity: "warning" | "error" | "critical";
  timestamp: string;
  acknowledged?: boolean;
}

interface XrsDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  timestamp: string;
  type: "pre-trip" | "post-trip";
  condition: "pass" | "defect" | "not-safe";
  defects: Array<{
    id: string;
    component: string;
    severity: "minor" | "major" | "critical";
    description: string;
    repairStatus?: "pending" | "in-progress" | "completed";
  }>;
  driverSignature?: string;
  mechanicAssigned?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface XrsRoute {
  id: string;
  name: string;
  driverId: string;
  vehicleId: string;
  stops: Array<{
    id: string;
    address: string;
    latitude: number;
    longitude: number;
    eta?: string;
    arrivedAt?: string;
    completed?: boolean;
  }>;
  status: "pending" | "in-progress" | "completed";
  createdAt: string;
  updatedAt: string;
}

interface XrsPerformance {
  driverId: string;
  vehicleId: string;
  period: string;
  speeding: {
    count: number;
    duration: number;
  };
  idleTime: number;
  hardEvents?: {
    braking: number;
    acceleration: number;
    cornering: number;
  };
  fuelEfficiency: number;
  mpg?: number;
}

interface XrsScorecard {
  driverId: string;
  period: string;
  overallScore: number;
  categories: Record<string, number>;
  violations: XrsViolation[];
}

interface XrsComplianceReport {
  driverId: string;
  period: string;
  fmcsaTransferReady: boolean;
  roadsideExportUrl?: string;
  violations: XrsViolation[];
  certifications: Array<{
    type: string;
    expiryDate?: string;
  }>;
}

interface XrsGeofenceEvent {
  eventId: string;
  vehicleId: string;
  geofenceId: string;
  eventType: "entry" | "exit";
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

// ─── Omnitracs XRS Client ────────────────────────────────────

export class OmnitrocsXrsV2Client extends ELDAdapter {
  private baseUrl: string;
  private apiKey: string;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: ELDConfig) {
    super(config, 5); // 300 req/min = 5 req/sec
    this.baseUrl = config.baseUrl || "https://api.omnitracs.com/v2/xrs";
    this.apiKey = config.apiKey || "";
    this.accessToken = config.accessToken;
  }

  /**
   * Initialize and validate connection.
   */
  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Omnitracs XRS API key is required");
    }

    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ organization: { id: string } }>("GET", "/organization")
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Omnitracs XRS v2 initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Omnitracs XRS: ${String(error)}`);
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
      this.makeRequest<{ logs: XrsLogEntry[]; cursor?: string }>(
        "GET",
        `/drivers/${driverId}/logs`,
        {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          limit: 100,
        }
      )
    );

    return response.logs.map((log, idx) => ({
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
      remarks: log.unidentifiedDriving ? "Unidentified driving detected" : undefined,
      sequence: idx,
      edited: log.editRequests ? log.editRequests.length > 0 : false,
      createdAt: new Date(log.createdAt),
      updatedAt: new Date(log.updatedAt),
    }));
  }

  /**
   * Get current duty status for driver.
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<XrsDriver>("GET", `/drivers/${driverId}`)
    );

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      status: driver.currentStatus ? this.mapDutyStatus(driver.currentStatus.status) : "off-duty",
      changedAt: driver.currentStatus ? new Date(driver.currentStatus.timestamp) : new Date(),
      availableHoursDriving: driver.hosAvailable?.driving ?? 11,
      availableHoursOnDuty: driver.hosAvailable?.onDuty ?? 14,
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
    };

    await this.executeWithRetry(() =>
      this.makeRequest("POST", `/drivers/${driverId}/duty-status`, null, payload)
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
  async getViolations(driverId: string, days: number = 30): Promise<ELDViolation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ violations: XrsViolation[] }>(
        "GET",
        `/drivers/${driverId}/violations`,
        {
          startDate: startDate.toISOString(),
          limit: 1000,
        }
      )
    );

    return response.violations.map((v) => ({
      id: v.id,
      accountId: this.config.accountId || "",
      driverId: v.driverId,
      vehicleId: v.vehicleId || "",
      violationType: this.mapViolationType(v.type),
      description: v.description,
      severity: v.severity,
      detectedAt: new Date(v.timestamp),
      violationTimeRange: {
        start: new Date(v.timestamp),
        end: new Date(v.timestamp),
      },
      hosContext: {},
      acknowledged: v.acknowledged || false,
      createdAt: new Date(),
    }));
  }

  /**
   * Get vehicle information.
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<XrsVehicle>("GET", `/vehicles/${vehicleId}`)
    );

    return {
      id: vehicle.id,
      accountId: this.config.accountId || "",
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      odometerMiles: vehicle.odometer,
      fuelType: (vehicle.fuelType as "diesel" | "gasoline" | "electric" | "hybrid") || undefined,
      currentLocation: vehicle.currentLocation
        ? {
            latitude: vehicle.currentLocation.latitude,
            longitude: vehicle.currentLocation.longitude,
            updatedAt: new Date(vehicle.currentLocation.timestamp),
          }
        : undefined,
      activeFaults: vehicle.diagnostics || [],
      maintenanceStatus: (vehicle.status === "maintenance" ? "pending" : "good") as any,
      createdAt: new Date(vehicle.createdAt),
      updatedAt: new Date(vehicle.updatedAt),
    };
  }

  /**
   * Get all vehicles with cursor-based pagination.
   */
  async getVehicles(): Promise<ELDVehicle[]> {
    const vehicles: ELDVehicle[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.executeWithRetry(() =>
        this.makeRequest<{ vehicles: XrsVehicle[]; cursor?: string }>(
          "GET",
          "/vehicles",
          {
            limit: 100,
            ...(cursor && { cursor }),
          }
        )
      );

      for (const v of response.vehicles) {
        vehicles.push(await this.getVehicle(v.id));
      }

      cursor = response.cursor;
      hasMore = !!cursor;
    }

    return vehicles;
  }

  /**
   * Submit DVIR.
   */
  async submitDVIR(dvir: Partial<ELDDVIR>): Promise<ELDDVIR> {
    const payload = {
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      type: dvir.type,
      condition: dvir.condition,
      defects: dvir.defects || [],
      driverSignature: dvir.driverRemarks,
    };

    const result = await this.executeWithRetry(() =>
      this.makeRequest<XrsDVIR>(
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
      type: result.type,
      condition: result.condition,
      defects: result.defects,
      driverRemarks: result.driverSignature,
      mechanicRemarks: undefined,
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
      this.makeRequest<{ dvirs: XrsDVIR[] }>(
        "GET",
        `/vehicles/${vehicleId}/dvirs`,
        {
          startDate: startDate.toISOString(),
          limit: 1000,
        }
      )
    );

    return response.dvirs.map((d) => ({
      id: d.id,
      accountId: this.config.accountId || "",
      driverId: d.driverId,
      vehicleId: d.vehicleId,
      inspectionTime: new Date(d.timestamp),
      type: d.type,
      condition: d.condition,
      defects: d.defects,
      driverRemarks: d.driverSignature,
      submittedAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
    }));
  }

  /**
   * Get dispatch routes for driver.
   */
  async getRoutes(driverId: string): Promise<XrsRoute[]> {
    return this.executeWithRetry(() =>
      this.makeRequest<XrsRoute[]>("GET", `/drivers/${driverId}/routes`, {
        status: "in-progress,pending",
      })
    );
  }

  /**
   * Get performance analytics for driver.
   */
  async getPerformance(driverId: string, period: string = "monthly"): Promise<XrsPerformance> {
    return this.executeWithRetry(() =>
      this.makeRequest<XrsPerformance>("GET", `/drivers/${driverId}/performance`, {
        period,
      })
    );
  }

  /**
   * Get driver scorecard.
   */
  async getScorecard(driverId: string, period: string = "monthly"): Promise<XrsScorecard> {
    return this.executeWithRetry(() =>
      this.makeRequest<XrsScorecard>("GET", `/drivers/${driverId}/scorecard`, {
        period,
      })
    );
  }

  /**
   * Get vehicle utilization report.
   */
  async getVehicleUtilization(vehicleId: string, startDate: Date, endDate: Date): Promise<any> {
    return this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/vehicles/${vehicleId}/utilization`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
    );
  }

  /**
   * Get compliance report (FMCSA transfer ready, roadside export).
   */
  async getComplianceReport(driverId: string, period: string = "monthly"): Promise<XrsComplianceReport> {
    return this.executeWithRetry(() =>
      this.makeRequest<XrsComplianceReport>(
        "GET",
        `/drivers/${driverId}/compliance-report`,
        {
          period,
        }
      )
    );
  }

  /**
   * Generate FMCSA transfer file (eRODS).
   */
  async generateFmcsaTransfer(driverId: string): Promise<string> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ fileUrl: string }>(
        "POST",
        `/drivers/${driverId}/fmcsa-transfer`,
        null,
        {}
      )
    );
    return response.fileUrl;
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
        this.makeRequest<{ organization: { id: string } }>("GET", "/organization")
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helper Methods ────────────────────────────────

  /**
   * Make HTTP request to Omnitracs XRS API.
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Omnitracs XRS API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Map duty status to standard format.
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
  private mapViolationType(type: string): any {
    const map: Record<string, string> = {
      "11-hour": "hours-11",
      "14-hour": "hours-14",
      "8-hour": "hours-8",
      "60-hour": "hours-60-70",
      "70-hour": "hours-60-70",
      "30-minute-break": "break-30min",
    };
    return map[type] || "hours-14";
  }
}
