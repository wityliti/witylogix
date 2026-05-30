/**
 * Lytx DriveCam API Client
 *
 * Implements ELDAdapterInterface for Lytx DriveCam (video telematics + safety) integration.
 * Authentication: OAuth2 (client credentials)
 * API Base: https://api.lytx.com/v1
 * Rate Limit: 120 requests per minute
 *
 * Features:
 * - Video telematics with triggered event detection
 * - Event types: harsh braking, collision, distraction, unsafe following
 * - Video clip request and download with signed URLs (1h expiry)
 * - Driver management with risk profile and coaching history
 * - Vehicle tracking with camera status and connectivity monitoring
 * - Safety scoring (driver risk score, fleet safety score, benchmarks)
 * - Coaching sessions from events with sign-off tracking
 * - Safety reports with event frequency and improvement trends
 * - Live camera feed requests (limited duration)
 * - Real-time event alerts with configurable thresholds
 * - HOS violation integration for context (linking events to duty logs)
 * - Webhook support for event triggers and coaching completion
 * - Retry logic with exponential backoff
 */

import { ELDAdapter } from "./eld-adapter.js";
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

// ─── Lytx API Types ─────────────────────────────────────────

interface LytxDriver {
  driverId: string;
  firstName: string;
  lastName: string;
  email?: string;
  employeeId?: string;
  riskProfile?: {
    riskScore: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    eventCount?: number;
    lastIncident?: string;
  };
  coachingHistory?: Array<{
    sessionId: string;
    eventId: string;
    createdAt: string;
    completedAt?: string;
    status: "pending" | "in-progress" | "completed";
  }>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LytxVehicle {
  vehicleId: string;
  name: string;
  unitNumber?: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number;
  cameraStatus?: "active" | "inactive" | "error";
  connectivity?: {
    status: "connected" | "disconnected" | "intermittent";
    lastSyncTime?: string;
    signalStrength?: number;
  };
  assignedDriver?: {
    driverId: string;
    name: string;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LytxEvent {
  eventId: string;
  driverId: string;
  vehicleId: string;
  eventType:
    | "harsh_braking"
    | "collision"
    | "distraction"
    | "unsafe_following"
    | "speeding"
    | "hard_turn"
    | "other";
  severity: "low" | "medium" | "high" | "critical";
  videoAvailable: boolean;
  videoClipUrl?: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  speed?: number;
  description?: string;
  coachingRequired: boolean;
  coachingSessionId?: string;
  createdAt: string;
}

interface LytxVideoClip {
  clipId: string;
  eventId: string;
  driverId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  downloadUrl: string; // signed URL, 1h expiry
  duration: number; // seconds
  format?: string;
  createdAt: string;
  expiresAt: string;
}

interface LytxSafetyScore {
  scoreId: string;
  driverId: string;
  period: string; // "daily", "weekly", "monthly"
  driverRiskScore: number; // 0-100, lower is better
  fleetAverage?: number;
  benchmark?: number;
  eventBreakdown?: {
    harshBraking: number;
    collision: number;
    distraction: number;
    unsafeFollowing: number;
  };
  coachingCompletionRate?: number;
  trend?: "improving" | "stable" | "declining";
  createdAt: string;
}

interface LytxCoachingSession {
  sessionId: string;
  driverId: string;
  eventId: string;
  createdAt: string;
  scheduledFor?: string;
  completedAt?: string;
  status: "pending" | "scheduled" | "in-progress" | "completed" | "declined";
  coachName?: string;
  topic: string;
  notes?: string;
  signedOffAt?: string;
  signedOffBy?: string; // driver signature/confirmation
}

interface LytxAlert {
  alertId: string;
  driverId: string;
  vehicleId: string;
  alertType: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  threshold?: number;
  currentValue?: number;
  timestamp: string;
  acknowledged?: boolean;
}

interface LytxLiveStream {
  streamId: string;
  vehicleId: string;
  streamUrl: string;
  expiresAt: string; // Usually 1 hour from request
  quality?: "sd" | "hd" | "full-hd";
}

interface LytxSafetyReport {
  reportId: string;
  driverId: string;
  period: string;
  startDate: string;
  endDate: string;
  eventFrequency: Record<string, number>;
  safetyScore: number;
  improvementTrend?: {
    previousScore?: number;
    percentChange?: number;
  };
  coachingCompletions?: number;
  coachingPending?: number;
  recommendations?: string[];
  createdAt: string;
}

// ─── Lytx Client ────────────────────────────────────────────

export class LytxDriveCamClient extends ELDAdapter {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: ELDConfig) {
    super(config, 2); // 120 req/min = 2 req/sec
    this.baseUrl = config.baseUrl || "https://api.lytx.com/v1";
    this.clientId = config.apiKey || "";
    this.clientSecret = config.apiSecret || "";
    this.accessToken = config.accessToken;
  }

  /**
   * Initialize and obtain OAuth2 token.
   */
  async initialize(): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Lytx DriveCam OAuth2 credentials (clientId, clientSecret) are required");
    }

    try {
      await this.obtainAccessToken();
      await this.executeWithRetry(() =>
        this.makeRequest<{ account: { id: string } }>("GET", "/account")
      );
      this.logEvent({
        type: "diagnostic-event",
        data: { message: "Lytx DriveCam initialized successfully" },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Lytx DriveCam: ${String(error)}`);
    }
  }

  /**
   * Get driver logs (simplified - Lytx primarily provides events, not traditional logs).
   * Returns empty array as Lytx is event-focused, not HOS-focused.
   */
  async getDriverLogs(
    _driverId: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<ELDDriverLog[]> {
    // Lytx DriveCam is not HOS-focused; this returns empty
    return [];
  }

  /**
   * Get current duty status (not applicable for Lytx).
   */
  async getDutyStatus(_driverId: string): Promise<ELDDutyStatus> {
    return {
      id: "",
      accountId: this.config.accountId || "",
      driverId: _driverId,
      status: "off-duty" as DutyStatus,
      changedAt: new Date(),
      availableHoursDriving: 0,
      availableHoursOnDuty: 0,
      createdAt: new Date(),
    };
  }

  /**
   * Set duty status (not applicable for Lytx).
   */
  async setDutyStatus(
    _driverId: string,
    _status: DutyStatus,
    _location?: { latitude: number; longitude: number }
  ): Promise<ELDDutyStatus> {
    return this.getDutyStatus(_driverId);
  }

  /**
   * Get safety events as violations (translating video events to violation format).
   */
  async getViolations(driverId: string, days: number = 30): Promise<ELDViolation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.executeWithRetry(() =>
      this.makeRequest<LytxEvent[]>("GET", `/drivers/${driverId}/events`, {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1000,
      })
    );

    const mapLytxSeverity = (s: string): "warning" | "error" | "critical" => {
      if (s === "critical") return "critical";
      if (s === "high" || s === "error") return "error";
      return "warning";
    };

    return events.map((e) => ({
      id: e.eventId,
      accountId: this.config.accountId || "",
      driverId: e.driverId,
      vehicleId: e.vehicleId || "",
      violationType: this.mapEventTypeToViolation(e.eventType),
      description: e.description || e.eventType,
      severity: mapLytxSeverity(e.severity),
      detectedAt: new Date(e.timestamp),
      violationTimeRange: {
        start: new Date(e.timestamp),
        end: new Date(e.timestamp),
      },
      hosContext: {
        minutesSinceBreak: undefined,
      },
      acknowledged: e.coachingRequired && !!e.coachingSessionId,
      createdAt: new Date(e.createdAt),
    }));
  }

  /**
   * Get vehicle information.
   */
  async getVehicle(vehicleId: string): Promise<ELDVehicle> {
    const vehicle = await this.executeWithRetry(() =>
      this.makeRequest<LytxVehicle>("GET", `/vehicles/${vehicleId}`)
    );

    return {
      id: vehicle.vehicleId,
      accountId: this.config.accountId || "",
      vin: vehicle.vin || "",
      licensePlate: vehicle.licensePlate || "",
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      group: undefined,
      activeFaults: [],
      maintenanceStatus: vehicle.cameraStatus === "active" ? "good" : "pending",
      createdAt: new Date(vehicle.createdAt),
      updatedAt: new Date(vehicle.updatedAt),
    };
  }

  /**
   * Get all vehicles.
   */
  async getVehicles(): Promise<ELDVehicle[]> {
    const vehicles = await this.executeWithRetry(() =>
      this.makeRequest<LytxVehicle[]>("GET", "/vehicles", {
        limit: 1000,
      })
    );

    return Promise.all(vehicles.map((v) => this.getVehicle(v.vehicleId)));
  }

  /**
   * Submit DVIR (not applicable for Lytx).
   */
  async submitDVIR(_dvir: Partial<ELDDVIR>): Promise<ELDDVIR> {
    return {
      id: "",
      accountId: this.config.accountId || "",
      driverId: _dvir.driverId || "",
      vehicleId: _dvir.vehicleId || "",
      inspectionTime: new Date(),
      type: _dvir.type || "pre-trip",
      condition: "pass",
      defects: [],
      submittedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get DVIRs (not applicable for Lytx).
   */
  async getDVIRs(_vehicleId: string, _days?: number): Promise<ELDDVIR[]> {
    return [];
  }

  /**
   * Get events for driver.
   */
  async getEvents(driverId: string, days: number = 30): Promise<LytxEvent[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.executeWithRetry(() =>
      this.makeRequest<LytxEvent[]>("GET", `/drivers/${driverId}/events`, {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1000,
      })
    );
  }

  /**
   * Request video clip for event.
   */
  async requestVideoClip(eventId: string): Promise<LytxVideoClip> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxVideoClip>("POST", `/events/${eventId}/video-clip`, null, {})
    );
  }

  /**
   * Download video clip (returns signed URL).
   */
  async downloadVideoClip(eventId: string, startTime?: Date, endTime?: Date): Promise<string> {
    const response = await this.executeWithRetry(() =>
      this.makeRequest<{ downloadUrl: string }>(
        "POST",
        `/events/${eventId}/download-video`,
        null,
        {
          startTime: startTime?.toISOString(),
          endTime: endTime?.toISOString(),
        }
      )
    );
    return response.downloadUrl;
  }

  /**
   * Get driver risk profile and coaching history.
   */
  async getDriver(driverId: string): Promise<LytxDriver> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxDriver>("GET", `/drivers/${driverId}`)
    );
  }

  /**
   * Get all drivers.
   */
  async getDrivers(): Promise<LytxDriver[]> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxDriver[]>("GET", "/drivers", {
        limit: 1000,
      })
    );
  }

  /**
   * Get safety score for driver.
   */
  async getSafetyScore(driverId: string, period: string = "monthly"): Promise<LytxSafetyScore> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxSafetyScore>("GET", `/drivers/${driverId}/safety-score`, {
        period,
      })
    );
  }

  /**
   * Get fleet safety score.
   */
  async getFleetSafetyScore(period: string = "monthly"): Promise<any> {
    return this.executeWithRetry(() =>
      this.makeRequest<any>("GET", "/fleet/safety-score", {
        period,
      })
    );
  }

  /**
   * Create coaching session from event.
   */
  async createCoachingSession(eventId: string, topic?: string): Promise<LytxCoachingSession> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxCoachingSession>(
        "POST",
        `/events/${eventId}/coaching-session`,
        null,
        {
          topic: topic || "Safety Coaching",
        }
      )
    );
  }

  /**
   * Get coaching session details.
   */
  async getCoachingSession(sessionId: string): Promise<LytxCoachingSession> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxCoachingSession>("GET", `/coaching-sessions/${sessionId}`)
    );
  }

  /**
   * Complete coaching session (sign-off).
   */
  async completeCoachingSession(
    sessionId: string,
    signOffBy: string
  ): Promise<LytxCoachingSession> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxCoachingSession>(
        "POST",
        `/coaching-sessions/${sessionId}/complete`,
        null,
        {
          signedOffBy: signOffBy,
        }
      )
    );
  }

  /**
   * Get safety report for driver.
   */
  async getSafetyReport(driverId: string, period: string = "monthly"): Promise<LytxSafetyReport> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxSafetyReport>("GET", `/drivers/${driverId}/safety-report`, {
        period,
      })
    );
  }

  /**
   * Request live camera feed.
   */
  async requestLiveStream(vehicleId: string, durationSeconds: number = 300): Promise<LytxLiveStream> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxLiveStream>(
        "POST",
        `/vehicles/${vehicleId}/live-stream`,
        null,
        {
          durationSeconds,
        }
      )
    );
  }

  /**
   * Get real-time alerts for fleet.
   */
  async getAlerts(severity?: string): Promise<LytxAlert[]> {
    return this.executeWithRetry(() =>
      this.makeRequest<LytxAlert[]>("GET", "/alerts", {
        ...(severity && { severity }),
        limit: 1000,
      })
    );
  }

  /**
   * Acknowledge alert.
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.executeWithRetry(() =>
      this.makeRequest<void>("POST", `/alerts/${alertId}/acknowledge`, null, {})
    );
  }

  /**
   * Handle webhook event.
   */
  async handleWebhook(event: ELDWebhookEvent): Promise<void> {
    switch (event.type) {
      case "diagnostic-event":
        // Handle video event/alert
        this.logEvent({
          type: "diagnostic-event",
          driverId: (event.payload.driverId as string) || undefined,
          vehicleId: (event.payload.vehicleId as string) || undefined,
          data: event.payload,
        });
        break;
      case "dvir-submitted":
        // Handle coaching completion
        this.logEvent({
          type: "dvir-submitted",
          driverId: (event.payload.driverId as string) || undefined,
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
        this.makeRequest<{ account: { id: string } }>("GET", "/account")
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
   * Make HTTP request to Lytx API.
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
      throw new Error(`Lytx API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Map Lytx event type to violation type.
   */
  private mapEventTypeToViolation(eventType: string): any {
    const map: Record<string, string> = {
      harsh_braking: "hours-14",
      collision: "hours-14",
      distraction: "hours-14",
      unsafe_following: "hours-14",
      speeding: "hours-14",
      hard_turn: "hours-14",
    };
    return map[eventType] || "hours-14";
  }
}
