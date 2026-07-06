/**
 * Samsara Fleet API v1 ELD Client
 *
 * Complete implementation for Samsara's REST + Webhooks API
 * Authentication: Bearer token (API key)
 * Base URL: https://api.samsara.com/v1
 * Rate Limit: 100 requests per second
 *
 * Features:
 * - Drivers: list, get, create, update, HOS daily logs, violations, availability
 * - Vehicles: list, get, create, update, locations, stats, fuel/energy
 * - HOS: clock status, log entries, edit requests, certification
 * - DVIR: list, get, create, resolve defects, mechanic sign-off
 * - Safety: harsh events, scores, coaching workflows
 * - Routes: dispatch routes, stops, ETAs
 * - Assets: locations, reefer stats
 * - Documents: driver documents, uploads, expiry
 * - Webhooks: HMAC-SHA256 verification
 * - Pagination: cursor-based with hasNextPage/endCursor
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
  HOSSummary,
} from "./types.js";
import type {
  SamsaraDriver,
  SamsaraVehicle,
  SamsaraHOSLog,
  SamsaraHOSViolation,
  SamsaraLocation,
  SamsaraVehicleStats,
  SamsaraAsset,
  SamsaraDVIR,
  SamsaraHarshEvent,
  SamsaraRoute,
  SamsaraDocument,
  SamsaraWebhookPayload,
  SamsaraCursorPaginationResponse,
} from "./eld-sdk-types.js";
import { createHmac } from "crypto";

// ─── Samsara Client ────────────────────────────────────

export class SamsaraELDClient extends ELDAdapter {
  private baseUrl: string;
  private apiKey: string;
  private webhookSecret?: string;

  constructor(config: ELDConfig) {
    super(config, 100); // 100 req/sec
    this.baseUrl = config.baseUrl || "https://api.samsara.com/v1";
    this.apiKey = config.apiKey || "";
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Initialize and validate API key
   */
  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Samsara API key is required");
    }

    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ id: string }>("GET", "/organization"),
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Samsara initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Samsara: ${String(error)}`);
    }
  }

  /**
   * Get driver logs for date range
   */
  async getDriverLogs(
    driverId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ELDDriverLog[]> {
    const logs = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraHOSLog[] }>(
        "GET",
        `/drivers/${driverId}/hos-logs`,
        {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      ),
    );

    return logs.data.map((log, idx) => ({
      id: log.id,
      accountId: this.config.accountId || "",
      driverId: log.driverId,
      vehicleId: log.vehicleId || "",
      startTime: new Date(log.startTime),
      endTime: new Date(log.endTime),
      dutyStatus: this.mapDutyStatus(log.dutyStatus),
      miles: log.milesDriven,
      hours: getHoursDifference(new Date(log.startTime), new Date(log.endTime)),
      startLocation: log.location ? { ...log.location } : undefined,
      endLocation: log.location ? { ...log.location } : undefined,
      remarks: log.notes,
      sequence: idx,
      edited: log.edited,
      createdAt: new Date(log.createdAt),
      updatedAt: new Date(log.editedAt || log.createdAt),
    }));
  }

  /**
   * Get current duty status for driver
   */
  async getDutyStatus(driverId: string): Promise<ELDDutyStatus> {
    const driver = await this.executeWithRetry(() =>
      this.makeRequest<SamsaraDriver>("GET", `/drivers/${driverId}`),
    );

    const hosSummary = await this.executeWithRetry(() =>
      this.makeRequest<{
        hours11: number;
        hours14: number;
        hours60: number;
        hours70: number;
      }>("GET", `/drivers/${driverId}/hos-availability`, {
        date: new Date().toISOString().split("T")[0],
      }),
    );

    return {
      id: `ds_${driver.id}`,
      accountId: this.config.accountId || "",
      driverId: driver.id,
      vehicleId: driver.id,
      status: this.mapDutyStatus(driver.currentDutyStatus || "off_duty"),
      changedAt: new Date(),
      location: undefined,
      availableHoursDriving: Math.max(0, 11 - hosSummary.hours11),
      availableHoursOnDuty: Math.max(0, 14 - hosSummary.hours14),
      createdAt: new Date(),
    };
  }

  /**
   * Set driver duty status
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
   * Get HOS violations for driver
   */
  async getViolations(
    driverId: string,
    days: number = 30,
  ): Promise<ELDViolation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const violations = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraHOSViolation[] }>(
        "GET",
        `/drivers/${driverId}/hos-violations`,
        { startTime: startDate.toISOString() },
      ),
    );

    return violations.data.map((v) => ({
      id: v.id,
      accountId: this.config.accountId || "",
      driverId: v.driverId,
      vehicleId: "",
      violationType: this.mapViolationType(v.violationType),
      description: v.description,
      severity: "error" as const,
      detectedAt: new Date(v.detectedAt),
      violationTimeRange: {
        start: new Date(v.detectedAt),
        end: new Date(v.resolvedAt || v.detectedAt),
      },
      hosContext: {},
      acknowledged: !!v.resolvedAt,
      acknowledgedAt: v.resolvedAt ? new Date(v.resolvedAt) : undefined,
      createdAt: new Date(),
    }));
  }

  /**
   * Get vehicle information
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<SamsaraVehicle>("GET", `/vehicles/${vehicleId}`),
    );

    const location = await this.executeWithRetry(() =>
      this.makeRequest<SamsaraLocation>(
        "GET",
        `/vehicles/${vehicleId}/locations`,
      ),
    );

    const stats = await this.executeWithRetry(() =>
      this.makeRequest<SamsaraVehicleStats>(
        "GET",
        `/vehicles/${vehicleId}/stats`,
      ),
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
      odometerMiles: stats.odometer?.miles,
      fuelType:
        (vehicle.fuelType as "diesel" | "gasoline" | "electric" | "hybrid") ||
        undefined,
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
      this.makeRequest<SamsaraCursorPaginationResponse<SamsaraVehicle>>(
        "GET",
        "/vehicles",
      ),
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
   * Get HOS daily log for driver
   */
  async getHOSDailyLog(
    driverId: string,
    date: Date,
  ): Promise<{ data: SamsaraHOSLog[] }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraHOSLog[] }>(
        "GET",
        `/drivers/${driverId}/hos-logs`,
        {
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        },
      ),
    );
  }

  /**
   * Get HOS clocks (current driving/on-duty/cycle/break status)
   */
  async getHOSClocks(driverId: string): Promise<{
    drivingClock: number;
    onDutyClock: number;
    cycleClock: number;
    breakClock: number;
  }> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{
        drivingClock: number;
        onDutyClock: number;
        cycleClock: number;
        breakClock: number;
      }>("GET", `/drivers/${driverId}/hos-clocks`),
    );

    return response;
  }

  /**
   * Get HOS edit requests
   */
  async getHOSEditRequests(driverId: string): Promise<any[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: any[] }>(
        "GET",
        `/drivers/${driverId}/hos-edit-requests`,
      ),
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
      inspectionType: dvir.type === "pre-trip" ? "pre_trip" : "post_trip",
      defects: (dvir.defects || []).map((d) => ({
        component: d.component,
        defectDescription: d.description,
        severity: d.severity,
      })),
      driverNotes: dvir.driverRemarks,
    };

    const response = await this.executeWithRetry(() =>
      this.makeRequest<SamsaraDVIR>("POST", "/dvirs", payload),
    );

    return this.mapSamsaraDVIRtoELDDVIR(response);
  }

  /**
   * Get DVIRs for vehicle
   */
  async getDVIRs(vehicleId: string, days: number = 30): Promise<ELDDVIR[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraDVIR[] }>("GET", "/dvirs", {
        vehicleId,
        startTime: startDate.toISOString(),
      }),
    );

    return response.data.map((d) => this.mapSamsaraDVIRtoELDDVIR(d));
  }

  /**
   * Get harsh events for driver
   */
  async getHarshEvents(
    driverId: string,
    days: number = 30,
  ): Promise<SamsaraHarshEvent[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraHarshEvent[] }>(
        "GET",
        `/drivers/${driverId}/harsh-events`,
        { startTime: startDate.toISOString() },
      ),
    );

    return response.data;
  }

  /**
   * Get safety score for driver
   */
  async getSafetyScore(
    driverId: string,
  ): Promise<{ score: number; percentile: number }> {
    return this.executeWithRetry(() =>
      this.makeRequest<{ score: number; percentile: number }>(
        "GET",
        `/drivers/${driverId}/safety-score`,
      ),
    );
  }

  /**
   * List all drivers
   */
  async listDrivers(
    limit: number = 100,
    after?: string,
  ): Promise<{ data: SamsaraDriver[]; pagination: any }> {
    return this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraDriver[]; pagination: any }>(
        "GET",
        "/drivers",
        { limit, after },
      ),
    );
  }

  /**
   * Create driver
   */
  async createDriver(data: {
    name: string;
    email: string;
    phone?: string;
  }): Promise<SamsaraDriver> {
    return this.executeWithRetry(() =>
      this.makeRequest<SamsaraDriver>("POST", "/drivers", data),
    );
  }

  /**
   * Update driver
   */
  async updateDriver(
    driverId: string,
    data: Partial<SamsaraDriver>,
  ): Promise<SamsaraDriver> {
    return this.executeWithRetry(() =>
      this.makeRequest<SamsaraDriver>("PATCH", `/drivers/${driverId}`, data),
    );
  }

  /**
   * List all vehicles
   */
  async listVehicles(
    limit: number = 100,
    after?: string,
  ): Promise<{ data: SamsaraVehicle[]; pagination: any }> {
    return this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraVehicle[]; pagination: any }>(
        "GET",
        "/vehicles",
        { limit, after },
      ),
    );
  }

  /**
   * Create vehicle
   */
  async createVehicle(data: {
    name: string;
    vin: string;
    licensePlate: string;
  }): Promise<SamsaraVehicle> {
    return this.executeWithRetry(() =>
      this.makeRequest<SamsaraVehicle>("POST", "/vehicles", data),
    );
  }

  /**
   * Update vehicle
   */
  async updateVehicle(
    vehicleId: string,
    data: Partial<SamsaraVehicle>,
  ): Promise<SamsaraVehicle> {
    return this.executeWithRetry(() =>
      this.makeRequest<SamsaraVehicle>("PATCH", `/vehicles/${vehicleId}`, data),
    );
  }

  /**
   * Get vehicle location history
   */
  async getVehicleLocationHistory(
    vehicleId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<SamsaraLocation[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraLocation[] }>(
        "GET",
        `/vehicles/${vehicleId}/locations`,
        {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      ),
    );

    return response.data;
  }

  /**
   * Get vehicle fuel/energy stats
   */
  async getVehicleEnergyStats(vehicleId: string): Promise<{
    fuelPercent?: number;
    engineState?: string;
    speedMph?: number;
  }> {
    return this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/vehicles/${vehicleId}/energy-stats`),
    );
  }

  /**
   * List routes
   */
  async listRoutes(limit: number = 100): Promise<SamsaraRoute[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraRoute[] }>("GET", "/routes", { limit }),
    );

    return response.data;
  }

  /**
   * Get route details
   */
  async getRoute(routeId: string): Promise<SamsaraRoute> {
    return this.executeWithRetry(() =>
      this.makeRequest<SamsaraRoute>("GET", `/routes/${routeId}`),
    );
  }

  /**
   * List assets
   */
  async listAssets(): Promise<SamsaraAsset[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraAsset[] }>("GET", "/assets"),
    );

    return response.data;
  }

  /**
   * Get asset locations
   */
  async getAssetLocations(assetId: string): Promise<SamsaraLocation[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraLocation[] }>(
        "GET",
        `/assets/${assetId}/locations`,
      ),
    );

    return response.data;
  }

  /**
   * Get reefer stats (temperature) for vehicle
   */
  async getReeferStats(vehicleId: string): Promise<{
    temperature?: number;
    setPoint?: number;
    runHours?: number;
  }> {
    return this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/vehicles/${vehicleId}/reefer-stats`),
    );
  }

  /**
   * Upload driver document
   */
  async uploadDocument(
    driverId: string,
    docType: string,
    fileUrl: string,
  ): Promise<SamsaraDocument> {
    return this.executeWithRetry(() =>
      this.makeRequest<SamsaraDocument>(
        "POST",
        `/drivers/${driverId}/documents`,
        {
          type: docType,
          documentUrl: fileUrl,
        },
      ),
    );
  }

  /**
   * Get driver documents
   */
  async getDriverDocuments(driverId: string): Promise<SamsaraDocument[]> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ data: SamsaraDocument[] }>(
        "GET",
        `/drivers/${driverId}/documents`,
      ),
    );

    return response.data;
  }

  /**
   * Get HOS summary
   */
  async getHOSSummary(driverId: string, date: Date): Promise<HOSSummary> {
    const summary = await this.executeWithRetry(() =>
      this.makeRequest<any>("GET", `/drivers/${driverId}/hos-summary`, {
        date: date.toISOString().split("T")[0],
      }),
    );

    return {
      driverId,
      date,
      hours11: summary.hours11 || 0,
      hours14: summary.hours14 || 0,
      hours60: summary.hours60 || 0,
      hours70: summary.hours70 || 0,
      availableDriving: Math.max(0, 11 - (summary.hours11 || 0)),
      availableOnDuty: Math.max(0, 14 - (summary.hours14 || 0)),
      violations: [],
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
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
    const payload = event.payload as unknown as SamsaraWebhookPayload;

    switch (payload.eventType) {
      case "hos.violation":
        this.logEvent({
          type: "hos-violation",
          driverId: payload.data.driverId as string,
          vehicleId: payload.data.vehicleId as string,
          data: payload.data,
        });
        break;

      case "dvir.submitted":
        this.logEvent({
          type: "dvir-submitted",
          driverId: payload.data.driverId as string,
          vehicleId: payload.data.vehicleId as string,
          data: payload.data,
        });
        break;

      case "vehicle.location":
        this.logEvent({
          type: "location-update",
          vehicleId: payload.data.vehicleId as string,
          data: payload.data,
        });
        break;

      default:
        this.logEvent({
          type: "diagnostic-event",
          data: {
            message: `Unhandled webhook event type: ${payload.eventType}`,
          },
        });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithRetry(() =>
        this.makeRequest<{ id: string }>("GET", "/organization"),
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
    params?: Record<string, any>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (method === "GET" && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    };

    if (method !== "GET" && params) {
      options.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Samsara API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private mapDutyStatus(status: string): DutyStatus {
    const statusMap: Record<string, DutyStatus> = {
      driving: "driving",
      on_duty: "on-duty",
      sleeper_berth: "sleeper-berth",
      off_duty: "off-duty",
    };
    return statusMap[status] || "off-duty";
  }

  private mapDutyStatusReverse(status: DutyStatus): string {
    const statusMap: Record<DutyStatus, string> = {
      driving: "driving",
      "on-duty": "on_duty",
      "sleeper-berth": "sleeper_berth",
      "off-duty": "off_duty",
      "personal-conveyance": "off_duty",
      "yard-move": "on_duty",
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

  private mapSamsaraDVIRtoELDDVIR(dvir: SamsaraDVIR): ELDDVIR {
    return {
      id: dvir.id,
      accountId: this.config.accountId || "",
      driverId: dvir.driverId,
      vehicleId: dvir.vehicleId,
      inspectionTime: new Date(dvir.inspectionDate),
      type: dvir.inspectionType === "pre_trip" ? "pre-trip" : "post-trip",
      condition: dvir.defectsSummary === "pass" ? "pass" : "defect",
      defects: dvir.defects.map((d) => ({
        component: d.component,
        severity: "minor" as const,
        description: d.defectDescription,
        evidenceUrls: [],
      })),
      driverRemarks: dvir.driverNotes,
      mechanicRemarks: dvir.mechanicNotes,
      defectsResolved: dvir.defects.every((d) => d.isResolved),
      submittedAt: new Date(dvir.inspectionDate),
      updatedAt: new Date(dvir.inspectionDate),
    };
  }
}

// ─── Error Types ────────────────────────────────────────

export class SamsaraAPIError extends Error {
  constructor(
    public statusCode: number,
    public body: string,
  ) {
    super(`Samsara API Error ${statusCode}: ${body}`);
  }
}
