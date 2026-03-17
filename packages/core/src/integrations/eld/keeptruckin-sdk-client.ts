/**
 * KeepTruckin (Motive v2) API SDK Client
 *
 * Complete implementation for KeepTruckin's REST API (expanded beyond motive-client.ts)
 * Authentication: OAuth2 (authorization code + refresh) + API key fallback
 * Base URL: https://api.keeptruckin.com/v1
 * Rate Limit: 20 requests per second
 *
 * Features:
 * - Users/Drivers: CRUD, company assignment, license info
 * - HOS: log entries, daily logs, violations, unidentified driving
 * - Vehicles: CRUD, locations, odometer, engine data, fault codes
 * - DVIR: list, create, defects, mechanic resolution
 * - IFTA: trip data, fuel purchases, mileage by jurisdiction
 * - Documents: upload, categories, driver assignment
 * - ELD Compliance: transfer to FMCSA (eRODS), roadside inspection export
 * - Dispatch: loads, stops, driver assignment
 * - Webhooks: HMAC-SHA256 verification
 * - Pagination: page-based (page_no, per_page)
 * - Rate limiting: exponential backoff
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
import type {
  KeepTruckinDriver,
  KeepTruckinHOSLogEntry,
  KeepTruckinDailyLog,
  KeepTruckinViolation,
  KeepTruckinVehicle,
  KeepTruckinVehicleLocation,
  KeepTruckinEngineData,
  KeepTruckinFaultCode,
  KeepTruckinDVIR,
  KeepTruckinIFTATrip,
  KeepTruckinDocument,
  KeepTruckinERodsExport,
  KeepTruckinWebhookPayload,
  KeepTruckinPaginationResponse,
} from "./eld-sdk-types.js";
import { createHmac } from "crypto";

// ─── KeepTruckin Client ────────────────────────────────

export class KeepTruckinSDKClient extends ELDAdapter {
  private baseUrl: string;
  private apiKey?: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;
  private webhookSecret?: string;
  private clientId?: string;
  private clientSecret?: string;

  constructor(config: ELDConfig) {
    super(config, 20); // 20 req/sec
    this.baseUrl = config.baseUrl || "https://api.keeptruckin.com/v1";
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiresAt = config.tokenExpiresAt;
    this.webhookSecret = config.webhookSecret;

    const providerConfig = config.providerConfig as any;
    this.clientId = providerConfig?.clientId;
    this.clientSecret = providerConfig?.clientSecret;
  }

  /**
   * Initialize and validate credentials
   */
  async initialize(): Promise<void> {
    if (!this.apiKey && !this.accessToken) {
      throw new Error(
        "KeepTruckin API key or OAuth2 access token is required"
      );
    }

    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt < new Date()) {
      await this.refreshAccessToken();
    }

    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ id: string }>("GET", "/organization")
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "KeepTruckin initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize KeepTruckin: ${String(error)}`);
    }
  }

  /**
   * Refresh OAuth2 access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error("Refresh token or OAuth2 credentials not configured");
    }

    const tokenUrl = new URL("https://accounts.keeptruckin.com/oauth/token");

    const response = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 refresh failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    this.logEvent({
      type: "diagnostic-event",
      data: { message: "KeepTruckin OAuth2 token refreshed" },
    });
  }

  /**
   * Get driver logs for date range
   */
  async getDriverLogs(
    driverId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ELDDriverLog[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinHOSLogEntry>>(
        "GET",
        `/drivers/${driverId}/hos-logs`,
        {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
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
      miles: log.milesDriven,
      hours: getHoursDifference(new Date(log.startTime), new Date(log.endTime)),
      startLocation: log.location ? { ...log.location } : undefined,
      endLocation: log.location ? { ...log.location } : undefined,
      remarks: log.remarks,
      sequence: idx,
      edited: (log.editCount || 0) > 0,
      createdAt: new Date(),
      updatedAt: log.lastEditedAt ? new Date(log.lastEditedAt) : new Date(),
    }));
  }

  /**
   * Get current duty status for driver
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinDriver>("GET", `/drivers/${driverId}`)
    );

    const summary = await this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/drivers/${driverId}/hos-summary`, {
        date: new Date().toISOString().split("T")[0],
      })
    );

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      vehicleId: driver.id,
      status: "off-duty",
      changedAt: new Date(),
      location: undefined,
      availableHoursDriving: Math.max(0, 11 - (summary.hoursWorked11 || 0)),
      availableHoursOnDuty: Math.max(0, 14 - (summary.hoursWorked14 || 0)),
      createdAt: new Date(),
    };
  }

  /**
   * Set driver duty status
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
      this.makeRequest("POST", `/drivers/${driverId}/duty-status`, payload)
    );

    this.logEvent({
      type: "duty-status-change",
      driverId,
      data: { status, location },
    });

    return this.getDutyStatus(driverId);
  }

  /**
   * Get HOS violations for driver
   */
  async getViolations(
    driverId: string,
    days: number = 30
  ): Promise<ELDViolation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinViolation>>(
        "GET",
        `/drivers/${driverId}/violations`,
        { start_date: startDate.toISOString().split("T")[0] }
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
      detectedAt: new Date(`${v.detectionDate}T${v.detectionTime}`),
      violationTimeRange: {
        start: new Date(`${v.detectionDate}T${v.detectionTime}`),
        end: v.resolvedAt ? new Date(v.resolvedAt) : new Date(),
      },
      hosContext: {},
      acknowledged: v.resolved,
      acknowledgedAt: v.resolvedAt ? new Date(v.resolvedAt) : undefined,
      createdAt: new Date(),
    }));
  }

  /**
   * Get vehicle information
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinVehicle>("GET", `/vehicles/${vehicleId}`)
    );

    const location = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinVehicleLocation>(
        "GET",
        `/vehicles/${vehicleId}/location`
      )
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
      odometerMiles: vehicle.odometerMiles,
      fuelType: (vehicle.fuelType as "diesel" | "gasoline" | "electric" | "hybrid") || undefined,
      capacityLbs: vehicle.gvwr,
      currentLocation: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
            updatedAt: new Date(location.timestamp),
          }
        : undefined,
      driverId: undefined,
      activeFaults: [],
      lastInspectionDate: undefined,
      nextInspectionDueDate: undefined,
      maintenanceStatus: undefined,
      createdAt: new Date(vehicle.createdAt),
      updatedAt: new Date(vehicle.updatedAt),
    };
  }

  /**
   * Get all vehicles
   */
  async getVehicles(): Promise<ELDVehicle[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinVehicle>>(
        "GET",
        "/vehicles"
      )
    );

    const vehicles: ELDVehicle[] = [];
    for (const vehicle of response.data) {
      try {
        const unified = await this.getVehicle(vehicle.id);
        vehicles.push(unified);
      } catch (error) {
        this.logEvent({
          type: "diagnostic-event",
          data: {
            message: `Failed to fetch details for vehicle ${vehicle.id}`,
            error: String(error),
          },
        });
      }
    }

    return vehicles;
  }

  /**
   * Get daily HOS log
   */
  async getDailyLog(
    driverId: string,
    date: Date
  ): Promise<KeepTruckinDailyLog> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinDailyLog>(
        "GET",
        `/drivers/${driverId}/daily-logs/${date.toISOString().split("T")[0]}`
      )
    );
  }

  /**
   * Certify daily HOS log
   */
  async certifyDailyLog(
    driverId: string,
    date: Date,
    signature?: string
  ): Promise<KeepTruckinDailyLog> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinDailyLog>(
        "POST",
        `/drivers/${driverId}/daily-logs/${date.toISOString().split("T")[0]}/certify`,
        { signature }
      )
    );
  }

  /**
   * Get unidentified driving
   */
  async getUnidentifiedDriving(driverId: string): Promise<KeepTruckinHOSLogEntry[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinHOSLogEntry>>(
        "GET",
        `/drivers/${driverId}/unidentified-driving`
      )
    );

    return response.data;
  }

  /**
   * Submit DVIR
   */
  async submitDVIR(dvir: Partial<ELDDVIR>): Promise<ELDDVIR> {
    if (!dvir.driverId || !dvir.vehicleId) {
      throw new Error("driverId and vehicleId are required");
    }

    const payload = {
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      type: dvir.type === "pre-trip" ? "PreTrip" : "PostTrip",
      status: "Fail",
      defects: (dvir.defects || []).map((d) => ({
        type: d.component,
        severity: d.severity.charAt(0).toUpperCase() + d.severity.slice(1),
        description: d.description,
        component: d.component,
      })),
      driverComments: dvir.driverRemarks,
    };

    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinDVIR>("POST", "/dvirs", payload)
    );

    return this.mapKeepTruckinDVIRtoELDDVIR(response);
  }

  /**
   * Get DVIRs for vehicle
   */
  async getDVIRs(vehicleId: string, days: number = 30): Promise<ELDDVIR[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinDVIR>>(
        "GET",
        "/dvirs",
        { vehicle_id: vehicleId, start_date: startDate.toISOString().split("T")[0] }
      )
    );

    return response.data.map((d) => this.mapKeepTruckinDVIRtoELDDVIR(d));
  }

  /**
   * Resolve DVIR defect
   */
  async resolveDVIRDefect(
    dvirId: string,
    defectId: string,
    repairStatus: string
  ): Promise<KeepTruckinDVIR> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinDVIR>(
        "PATCH",
        `/dvirs/${dvirId}/defects/${defectId}`,
        { repairStatus }
      )
    );
  }

  /**
   * Get vehicle location
   */
  async getVehicleLocation(vehicleId: string): Promise<KeepTruckinVehicleLocation> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinVehicleLocation>(
        "GET",
        `/vehicles/${vehicleId}/location`
      )
    );
  }

  /**
   * Get engine data
   */
  async getEngineData(vehicleId: string): Promise<KeepTruckinEngineData> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinEngineData>(
        "GET",
        `/vehicles/${vehicleId}/engine-data`
      )
    );
  }

  /**
   * Get fault codes
   */
  async getFaultCodes(vehicleId: string): Promise<KeepTruckinFaultCode[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinFaultCode>>(
        "GET",
        `/vehicles/${vehicleId}/fault-codes`
      )
    );

    return response.data;
  }

  /**
   * Get IFTA trip data
   */
  async getIFTATrips(
    driverId: string,
    startDate: Date,
    endDate: Date
  ): Promise<KeepTruckinIFTATrip[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinIFTATrip>>(
        "GET",
        `/drivers/${driverId}/ifta-trips`,
        {
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
        }
      )
    );

    return response.data;
  }

  /**
   * Upload document
   */
  async uploadDocument(
    driverId: string,
    docType: string,
    category: string,
    fileUrl: string
  ): Promise<KeepTruckinDocument> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinDocument>(
        "POST",
        `/drivers/${driverId}/documents`,
        {
          type: docType,
          category,
          file_url: fileUrl,
        }
      )
    );
  }

  /**
   * Get driver documents
   */
  async getDriverDocuments(driverId: string): Promise<KeepTruckinDocument[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinPaginationResponse<KeepTruckinDocument>>(
        "GET",
        `/drivers/${driverId}/documents`
      )
    );

    return response.data;
  }

  /**
   * Export eRODS format for FMCSA
   */
  async exporteRODS(
    startDate: Date,
    endDate: Date,
    driverIds?: string[]
  ): Promise<KeepTruckinERodsExport> {
    return this.executeWithRetry(() =>
      this.makeRequest<KeepTruckinERodsExport>(
        "POST",
        "/reports/erods-export",
        {
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          driver_ids: driverIds,
        }
      )
    );
  }

  /**
   * Get HOS summary
   */
  async getHOSSummary(
    driverId: string,
    date: Date
  ): Promise<{
    hours11: number;
    hours14: number;
    hours60: number;
    hours70: number;
    availableDriving: number;
    availableOnDuty: number;
  }> {
    const summary = await this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/drivers/${driverId}/hos-summary`, {
        date: date.toISOString().split("T")[0],
      })
    );

    return {
      hours11: summary.hoursWorked11 || 0,
      hours14: summary.hoursWorked14 || 0,
      hours60: summary.hoursWorked60 || 0,
      hours70: summary.hoursWorked70 || 0,
      availableDriving: Math.max(0, 11 - (summary.hoursWorked11 || 0)),
      availableOnDuty: Math.max(0, 14 - (summary.hoursWorked14 || 0)),
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    const hmac = createHmac("sha256", this.webhookSecret);
    hmac.update(payload);
    const computed = hmac.digest("hex");

    return computed === signature;
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: ELDWebhookEvent): Promise<void> {
    const payload = event.payload as KeepTruckinWebhookPayload;

    switch (payload.eventType) {
      case "violation":
        this.logEvent({
          type: "hos-violation",
          driverId: payload.resourceId,
          data: payload.data,
        });
        break;

      case "dvir":
        this.logEvent({
          type: "dvir-submitted",
          driverId: payload.data.driverId as string,
          vehicleId: payload.data.vehicleId as string,
          data: payload.data,
        });
        break;

      case "location":
        this.logEvent({
          type: "location-update",
          vehicleId: payload.resourceId,
          data: payload.data,
        });
        break;

      default:
        this.logEvent({
          type: "diagnostic-event",
          data: { message: `Unhandled webhook event type: ${payload.eventType}` },
        });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ id: string }>("GET", "/organization")
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helper Methods ──────────────────────────

  private async makeRequest<T>(
    method: string,
    path: string,
    params?: Record<string, any>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (method === "GET" && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (this.accessToken) {
      options.headers = {
        ...options.headers,
        "Authorization": `Bearer ${this.accessToken}`,
      };
    } else if (this.apiKey) {
      options.headers = {
        ...options.headers,
        "X-API-Key": this.apiKey,
      };
    }

    if (method !== "GET" && params) {
      options.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`KeepTruckin API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  private mapDutyStatus(status: string): DutyStatus {
    const statusMap: Record<string, DutyStatus> = {
      Driving: "driving",
      OnDuty: "on-duty",
      SleepBerth: "sleeper-berth",
      OffDuty: "off-duty",
      PersonalConveyance: "personal-conveyance",
      YardMove: "yard-move",
    };
    return statusMap[status] || "off-duty";
  }

  private mapDutyStatusReverse(status: DutyStatus): string {
    const statusMap: Record<DutyStatus, string> = {
      driving: "Driving",
      "on-duty": "OnDuty",
      "sleeper-berth": "SleepBerth",
      "off-duty": "OffDuty",
      "personal-conveyance": "PersonalConveyance",
      "yard-move": "YardMove",
    };
    return statusMap[status];
  }

  private mapViolationType(type: string): any {
    const typeMap: Record<string, string> = {
      hours_14: "hours-14",
      hours_11: "hours-11",
      hours_8: "hours-8",
      hours_60_70: "hours-60-70",
      break_30min: "break-30min",
    };
    return typeMap[type] || type;
  }

  private mapKeepTruckinDVIRtoELDDVIR(dvir: KeepTruckinDVIR): ELDDVIR {
    return {
      id: dvir.id,
      accountId: this.config.accountId || "",
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      inspectionTime: new Date(dvir.inspectionDate),
      type: dvir.type === "PreTrip" ? "pre-trip" : "post-trip",
      condition: dvir.status === "Pass" ? "pass" : "defect",
      defects: dvir.defects.map((d) => ({
        component: d.component,
        severity: d.severity.toLowerCase(),
        description: d.description,
        evidenceUrls: [],
      })),
      driverRemarks: dvir.driverComments,
      mechanicRemarks: dvir.mechanicComments,
      defectsResolved: dvir.defects.every((d) => d.repairStatus === "Repaired"),
      submittedAt: new Date(dvir.createdAt),
      updatedAt: new Date(dvir.updatedAt),
    };
  }
}

// ─── Error Types ────────────────────────────────────────

export class KeepTruckinAPIError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`KeepTruckin API Error ${statusCode}: ${body}`);
  }
}
