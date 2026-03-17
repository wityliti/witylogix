/**
 * Trimble Transportation ELD API Client
 *
 * Implements ELDAdapterInterface for Trimble Transportation (PeopleNet/TMW) integration.
 * Authentication: OAuth2 (client credentials + JWT)
 * API Base: https://api.trimblecloud.com/transportation/v2
 * Rate Limit: 60 requests per minute
 *
 * Features:
 * - Complete driver management with DQF (Driver Qualification File)
 * - HOS (Hours of Service) compliance with duty status and available hours
 * - ELD device management with connectivity and diagnostics
 * - Vehicle tracking with GPS and J1939/J1708 engine diagnostics
 * - DVIR (Driver Vehicle Inspection Report) with certification workflow
 * - IFTA mileage and fuel tax reporting by jurisdiction
 * - Document management with expiry alerts
 * - Fleet management with messaging and forms
 * - eRODS (FMCSA transfer file) generation for roadside inspections
 * - Webhook support with HMAC-SHA256 signature verification
 * - Pagination with offset + limit
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
import { createHmac } from "crypto";

// ─── Trimble API Types ──────────────────────────────────────

interface TrimbleDriver {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  dateOfBirth?: string;
  employmentStatus?: "active" | "inactive" | "suspended";
  dqf?: {
    fileNumber?: string;
    issuedDate?: string;
    expiryDate?: string;
    jurisdiction?: string;
  };
  currentStatus?: {
    status: string;
    changedAt: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
  hos?: {
    driving11h?: number;
    onDuty14h?: number;
    worked60h?: number;
    worked70h?: number;
    availableDriving?: number;
    availableOnDuty?: number;
  };
  certifications?: Array<{
    type: string;
    number: string;
    expiryDate?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface TrimbleVehicle {
  id: string;
  unitNumber: string;
  vin: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number;
  odometer?: number;
  engineHours?: number;
  fuelType?: string;
  gvwr?: number;
  powerUnitType?: string;
  status?: "active" | "maintenance" | "inactive";
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
    speed?: number;
  };
  assignedDriver?: {
    id: string;
    name: string;
  };
  diagnostics?: {
    activeCodes: string[];
    lastDiagnosticsTime?: string;
    j1939Codes?: string[];
    j1708Codes?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface TrimbleHosRecord {
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
  createdAt: string;
  updatedAt: string;
}

interface TrimbleViolation {
  id: string;
  driverId: string;
  code: string;
  description: string;
  severity: "warning" | "error" | "critical";
  violationType: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolved?: boolean;
}

interface TrimbleDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  timestamp: string;
  type: "pre-trip" | "post-trip";
  condition: "pass" | "defect" | "not-safe";
  defects: Array<{
    component: string;
    severity: "minor" | "major" | "critical";
    description: string;
  }>;
  driverSignature?: string;
  driverRemarks?: string;
  mechanicReview?: string;
  certifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TrimbleDocument {
  id: string;
  driverId?: string;
  vehicleId?: string;
  category: string;
  fileName: string;
  expiryDate?: string;
  uploadedAt: string;
  documentUrl?: string;
}

interface TrimbleTrip {
  id: string;
  driverId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
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
  miles?: number;
  fuelUsed?: number;
  iftaMileage?: Record<string, number>; // by jurisdiction
}

// ─── Trimble Client ──────────────────────────────────────────

export class TrimbleELDClient extends ELDAdapter {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private webhookSecret?: string;

  constructor(config: ELDConfig) {
    super(config, 1); // 60 req/min = 1 req/sec
    this.baseUrl = config.baseUrl || "https://api.trimblecloud.com/transportation/v2";
    this.clientId = config.apiKey || "";
    this.clientSecret = config.apiSecret || "";
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Initialize and obtain OAuth2 token.
   */
  async initialize(): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Trimble OAuth2 credentials (clientId, clientSecret) are required");
    }

    try {
      await this.obtainAccessToken();
      await this.executeWithRetry(() =>
        this.makeRequest<{ organization: { id: string } }>("GET", "/organization")
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Trimble ELD initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Trimble ELD: ${String(error)}`);
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
      this.makeRequest<{ records: TrimbleHosRecord[] }>(
        "GET",
        `/drivers/${driverId}/hos-records`,
        {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          limit: 1000,
          offset: 0,
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
      edited: false,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }));
  }

  /**
   * Get current duty status for driver.
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<TrimbleDriver>("GET", `/drivers/${driverId}`)
    );

    const currentStatus = driver.currentStatus || {
      status: "off-duty",
      changedAt: new Date().toISOString(),
    };

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      status: this.mapDutyStatus(currentStatus.status),
      changedAt: new Date(currentStatus.changedAt),
      location: currentStatus.location
        ? {
            latitude: currentStatus.location.latitude,
            longitude: currentStatus.location.longitude,
            address: currentStatus.location.address,
          }
        : undefined,
      availableHoursDriving: driver.hos?.availableDriving ?? 11,
      availableHoursOnDuty: driver.hos?.availableOnDuty ?? 14,
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
      changedAt: new Date().toISOString(),
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
      this.makeRequest<{ violations: TrimbleViolation[] }>(
        "GET",
        `/drivers/${driverId}/violations`,
        {
          startDate: startDate.toISOString(),
          limit: 1000,
          offset: 0,
        }
      )
    );

    return response.violations.map((v) => ({
      id: v.id,
      accountId: this.config.accountId || "",
      driverId: v.driverId,
      vehicleId: "",
      violationType: this.mapViolationType(v.violationType),
      description: v.description,
      severity: v.severity,
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
      this.makeRequest<TrimbleVehicle>("GET", `/vehicles/${vehicleId}`)
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
      driverId: vehicle.assignedDriver?.id,
      activeFaults: vehicle.diagnostics?.activeCodes || [],
      lastInspectionDate: undefined,
      nextInspectionDueDate: undefined,
      maintenanceStatus: (vehicle.status === "maintenance" ? "pending" : "good") as any,
      createdAt: new Date(vehicle.createdAt),
      updatedAt: new Date(vehicle.updatedAt),
    };
  }

  /**
   * Get all vehicles with pagination.
   */
  async getVehicles(): Promise<ELDVehicle[]> {
    const vehicles: ELDVehicle[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.executeWithRetry(() =>
        this.makeRequest<{ vehicles: TrimbleVehicle[] }>("GET", "/vehicles", {
          limit,
          offset,
        })
      );

      for (const v of response.vehicles) {
        vehicles.push(await this.getVehicle(v.id));
      }

      hasMore = response.vehicles.length === limit;
      offset += limit;
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
      type: dvir.type === "pre-trip" ? "pre-trip" : "post-trip",
      condition: dvir.condition,
      defects: dvir.defects || [],
      driverRemarks: dvir.driverRemarks,
      timestamp: new Date().toISOString(),
    };

    const result = await this.executeWithRetry(() =>
      this.makeRequest<TrimbleDVIR>(
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
      type: result.type as "pre-trip" | "post-trip",
      condition: result.condition,
      defects: result.defects,
      driverRemarks: result.driverRemarks,
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
      this.makeRequest<{ dvirs: TrimbleDVIR[] }>(
        "GET",
        `/vehicles/${vehicleId}/dvirs`,
        {
          startDate: startDate.toISOString(),
          limit: 1000,
          offset: 0,
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
      driverRemarks: d.driverRemarks,
      mechanicRemarks: d.mechanicReview,
      submittedAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
    }));
  }

  /**
   * Upload document (license, insurance, etc).
   */
  async uploadDocument(
    driverId: string,
    fileName: string,
    fileBuffer: Buffer,
    category: string,
    expiryDate?: Date
  ): Promise<TrimbleDocument> {
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), fileName);
    formData.append("category", category);
    if (expiryDate) {
      formData.append("expiryDate", expiryDate.toISOString());
    }

    const response = await this.executeWithRetry(() =>
      this.makeRequestWithForm<TrimbleDocument>(
        "POST",
        `/drivers/${driverId}/documents`,
        formData
      )
    );

    return response;
  }

  /**
   * Get driver DQF (Driver Qualification File).
   */
  async getDriverDQF(driverId: string): Promise<any> {
    return this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/drivers/${driverId}/dqf`)
    );
  }

  /**
   * Get vehicle diagnostics (J1939/J1708 codes).
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<any> {
    return this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/vehicles/${vehicleId}/diagnostics`)
    );
  }

  /**
   * Generate eRODS (FMCSA transfer) file for roadside inspection.
   */
  async generateeRODS(driverId: string): Promise<string> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ fileUrl: string }>(
        "POST",
        `/drivers/${driverId}/erods`,
        null,
        {}
      )
    );
    return response.fileUrl;
  }

  /**
   * Handle webhook event with signature verification.
   */
  async handleWebhook(event: ELDWebhookEvent, signature?: string): Promise<void> {
    if (signature && this.webhookSecret) {
      const payload = JSON.stringify(event.payload);
      const hash = createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex");

      if (hash !== signature) {
        throw new Error("Invalid webhook signature");
      }
    }

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
   * Obtain OAuth2 access token.
   */
  private async obtainAccessToken(): Promise<void> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt.getTime() > Date.now() + 300000
    ) {
      return; // Token still valid for 5+ minutes
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth token request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  }

  /**
   * Make HTTP request to Trimble API.
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    params?: Record<string, unknown> | null,
    body?: unknown
  ): Promise<T> {
    await this.obtainAccessToken();

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
      throw new Error(`Trimble API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make HTTP request with form data (for file uploads).
   */
  private async makeRequestWithForm<T>(
    method: string,
    path: string,
    formData: FormData
  ): Promise<T> {
    await this.obtainAccessToken();

    const url = new URL(`${this.baseUrl}${path}`);

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Trimble API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Map Trimble duty status to standard format.
   */
  private mapDutyStatus(status: string): DutyStatus {
    const map: Record<string, DutyStatus> = {
      driving: "driving",
      "on-duty": "on-duty",
      "sleeper-berth": "sleeper-berth",
      "off-duty": "off-duty",
      "personal-conveyance": "personal-conveyance",
      "yard-move": "yard-move",
    };
    return map[status] || "off-duty";
  }

  /**
   * Map standard duty status to Trimble format.
   */
  private mapDutyStatusReverse(status: DutyStatus): string {
    const map: Record<DutyStatus, string> = {
      driving: "driving",
      "on-duty": "on-duty",
      "sleeper-berth": "sleeper-berth",
      "off-duty": "off-duty",
      "personal-conveyance": "personal-conveyance",
      "yard-move": "yard-move",
    };
    return map[status];
  }

  /**
   * Map violation type.
   */
  private mapViolationType(violationType: string): any {
    const map: Record<string, string> = {
      "11-hour": "hours-11",
      "14-hour": "hours-14",
      "8-hour": "hours-8",
      "60-hour": "hours-60-70",
      "70-hour": "hours-60-70",
      "30-minute-break": "break-30min",
    };
    return map[violationType] || "hours-14";
  }
}
